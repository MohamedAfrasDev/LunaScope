import { describe, expect, it } from "vitest";
import { matchRoute } from "@/lib/bff";

const RUN = "a".repeat(64);
const q = (s = "") => new URLSearchParams(s);

describe("BFF allow-list", () => {
  it("rebuilds the upstream path for known routes", () => {
    const m = matchRoute("GET", ["analyses", RUN, "results"], q("site=rule-89.5S-E0&include=intervals,events"));
    expect(m).toMatchObject({ ok: true, match: { upstreamPath: `/api/v1/analyses/${RUN}/results` } });
    if (m.ok) expect(m.match.query).toBe("?site=rule-89.5S-E0&include=intervals%2Cevents");
    expect(matchRoute("POST", ["analyses"], q())).toMatchObject({
      ok: true,
      match: { upstreamPath: "/api/v1/analyses", maxBodyBytes: 65536 },
    });
    expect(matchRoute("GET", ["health"], q())).toMatchObject({ ok: true });
    expect(matchRoute("GET", ["analyses", RUN, "horizon", "rule-89.5S-E0"], q())).toMatchObject({ ok: true });
    expect(matchRoute("GET", ["analyses", RUN, "export"], q("verified=false"))).toMatchObject({ ok: true });
  });

  it.each([
    [["admin"]],
    [["analyses", "not-a-run-id"]],
    [["analyses", RUN.toUpperCase()]],
    [["analyses", RUN, "secrets"]],
    [["analyses", RUN, "results", "extra"]],
    [["analyses", "..", "health"]],
    [["analyses", RUN, "horizon", "../../etc"]],
    [["analyses", RUN, "horizon", "a/b"]],
    [["health", "x"]],
    [[]],
  ])("does not forward %j", (slug) => {
    expect(matchRoute("GET", slug as string[], q())).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("refuses the wrong method rather than guessing", () => {
    expect(matchRoute("POST", ["health"], q())).toMatchObject({ ok: false, reason: "method_not_allowed" });
    expect(matchRoute("GET", ["analyses"], q())).toMatchObject({ ok: false, reason: "method_not_allowed" });
    expect(matchRoute("GET", ["sites", "custom"], q())).toMatchObject({ ok: false, reason: "method_not_allowed" });
    expect(matchRoute("DELETE", ["analyses", RUN], q())).toMatchObject({ ok: false, reason: "method_not_allowed" });
  });

  it("rejects unknown or malformed query parameters", () => {
    const r = ["analyses", RUN, "results"];
    expect(matchRoute("GET", r, q("evil=1"))).toMatchObject({ ok: false, reason: "invalid_query" });
    expect(matchRoute("GET", r, q("target=moon"))).toMatchObject({ ok: false, reason: "invalid_query" });
    expect(matchRoute("GET", r, q("include=intervals,../x"))).toMatchObject({ ok: false, reason: "invalid_query" });
    expect(matchRoute("GET", r, q("site=a/b"))).toMatchObject({ ok: false, reason: "invalid_query" });
    expect(matchRoute("GET", ["health"], q("x=1"))).toMatchObject({ ok: false, reason: "invalid_query" });
    expect(matchRoute("GET", ["analyses", RUN, "export"], q("verified=maybe"))).toMatchObject({
      ok: false,
      reason: "invalid_query",
    });
  });
});
