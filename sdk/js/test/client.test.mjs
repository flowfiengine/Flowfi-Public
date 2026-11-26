import { test } from "node:test";
import assert from "node:assert/strict";
import { FlowFi, FlowFiError, backoffMs } from "../dist/esm/index.js";

const KEY = "ffi_test_" + "a".repeat(43);
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const errBody = (error, extra = {}) => ({ ok: false, error, message: `${error} message`, requestId: "req_x", docsUrl: `https://flowfiengine.app/developers#error-${error}`, ...extra });

/** A fetch that answers from a list and records every call. */
function mockFetch(answers) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const a = answers[Math.min(calls.length - 1, answers.length - 1)];
    if (a instanceof Error) throw a;
    return typeof a === "function" ? a(url, init) : a;
  };
  fn.calls = calls;
  return fn;
}

test("sends the key as a Bearer header, never in the URL", async () => {
  const f = mockFetch([json(200, { ok: true, projects: [], usage: {}, requestId: "r" })]);
  const c = new FlowFi({ apiKey: KEY, fetch: f });
  await c.validated();
  assert.equal(f.calls[0].url, "https://flowfiengine.app/api/v1/validated");
  assert.equal(f.calls[0].init.headers.Authorization, `Bearer ${KEY}`);
  assert.ok(!f.calls[0].url.includes(KEY));
  // Only CORS-safe headers, so browser calls keep working.
  assert.deepEqual(Object.keys(f.calls[0].init.headers).sort(), ["Accept", "Authorization"]);
});

test("every endpoint hits its path", async () => {
  const f = mockFetch([() => json(200, { ok: true })]);
  const c = new FlowFi({ apiKey: KEY, fetch: f, baseUrl: "https://example.test/" });
  await c.validated(); await c.earlyRadar(); await c.results(); await c.results({ limit: 5 }); await c.market();
  await c.token("FFiTest111111111111111111111111111111111111A"); await c.status();
  assert.deepEqual(f.calls.map(x => x.url.replace("https://example.test", "")), [
    "/api/v1/validated", "/api/v1/early-radar", "/api/v1/results", "/api/v1/results?limit=5", "/api/v1/market",
    "/api/v1/token/FFiTest111111111111111111111111111111111111A", "/api/v1/status",
  ]);
  assert.equal(f.calls[6].init.headers.Authorization, undefined, "status sends no key");
});

test("status works without a key; keyed endpoints refuse without one", async () => {
  const saved = process.env.FLOWFI_API_KEY; delete process.env.FLOWFI_API_KEY;
  try {
    const f = mockFetch([json(200, { ok: true, status: "ok" })]);
    const c = new FlowFi({ fetch: f });
    assert.equal((await c.status()).status, "ok");
    await assert.rejects(c.earlyRadar(), e => e instanceof FlowFiError && e.code === "missing_key");
    assert.equal(f.calls.length, 1);
  } finally { if (saved !== undefined) process.env.FLOWFI_API_KEY = saved; }
});

test("reads FLOWFI_API_KEY from the environment", async () => {
  const saved = process.env.FLOWFI_API_KEY; process.env.FLOWFI_API_KEY = KEY;
  try {
    const f = mockFetch([json(200, { ok: true })]);
    await new FlowFi({ fetch: f }).market();
    assert.equal(f.calls[0].init.headers.Authorization, `Bearer ${KEY}`);
  } finally { if (saved === undefined) delete process.env.FLOWFI_API_KEY; else process.env.FLOWFI_API_KEY = saved; }
});

test("rejects a malformed key, mint or limit before any call", async () => {
  assert.throws(() => new FlowFi({ apiKey: "sk-not-flowfi", fetch: mockFetch([]) }), e => e.code === "invalid_key");
  const f = mockFetch([json(200, { ok: true })]);
  const c = new FlowFi({ apiKey: KEY, fetch: f });
  await assert.rejects(c.token("not a mint"), e => e.code === "bad_request");
  await assert.rejects(c.token("../market"), e => e.code === "bad_request");
  for (const limit of [0, 51, 2.5]) await assert.rejects(c.results({ limit }), e => e.code === "bad_request");
  assert.equal(f.calls.length, 0);
});

