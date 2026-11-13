/**
 * Allow-list for the backend-for-frontend (BFF) proxy.
 *
 * The browser never chooses the upstream path: it names one of these routes and the upstream path
 * is rebuilt from the matched, validated pieces. Anything else is not forwarded, so a caller
 * cannot steer a request (or the service token) to another path or host.
 */

const RUN = "[0-9a-f]{64}";
const SITE = "[A-Za-z0-9._-]{1,64}";

export type Method = "GET" | "POST";

export interface RouteMatch {
  method: Method;
  upstreamPath: string; // always under /api/v1
  query: string; // rebuilt from allowed keys only, '' or '?a=b'
  maxBodyBytes: number;
  timeoutMs: number;
}

interface RouteDef {
  method: Method;
  re: RegExp;
  upstream: (m: RegExpMatchArray) => string;
  query?: Record<string, (v: string) => boolean>;
  maxBodyBytes?: number;
  timeoutMs?: number;
}

const TARGETS = new Set(["sun_center", "earth_center"]);
const INCLUDES = new Set(["intervals", "events", "series"]);

const ROUTES: RouteDef[] = [
  { method: "GET", re: /^health$/, upstream: () => "health" },
  { method: "GET", re: /^resources$/, upstream: () => "resources" },
  { method: "GET", re: /^sites$/, upstream: () => "sites" },
  { method: "POST", re: /^sites\/custom$/, upstream: () => "sites/custom", maxBodyBytes: 4096 },
  { method: "POST", re: /^analyses$/, upstream: () => "analyses", maxBodyBytes: 64 * 1024 },
  { method: "GET", re: new RegExp(`^analyses/(${RUN})$`), upstream: (m) => `analyses/${m[1]}` },
  {
    method: "GET",
    re: new RegExp(`^analyses/(${RUN})/results$`),
    upstream: (m) => `analyses/${m[1]}/results`,
    query: {
      site: (v) => new RegExp(`^${SITE}$`).test(v),
      target: (v) => TARGETS.has(v),
      include: (v) => v.split(",").every((x) => INCLUDES.has(x)),
    },
    timeoutMs: 20_000,
  },
  {
    method: "GET",
    re: new RegExp(`^analyses/(${RUN})/provenance$`),
    upstream: (m) => `analyses/${m[1]}/provenance`,
    timeoutMs: 20_000,
  },
  {
    method: "GET",
    re: new RegExp(`^analyses/(${RUN})/horizon/(${SITE})$`),
    upstream: (m) => `analyses/${m[1]}/horizon/${m[2]}`,
    timeoutMs: 20_000,
  },
  {
    method: "GET",
    re: new RegExp(`^analyses/(${RUN})/export$`),
    upstream: (m) => `analyses/${m[1]}/export`,
    query: { verified: (v) => v === "true" || v === "false" },
    timeoutMs: 30_000,
  },
];

export type MatchResult =
  | { ok: true; match: RouteMatch }
  | { ok: false; reason: "not_found" | "method_not_allowed" | "invalid_query" };

export function matchRoute(method: string, slug: string[], search: URLSearchParams): MatchResult {
  const path = slug.join("/");
  const byPath = ROUTES.filter((r) => r.re.test(path));
  if (byPath.length === 0) return { ok: false, reason: "not_found" };
  const def = byPath.find((r) => r.method === method);
  if (!def) return { ok: false, reason: "method_not_allowed" };

  const m = path.match(def.re) as RegExpMatchArray;
  const allowed = def.query ?? {};
  const parts: string[] = [];
  for (const [key, value] of search.entries()) {
    const check = allowed[key];
    if (!check || !check(value)) return { ok: false, reason: "invalid_query" };
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  return {
    ok: true,
    match: {
      method: def.method,
      upstreamPath: `/api/v1/${def.upstream(m)}`,
      query: parts.length ? `?${parts.join("&")}` : "",
      maxBodyBytes: def.maxBodyBytes ?? 0,
      timeoutMs: def.timeoutMs ?? 8_000,
    },
  };
}

/** Response headers that may cross back to the browser. */
export const PASS_HEADERS = [
  "content-type",
  "retry-after",
  "x-correlation-id",
  "x-content-sha256",
  "x-result-state",
  "x-bundle-kind",
];
