import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompareView } from "@/components/CompareView";
import type { CompareFact, ComparisonResponse } from "@/lib/api/types";
import { matchRoute } from "@/lib/bff";
import { factText, fieldLabel, fieldValue } from "@/lib/facts";

const RUN = "f".repeat(64);
const A = "rule-89.5S-E0";
const B = "rule-89.5S-E120";
const C = "rule-89.5S-E240";

describe("fact templates", () => {
  const cases: [CompareFact, RegExp][] = [
    [{ fact: "terrain_changes_outcome", site_id: A, target: "sun_center", flat_outcome: "PASS", terrain_outcome: "FAIL",
      flat_availability_lower: 1, terrain_availability_lower: 0 },
     /At 89\.5°S, 0°E, terrain changes the Sun result: Pass on a flat horizon \(100\.0%\) but Fail with the terrain skyline \(0\.0%\)\./],
    [{ fact: "outcomes_differ", target: "earth_center", outcomes: { [A]: "PASS", [B]: "FAIL" } },
     /Earth, the sites reach different outcomes: 89\.5°S, 0°E Pass; 89\.5°S, 120°E Fail\. LunaScope does not rank them/],
    [{ fact: "outcomes_same", target: "sun_center", outcomes: { [A]: "FAIL", [B]: "FAIL" } },
     /every compared site has the same outcome \(Fail\)/],
    [{ fact: "equal_availability_different_outage", target: "sun_center", sites: [A, B],
       availability_lower: [0.5, 0.505], longest_known_hidden_s: [86400, 36000] },
     /about the same availability \(50\.0% and 50\.5%\).*1 d versus 10 h/],
    [{ fact: "unresolved_time_matters", target: "earth_center", sites: [A] }, /has a wide gap between the lower and upper/],
  ];
  it.each(cases)("phrases %j", (fact, re) => expect(factText(fact)).toMatch(re));

  it("never ranks or scores", () => {
    for (const [f] of cases) expect(factText(f)).not.toMatch(/\b(best|worst|winner|rank(ed)? #|score)\b/i);
  });

  it("labels held-constant fields in words and units", () => {
    expect(fieldLabel("terrain.radius_km")).toBe("Horizon radius");
    expect(fieldValue("terrain.radius_km", 150)).toBe("150 km");
    expect(fieldValue("mission.duration_s", 604800)).toBe("7 d");
    expect(fieldValue("requirements.sun_min_availability", 0.6)).toBe("at least 60%");
    expect(fieldValue("resource.dem", "09b7ca80f9e6a146f970225d18af72fc02787669b3ef51b888e347d2b6845649")).toBe("09b7ca80f9e6a146…");
    expect(fieldLabel("something.new")).toBe("something.new");
  });
});

describe("BFF allow-list for comparisons", () => {
  it("allows POST /comparisons with a small body limit and nothing else", () => {
    expect(matchRoute("POST", ["comparisons"], new URLSearchParams())).toMatchObject({
      ok: true, match: { upstreamPath: "/api/v1/comparisons", maxBodyBytes: 4096 },
    });
    expect(matchRoute("GET", ["comparisons"], new URLSearchParams())).toMatchObject({ ok: false, reason: "method_not_allowed" });
    expect(matchRoute("POST", ["comparisons", "x"], new URLSearchParams())).toMatchObject({ ok: false, reason: "not_found" });
  });
});

const row = (outcome: string, lo: number, hi: number, longest: number, events = 0) => ({
  outcome, availability_lower: lo, availability_upper: hi, margin_lower: 0, margin_upper: 0,
  longest_known_hidden_s: longest, worst_case_not_visible_s: longest, events, exclusion_reasons: [],
});
const interval = (cls: string, a: number, b: number) => ({
  start_s: a, end_s: b, class: cls,
  start_utc: new Date(Date.UTC(2027, 0, 10) + a * 1000).toISOString(),
  end_utc: new Date(Date.UTC(2027, 0, 10) + b * 1000).toISOString(),
});
const block = (ivs: unknown[]) => ({
  metrics: { outcome: "FAIL", availability_lower: 0, availability_upper: 0, threshold: 0.6, longest_known_hidden_s: 0, margin_lower: 0, margin_upper: 0,
    visible_s: 0, hidden_s: 0, unknown_s: 0, exclusion_reasons: [], known_time_fraction: null, longest_known_hidden_start: null,
    longest_known_hidden_end: null, worst_case_not_visible_s: 0 },
  clearance_at_nodes: null, countdown_at_start: { kind: "x", text: "x" }, intervals: ivs, events: [],
});
const results = {
  run_id: RUN, result_id: "r", status: "complete_with_warnings", result_state: "real_data_unverified", warnings: [],
  sites: [A, B, C].map((id) => ({
    site_id: id, validity: "unverified", site_status: "FAIL_SUN", result_state: "real_data_unverified", warnings: [],
    target_metrics: {
      sun_center: { terrain: block([interval("H", 0, 3600)]), flat: block([interval("V", 0, 3600)]) },
      earth_center: { terrain: block([interval("V", 0, 3600)]), flat: block([interval("V", 0, 3600)]) },
    },
  })),
};
const comparison = (ids: string[]): ComparisonResponse => ({
  mode: "sites_in_run", run_id: RUN, result_state: "real_data_unverified", compatible: true, alignment: "single shared simulation time",
  held_constant: [{ field: "mission.duration_s", value: 604800 }, { field: "terrain.radius_km", value: 150 }],
  changed: [{ field: "site", values: ids.map((s) => ({ site_id: s, lat_deg: -89.5, lon_east_deg: 0, ground_height_m: -722 })) }],
  site_status: Object.fromEntries(ids.map((s) => [s, "FAIL_SUN"])) as ComparisonResponse["site_status"],
  targets: {
    sun_center: { sites: ids.map((s) => ({ site_id: s, terrain: row("FAIL", 0, 0, 604800) as never, flat: row("PASS", 1, 1, 0) as never })),
      spread: { availability_lower_min: 0, availability_lower_max: 0, availability_lower_range: 0 } },
    earth_center: { sites: ids.map((s, i) => ({ site_id: s, terrain: row("PASS", 0.7 - i * 0.1, 0.71 - i * 0.1, 3600, 1) as never, flat: row("PASS", 0.9, 0.9, 0) as never })),
      spread: { availability_lower_min: 0.5, availability_lower_max: 0.7, availability_lower_range: 0.2 } },
  },
  facts: [{ fact: "terrain_changes_outcome", site_id: ids[0], target: "sun_center", flat_outcome: "PASS", terrain_outcome: "FAIL",
            flat_availability_lower: 1, terrain_availability_lower: 0 }],
  caveats: ["Screening and education only."], warnings: ["UNVERIFIED"], validated_scopes: [], verified: false,
});

let posts: { runs: string[]; sites: string[] }[] = [];
function stub() {
  posts = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/comparisons")) {
      const body = JSON.parse(String(init?.body));
      posts.push(body);
      return new Response(JSON.stringify(comparison(body.sites)), { headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify(results), { headers: { "content-type": "application/json" } });
  }));
}
afterEach(() => vi.unstubAllGlobals());

