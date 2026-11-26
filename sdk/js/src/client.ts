import type {
  ApiErrorBody, ApiErrorCode, EarlyRadarResponse, MarketResponse, RateLimit, ResultsResponse, StatusResponse, TokenResponse, ValidatedResponse,
} from "./types.js";

export const DEFAULT_BASE_URL = "https://flowfiengine.app";
export const SDK_VERSION = "0.1.1";

const KEY_SHAPE = /^ffi_(test_)?[A-Za-z0-9_-]{43}$/;
const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export interface FlowFiOptions {
  /** Your key from flowfiengine.app/developers (ffi_… or ffi_test_… for sample data). Defaults to the FLOWFI_API_KEY environment variable. */
  apiKey?: string;
  /** Defaults to https://flowfiengine.app. */
  baseUrl?: string;
  /** Retries for rate limits (per minute), 5xx answers and network errors. Default 2. The monthly quota is never retried. */
  maxRetries?: number;
  /** Per-request timeout in milliseconds. Default 15000. */
  timeoutMs?: number;
  /** Longest wait between retries in milliseconds (a longer Retry-After throws instead). Default 60000. */
  maxRetryWaitMs?: number;
  /** A custom fetch (tests, proxies). Defaults to the global fetch (Node 18+, browsers, Deno, Bun, Workers). */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

/** Every failed call throws this. `code` is the API's error code (or "network_error" / "timeout" / "invalid_response"). */
export class FlowFiError extends Error {
  readonly code: ApiErrorCode | "network_error" | "timeout" | "invalid_response";
  readonly status: number | null;
  readonly requestId: string | null;
  readonly docsUrl: string | null;
  readonly upgradeUrl: string | null;
  /** Seconds until you may call again (rate_limited / quota_exceeded). */
  readonly retryAfter: number | null;

  constructor(init: { code: FlowFiError["code"]; message: string; status?: number | null; requestId?: string | null; docsUrl?: string | null; upgradeUrl?: string | null; retryAfter?: number | null; cause?: unknown }) {
    super(init.message);
    this.name = "FlowFiError";
    this.code = init.code;
    this.status = init.status ?? null;
    this.requestId = init.requestId ?? null;
    this.docsUrl = init.docsUrl ?? null;
    this.upgradeUrl = init.upgradeUrl ?? null;
    this.retryAfter = init.retryAfter ?? null;
    if (init.cause !== undefined) (this as { cause?: unknown }).cause = init.cause;
  }
}

const envKey = (): string | undefined => {
  try {
    const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    return p?.env?.FLOWFI_API_KEY;
  } catch {
    return undefined;
  }
};

const intHeader = (h: Headers, name: string): number | null => {
  const v = h.get(name);
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Backoff before retry `attempt` (1-based): 0.5 s, 1 s, 2 s … with jitter, capped. */
export function backoffMs(attempt: number, cap: number, random: () => number = Math.random): number {
  const base = Math.min(cap, 500 * 2 ** (attempt - 1));
  return Math.round(base / 2 + random() * (base / 2));
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const t = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
  const onAbort = () => { clearTimeout(t); reject(signal!.reason); };
  signal?.addEventListener("abort", onAbort, { once: true });
});

/**
 * The FlowFi Intelligence API client.
 *
 * ```ts
 * import { FlowFi } from "flowfi";
 * const flowfi = new FlowFi({ apiKey: process.env.FLOWFI_API_KEY });
 * const radar = await flowfi.earlyRadar();
 * ```
 */
export class FlowFi {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly maxRetryWaitMs: number;
  private readonly fetchImpl: typeof fetch;
  /** Rate-limit and quota headers of the last answer. */
  lastRateLimit: RateLimit | null = null;

  constructor(options: FlowFiOptions = {}) {
    const key = (options.apiKey ?? envKey())?.trim() || undefined;
    if (key !== undefined && !KEY_SHAPE.test(key)) {
      throw new FlowFiError({ code: "invalid_key", message: "This doesn't look like a FlowFi API key (ffi_… or ffi_test_…). Create one at https://flowfiengine.app/developers." });
    }
    this.apiKey = key;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.maxRetries = Math.max(0, Math.floor(options.maxRetries ?? 2));
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetryWaitMs = options.maxRetryWaitMs ?? 60_000;
    const f = options.fetch ?? (globalThis as { fetch?: typeof fetch }).fetch;
    if (!f) throw new Error("No fetch available: use Node 18+ or pass options.fetch.");
    this.fetchImpl = f.bind(globalThis);
  }

  /** Projects on Validated now (LIVE on the map), ranked by Live Activity, plus the themes heating up. Explorer: 15 minutes delayed. */
  validated(opts?: RequestOptions): Promise<ValidatedResponse> {
    return this.get("/api/v1/validated", true, opts);
  }

  /** The Early Radar now: young projects with fresh activity, before Validated. Explorer: public top 10, 15 minutes delayed. */
  earlyRadar(opts?: RequestOptions): Promise<EarlyRadarResponse> {
    return this.get("/api/v1/early-radar", true, opts);
  }

  /** FlowFi's track record: the Results funnel and the most recent catches, newest first. `limit` 1–50 (default 20). */
  results(params: { limit?: number } = {}, opts?: RequestOptions): Promise<ResultsResponse> {
    let q = "";
    if (params.limit !== undefined) {
      if (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 50) {
        return Promise.reject(new FlowFiError({ code: "bad_request", message: "limit must be a whole number from 1 to 50." }));
      }
      q = `?limit=${params.limit}`;
    }
    return this.get(`/api/v1/results${q}`, true, opts);
  }

  /** FlowFi's read of one Solana project: Capital flow, Social attention, Security check, stage and outcome. Builder plan and above. */
  token(mint: string, opts?: RequestOptions): Promise<TokenResponse> {
    if (typeof mint !== "string" || !MINT.test(mint)) {
      return Promise.reject(new FlowFiError({ code: "bad_request", message: "Pass a Solana mint address (32–44 base58 characters)." }));
    }
    return this.get(`/api/v1/token/${mint}`, true, opts);
  }

  /** The state of each market FlowFi tracks: scanned, passed, detected today, Firewall verdicts and the Results funnel. */
  market(opts?: RequestOptions): Promise<MarketResponse> {
    return this.get("/api/v1/market", true, opts);
  }

  /** Whether the API is up and how fresh FlowFi's data is. No key needed; never counted. */
  status(opts?: RequestOptions): Promise<StatusResponse> {
    return this.get("/api/v1/status", false, opts);
  }

  private async get<T>(path: string, needsKey: boolean, opts: RequestOptions = {}): Promise<T> {
    if (needsKey && !this.apiKey) {
      throw new FlowFiError({ code: "missing_key", message: "No API key. Pass { apiKey } or set FLOWFI_API_KEY. Create a free key at https://flowfiengine.app/developers." });
    }
    const headers: Record<string, string> = { Accept: "application/json" };
    if (needsKey) headers.Authorization = `Bearer ${this.apiKey}`;
    // No custom headers: the API's CORS allows only Authorization and Content-Type, so browser calls keep working.

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchOnce(this.baseUrl + path, headers, opts.signal);
      } catch (err) {
        if (opts.signal?.aborted) throw err;
        const timeout = err instanceof FlowFiError && err.code === "timeout";
        if (attempt < this.maxRetries) { await sleep(backoffMs(attempt + 1, this.maxRetryWaitMs), opts.signal); continue; }
        throw timeout ? err : new FlowFiError({ code: "network_error", message: `Could not reach the FlowFi API: ${(err as Error)?.message ?? String(err)}`, cause: err });
      }

      this.lastRateLimit = {
        limit: intHeader(res.headers, "x-ratelimit-limit"), remaining: intHeader(res.headers, "x-ratelimit-remaining"), reset: intHeader(res.headers, "x-ratelimit-reset"),
        quotaLimit: intHeader(res.headers, "x-quota-limit"), quotaRemaining: intHeader(res.headers, "x-quota-remaining"), quotaReset: intHeader(res.headers, "x-quota-reset"),
      };

      const body = await res.json().catch(() => null) as (T & { ok?: boolean }) | ApiErrorBody | null;
      if (res.ok && body && (body as { ok?: boolean }).ok !== false) return body as T;

      const err = body && (body as ApiErrorBody).ok === false ? body as ApiErrorBody : null;
      const retryAfter = intHeader(res.headers, "retry-after");
      const code: FlowFiError["code"] = err?.error ?? (res.status === 404 ? "not_found" : res.status >= 500 ? "unavailable" : "invalid_response");
      const error = new FlowFiError({
        code, status: res.status, requestId: err?.requestId ?? res.headers.get("x-request-id"), docsUrl: err?.docsUrl ?? null, upgradeUrl: err?.upgradeUrl ?? null, retryAfter,
        message: err?.message ?? (res.status === 404 ? "Not found (the API may be switched off right now)." : `FlowFi API answered ${res.status}.`),
      });

      // Retry only what can succeed soon: the per-minute limit and temporary server errors. Never the monthly quota.
      const retryable = code === "rate_limited" || code === "unavailable" || res.status >= 500;
      if (!retryable || attempt >= this.maxRetries) throw error;
      const wait = retryAfter !== null ? retryAfter * 1000 : backoffMs(attempt + 1, this.maxRetryWaitMs);
      if (wait > this.maxRetryWaitMs) throw error;
      await sleep(wait, opts.signal);
    }
  }

  private async fetchOnce(url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<Response> {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort(signal!.reason);
    if (signal) { if (signal.aborted) ctrl.abort(signal.reason); else signal.addEventListener("abort", onAbort, { once: true }); }
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, this.timeoutMs);
    try {
      return await this.fetchImpl(url, { method: "GET", headers, signal: ctrl.signal });
    } catch (err) {
      if (timedOut) throw new FlowFiError({ code: "timeout", message: `The FlowFi API didn't answer within ${this.timeoutMs} ms.` });
      throw err;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
}