test("API errors become FlowFiError with code, status, requestId and links", async () => {
  const f = mockFetch([json(403, errBody("plan_required", { upgradeUrl: "https://flowfiengine.app/developers#pricing" }))]);
  const c = new FlowFi({ apiKey: KEY, fetch: f });
  const e = await c.token("FFiTest111111111111111111111111111111111111A").catch(x => x);
  assert.ok(e instanceof FlowFiError);
  assert.equal(e.code, "plan_required"); assert.equal(e.status, 403); assert.equal(e.requestId, "req_x");
  assert.equal(e.upgradeUrl, "https://flowfiengine.app/developers#pricing");
  assert.equal(f.calls.length, 1, "4xx is never retried");
});

test("rate_limited waits Retry-After and retries", async () => {
  const f = mockFetch([json(429, errBody("rate_limited"), { "retry-after": "0" }), json(200, { ok: true, count: 1 })]);
  const out = await new FlowFi({ apiKey: KEY, fetch: f }).earlyRadar();
  assert.equal(out.count, 1); assert.equal(f.calls.length, 2);
});

test("quota_exceeded is never retried", async () => {
  const f = mockFetch([json(429, errBody("quota_exceeded"), { "retry-after": "0" })]);
  await assert.rejects(new FlowFi({ apiKey: KEY, fetch: f }).validated(), e => e.code === "quota_exceeded" && e.retryAfter === 0);
  assert.equal(f.calls.length, 1);
});

test("a Retry-After longer than maxRetryWaitMs throws instead of waiting", async () => {
  const f = mockFetch([json(429, errBody("rate_limited"), { "retry-after": "40" })]);
  await assert.rejects(new FlowFi({ apiKey: KEY, fetch: f, maxRetryWaitMs: 1000 }).validated(), e => e.code === "rate_limited" && e.retryAfter === 40);
  assert.equal(f.calls.length, 1);
});

test("503 and network errors retry up to maxRetries, then throw", async () => {
  const f = mockFetch([json(503, errBody("unavailable")), new TypeError("fetch failed"), json(200, { ok: true, count: 3 })]);
  assert.equal((await new FlowFi({ apiKey: KEY, fetch: f, maxRetryWaitMs: 5 }).market()).count, 3);
  assert.equal(f.calls.length, 3);

  const g = mockFetch([new TypeError("fetch failed")]);
  await assert.rejects(new FlowFi({ apiKey: KEY, fetch: g, maxRetries: 1, maxRetryWaitMs: 5 }).market(), e => e.code === "network_error");
  assert.equal(g.calls.length, 2);
});

test("a 404 without a JSON body (API switched off) is not_found", async () => {
  const f = mockFetch([new Response(null, { status: 404 })]);
  await assert.rejects(new FlowFi({ apiKey: KEY, fetch: f }).validated(), e => e.code === "not_found" && e.status === 404);
});

test("times out", async () => {
  const hang = (_u, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
  const f = mockFetch([hang]);
  await assert.rejects(new FlowFi({ apiKey: KEY, fetch: f, timeoutMs: 20, maxRetries: 0 }).validated(), e => e.code === "timeout");
});

test("records the rate-limit headers of the last answer", async () => {
  const f = mockFetch([json(200, { ok: true }, { "x-ratelimit-limit": "30", "x-ratelimit-remaining": "29", "x-ratelimit-reset": "1700000060", "x-quota-limit": "10000", "x-quota-remaining": "9999", "x-quota-reset": "1701388800" })]);
  const c = new FlowFi({ apiKey: KEY, fetch: f });
  await c.validated();
  assert.deepEqual(c.lastRateLimit, { limit: 30, remaining: 29, reset: 1700000060, quotaLimit: 10000, quotaRemaining: 9999, quotaReset: 1701388800 });
});

test("backoff grows and stays under the cap", () => {
  assert.equal(backoffMs(1, 60_000, () => 1), 500);
  assert.equal(backoffMs(3, 60_000, () => 1), 2000);
  assert.equal(backoffMs(20, 1000, () => 1), 1000);
  assert.equal(backoffMs(1, 60_000, () => 0), 250);
});

test("CommonJS build loads", async () => {
  const { createRequire } = await import("node:module");
  const cjs = createRequire(import.meta.url)("../dist/cjs/index.js");
  assert.equal(typeof cjs.FlowFi, "function");
});