describe("CompareView", () => {
  it("asks the service to compare the chosen sites and shows its facts, held-constant list and both targets", async () => {
    stub();
    render(<CompareView runId={RUN} />);
    expect(await screen.findByText("Held constant (identical for every site)")).toBeInTheDocument();
    expect(posts[0]).toEqual({ runs: [RUN], sites: [A, B, C] });
    const held = screen.getByText("Held constant (identical for every site)").closest("div") as HTMLElement;
    expect(within(held).getByText("150 km")).toBeInTheDocument();
    expect(within(held).getByText("7 d")).toBeInTheDocument();
    expect(screen.getByText(/terrain changes the Sun result/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Real data, unverified/ })).toBeInTheDocument();
    for (const name of ["Sun", "Earth"]) expect(screen.getByRole("heading", { name, level: 2 })).toBeInTheDocument();
    // one timeline per target, with a row per site
    expect(screen.getAllByRole("img", { name: /one row per site, same time axis/ })).toHaveLength(2);
  });

  it("needs at least two sites and recomputes when the selection changes", async () => {
    stub();
    render(<CompareView runId={RUN} />);
    await screen.findByText("Held constant (identical for every site)");
    fireEvent.click(screen.getByLabelText("89.5°S, 240°E"));
    await waitFor(() => expect(posts.at(-1)?.sites).toEqual([A, B]));
    fireEvent.click(screen.getByLabelText("89.5°S, 120°E"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose at least two sites.");
    expect(posts.at(-1)?.sites).toEqual([A, B]); // no request with one site
  });

  it("shows no winner, rank or score, and keeps the flat horizon as a labelled comparison", async () => {
    stub();
    render(<CompareView runId={RUN} />);
    await screen.findByText("Held constant (identical for every site)");
    expect(document.body.textContent).not.toMatch(/\b(winner|score|ranking|best site)\b/i);
    expect(screen.getAllByText("Flat horizon (comparison)")).toHaveLength(2);
    expect(screen.getAllByText("Terrain-aware (decides)")).toHaveLength(2);
    const sunTable = screen.getAllByRole("table")[0];
    expect(within(sunTable).getAllByText("Fail").length).toBeGreaterThan(0);
  });

  it("reports a service failure instead of an empty comparison", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "NOT_READY", message: "run is queued", field: null, retryable: true, correlation_id: "c" } }), { status: 409 })));
    render(<CompareView runId={RUN} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("run is queued");
  });
});
