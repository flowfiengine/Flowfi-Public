/**
 * Response types of the FlowFi Intelligence API v1 (https://flowfiengine.app/api/openapi.json).
 * Multiples are always from FlowFi's first detection. Information only, not financial advice.
 */

export type PlanId = "explorer" | "builder" | "pro_api" | "scale" | "enterprise";
export type Stage = "early_radar" | "validated";
/**
 * passed: checked, nothing found. pending: not checked yet. not_ranked: $FLOWFI (FlowFi never ranks its own token).
 * kept_out: listed for completeness; projects the Firewall keeps out are never returned.
 */
export type FirewallVerdict = "passed" | "pending" | "not_ranked" | "kept_out";
export type PriceStatus = "up" | "flat" | "down" | "too_new";

/** Usage of your plan, sent with every metered answer. */
export interface Usage {
  plan: PlanId;
  minute: { used: number; limit: number; resetsAt: string };
  /** null for test keys (they never count toward the month). */
  month: { used: number; limit: number; resetsAt: string } | null;
}

/** Sent on Explorer and Builder answers only: the next plan and what it adds. */
export interface Upgrade {
  plan: PlanId;
  name: string;
  priceUsdMonth: number;
  adds: string[];
  url: string;
}

/** Fields every metered answer carries. */
export interface Metered {
  ok: true;
  usage: Usage;
  upgrade?: Upgrade;
  requestId: string;
  /** true when the answer came from a test key (ffi_test_…): fixed sample data. */
  test?: boolean;
}

export interface Project {
  mint: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  stage: Stage;
  state: string;
  /** Live Activity score. */
  activity: number | null;
  /** @deprecated Same number as realBuyers. */
  buyers: number | null;
  /** Distinct wallets that bought 0.5 SOL or more in the swaps FlowFi's buyer check read (last hour). */
  realBuyers: number | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  volumeH1: number;
  volumeH24: number;
  changeH1: number | null;
  buys1h: number | null;
  sells1h: number | null;
  ageMinutes: number | null;
  hasX: boolean;
  theme: string | null;
  firstDetectedAt: string | null;
  firewall: FirewallVerdict;
}

export interface Theme {
  theme: string;
  tokens: number;
  volume1h: number;
  volume24h: number;
  change1h: number | null;
  share: number;
}

interface Feed extends Metered {
  observedAt: string;
  /** Minutes the feed is delayed (15 on Explorer, 0 from Builder). */
  delayedMinutes: number;
  /** Present only when the feed is delayed (Explorer). */
  delayNote?: string;
  count: number;
  projects: Project[];
  /** @deprecated Use projects. */
  tokens: Project[];
}

export interface ValidatedResponse extends Feed {
  themes: Theme[];
}

export type EarlyRadarResponse = Feed;

/** Multiples of the first-detection price 1, 6 and 24 hours after FlowFi first detected it (null until observed). */
export interface Grades {
  h1: number | null;
  h6: number | null;
  h24: number | null;
}

export interface Outcome {
  mint: string;
  symbol: string | null;
  name: string | null;
  firstDetectedAt: string;
  firstStage: Stage | null;
  /** @deprecated Use firstStage. */
  stage: Stage | null;
  firstDetectionPriceUsd: number | null;
  firstDetectionMarketCapUsd: number | null;
  peakMultiple: number | null;
  peakAt: string | null;
  currentMultiple: number | null;
  /** Builder and above; null on Explorer. */
  grades: Grades | null;
  mapStatus: "on_map" | "off_map";
  priceStatus: PriceStatus;
  /** @deprecated Use mapStatus and priceStatus. */
  status: string;
  onMapNow: boolean;
  /** It went LIVE on the map: only these count toward 2x+ / 5x+ / 10x+. */
  wentLive: boolean;
}

/** CAUGHT -> LIVE -> 2x+ / 5x+ / 10x+ (LIVE projects only), the same numbers as the Results page. */
export interface Funnel {
  caught: number;
  live: number;
  reached2x: number;
  reached5x: number;
  reached10x: number;
}

