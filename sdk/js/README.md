# flowfi

The official JavaScript / TypeScript client for the [FlowFi Intelligence API](https://flowfiengine.app/developers): what FlowFi's LIVE map has validated, the Early Radar, Results since first detection, one project's read, and the state of each market.

- Typed responses for every endpoint
- API key handling (header only, never in the URL)
- Automatic retries for the per-minute limit and temporary errors (never for the monthly quota)
- Zero dependencies. Node 18+, Bun, Deno, browsers and edge runtimes

Information only, not financial advice. Always DYOR.

## Install

```sh
npm install flowfi
```

## Quick start

Create a free key at [flowfiengine.app/developers](https://flowfiengine.app/developers), then:

```ts
import { FlowFi } from "flowfi";

const flowfi = new FlowFi({ apiKey: process.env.FLOWFI_API_KEY });

const radar = await flowfi.earlyRadar();
for (const p of radar.projects) {
  console.log(p.symbol, p.marketCapUsd, p.firewall);
}
```

`new FlowFi()` with no options reads `FLOWFI_API_KEY` from the environment.

Try it with a **test key** (`ffi_test_...`): it returns fixed sample data and never counts toward your month.

## Endpoints

| Method | Endpoint | What you get | Plan |
|---|---|---|---|
| `flowfi.validated()` | `/api/v1/validated` | Projects LIVE on the map now, ranked by Live Activity, plus hot themes | All (Explorer: 15 min delay) |
| `flowfi.earlyRadar()` | `/api/v1/early-radar` | Young projects with fresh activity, before Validated | All (Explorer: top 10, 15 min delay) |
| `flowfi.results({ limit })` | `/api/v1/results` | The Results funnel and the latest catches, with peak multiples from first detection | All (+1h/+6h/+24h grades from Builder) |
| `flowfi.token(mint)` | `/api/v1/token/{mint}` | Capital flow, Social attention and Security check for one Solana project | Builder and above |
| `flowfi.market()` | `/api/v1/market` | Scanned, passed, detected today, Firewall verdicts and the funnel per market | All (every market from Pro API) |
| `flowfi.status()` | `/api/v1/status` | Whether the API is up and how fresh the data is. No key needed | Public |

Full field reference: [flowfiengine.app/developers](https://flowfiengine.app/developers) and the OpenAPI spec at [flowfiengine.app/api/openapi.json](https://flowfiengine.app/api/openapi.json).

## Results

```ts
const { funnel, recent } = await flowfi.results({ limit: 10 });
console.log(`Caught ${funnel.caught}, LIVE ${funnel.live}, 2x+ ${funnel.reached2x}`);
for (const r of recent) console.log(r.symbol, r.peakMultiple, r.priceStatus);
```

## One project

```ts
const read = await flowfi.token(mint);
console.log(read.signals.capitalFlow.buyShare1h);   // share of buys in the last hour
console.log(read.signals.securityCheck.firewall);   // "passed" | "pending" | ...
console.log(read.outcome?.peakMultiple);            // since FlowFi's first detection
```

## Errors

Every failed call throws a `FlowFiError`:

```ts
import { FlowFi, FlowFiError } from "flowfi";

try {
  await flowfi.token(mint);
} catch (err) {
  if (err instanceof FlowFiError) {
    console.log(err.code);       // "plan_required", "rate_limited", "quota_exceeded", "invalid_key", ...
    console.log(err.status);     // HTTP status, e.g. 403
    console.log(err.requestId);  // quote it when asking for help
    console.log(err.upgradeUrl); // set on plan_required and quota_exceeded
  }
}
```

| `code` | Meaning |
|---|---|
| `missing_key`, `invalid_key` | No key, or a wrong, revoked or expired one |
| `scope_required`, `plan_required` | The key or plan doesn't include this endpoint |
| `bad_request` | A parameter is not valid (checked before the call when possible) |
| `not_found` | FlowFi has no stored read for this project |
| `rate_limited` | Too many calls this minute (retried automatically) |
| `quota_exceeded` | This month's calls are used up (never retried) |
| `unavailable` | Try again in a minute (retried automatically) |
| `network_error`, `timeout` | The API couldn't be reached |

## Limits and retries

```ts
const flowfi = new FlowFi({
  apiKey: process.env.FLOWFI_API_KEY,
  maxRetries: 2,          // default 2
  timeoutMs: 15_000,      // default 15 s per request
  maxRetryWaitMs: 60_000, // a longer Retry-After throws instead of waiting
});

await flowfi.validated();
console.log(flowfi.lastRateLimit); // { limit, remaining, reset, quotaLimit, quotaRemaining, quotaReset }
```

Every answer also carries a `usage` block (`usage.minute`, `usage.month`).

Cancel a call with an `AbortSignal`: `flowfi.validated({ signal })`.

## Keep live keys on a server

Browser calls work (the API allows CORS with a Bearer header), but anyone can copy a key from a web page. Use live keys from your server, bot or backend only.

## License

MIT