export interface ResultsResponse extends Metered {
  asOf: string;
  gradesIncluded: boolean;
  funnel: Funnel;
  count: number;
  recent: Outcome[];
}

export interface Fact {
  id: string;
  label: string;
  text: string;
  tone: "good" | "watch" | "neutral";
}

export interface CapitalFlow {
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  volumeH1: number | null;
  volumeH24: number | null;
  buys1h: number | null;
  sells1h: number | null;
  buyShare1h: number | null;
  facts: Fact[];
}

export interface XAttention {
  state: string;
  uniqueAuthors: number;
  observedPosts: number;
  coverage: string;
  status: string | null;
  checkedAt: string | null;
}

export interface SocialAttention {
  activity: number | null;
  /** @deprecated Use realBuyers. */
  buyers: number | null;
  realBuyers: number | null;
  x: XAttention | null;
  facts: Fact[];
}

export interface SecurityCheck {
  firewall: FirewallVerdict;
  firewallCheckedAt: string | null;
  facts: Fact[];
}

export interface Signals {
  capitalFlow: CapitalFlow;
  socialAttention: SocialAttention;
  securityCheck: SecurityCheck;
  /** @deprecated Use capitalFlow. */
  money: CapitalFlow;
  /** @deprecated Use socialAttention. */
  attention: SocialAttention;
  /** @deprecated Use securityCheck. */
  safety: SecurityCheck;
}

export interface TokenResponse extends Metered {
  mint: string;
  /** true for $FLOWFI, FlowFi's own token. */
  official: boolean;
  note: string | null;
  observedAt: string | null;
  stage: Stage | null;
  onMapNow: boolean;
  firstDetectedAt: string | null;
  token: Project | null;
  /** $FLOWFI only. */
  market: {
    symbol: string;
    name: string;
    priceUsd: number | null;
    marketCapUsd: number | null;
    liquidityUsd: number | null;
    volumeH24: number;
    changeH1: number | null;
    changeH24: number | null;
  } | null;
  signals: Signals;
  firewall: { verdict: FirewallVerdict; checkedAt: string | null };
  lens: { aligned: number; total: number; agree: string[]; watch: string[] } | null;
  outcome: Outcome | null;
}

export interface Market {
  id: string;
  name: string;
  now: { scanned: number; passed: number; validated: number; earlyRadar: number } | null;
  today: { detected: number; earlyRadar: number; validated: number } | null;
  firewall: { checked: number; keptOut: number; passed: number; keptOutByReason: Record<string, number> } | null;
  results: Funnel | null;
  trackingSince: string | null;
}

export interface MarketResponse extends Metered {
  markets: Market[];
  /** Markets your plan doesn't include (Pro API and above get every market). */
  moreMarkets: string[];
  moreMarketsPlan: string | null;
}

/** /api/v1/status: public, no key, not counted. */
export interface StatusResponse {
  ok: true;
  status: "ok" | "degraded";
  version: string;
  checkedAt: string;
  data: {
    snapshotAt: string | null;
    snapshotAgeSeconds: number | null;
    resultsAt: string | null;
    resultsAgeSeconds: number | null;
  };
}

export type ApiErrorCode =
  | "missing_key" | "invalid_key" | "key_in_query" | "bad_request" | "scope_required" | "plan_required"
  | "not_found" | "rate_limited" | "quota_exceeded" | "unavailable";

/** The error body every failed call returns. */
export interface ApiErrorBody {
  ok: false;
  error: ApiErrorCode;
  message: string;
  requestId: string;
  docsUrl: string;
  upgradeUrl?: string;
}

/** The rate-limit headers of the last answer (null where the answer didn't carry them). */
export interface RateLimit {
  limit: number | null;
  remaining: number | null;
  /** Unix seconds. */
  reset: number | null;
  quotaLimit: number | null;
  quotaRemaining: number | null;
  /** Unix seconds. */
  quotaReset: number | null;
}
