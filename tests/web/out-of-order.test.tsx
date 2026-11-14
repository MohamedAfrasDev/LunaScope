import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompareView } from "@/components/CompareView";
import { RunView } from "@/components/RunView";
import { SkyView } from "@/components/SkyView";

/**
 * Test case 15: out-of-order responses never overwrite what the user is looking at now.
 * Every fetch here IGNORES the abort signal and answers when the test says so, which is the worst case:
 * a reply for an earlier choice arrives after the reply for the current one.
 */
const json = (x: unknown) => new Response(JSON.stringify(x), { headers: { "content-type": "application/json" } });
afterEach(() => vi.unstubAllGlobals());

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

// ----------------------------------------------------------------------------- Run page
const RUN_A = "a".repeat(64);
const RUN_B = "b".repeat(64);
const summary = (id: string, site: string) => ({
  run_id: id, result_id: "r", status: "complete", stage: "done", progress: 1, result_state: "synthetic_demonstration",
  attempt: 1, created_utc: "x", finished_utc: "x", algorithm_id: "a", warnings: [], verified: false,
  matrix: [{ site_id: site, site_status: "PASS", targets: {
    sun_center: { terrain: { outcome: "PASS", availability_lower: 1, availability_upper: 1, threshold: 0.6 }, flat: { outcome: "PASS", availability_lower: 1, availability_upper: 1, threshold: 0.6 } },
    earth_center: { terrain: { outcome: "PASS", availability_lower: 1, availability_upper: 1, threshold: 0.5 }, flat: { outcome: "PASS", availability_lower: 1, availability_upper: 1, threshold: 0.5 } } } }],
});

describe("run page", () => {
  it("a late reply for the previous run does not replace the run now shown", async () => {
    const a = deferred<Response>();
    const b = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn((u: string) => {
      const url = String(u);
      if (url.includes(`analyses/${RUN_A}`) && !url.includes("/")) return a.promise;
      if (url.endsWith(`/analyses/${RUN_A}`)) return a.promise;
      if (url.endsWith(`/analyses/${RUN_B}`)) return b.promise;
      return Promise.resolve(json({ error: { code: "NOT_FOUND", message: "x", field: null, retryable: false, correlation_id: null } }));
    }));
    const { rerender } = render(<RunView key={RUN_A} runId={RUN_A} />);
    rerender(<RunView key={RUN_B} runId={RUN_B} />);
    await act(async () => b.resolve(json(summary(RUN_B, "rule-89.5S-E120"))));
    expect(await screen.findByText("89.5°S, 120°E")).toBeInTheDocument();
    await act(async () => a.resolve(json(summary(RUN_A, "rule-89.5S-E0")))); // the old run answers last
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("89.5°S, 0°E")).toBeNull();
    expect(screen.getByText("89.5°S, 120°E")).toBeInTheDocument();
  });
});

// ----------------------------------------------------------------------------- Compare
const SITES = ["rule-89.5S-E0", "rule-89.5S-E120", "rule-89.5S-E240"];
const cell = (o: string) => ({ outcome: o, availability_lower: 0, availability_upper: 0, margin_lower: 0, margin_upper: 0, longest_known_hidden_s: 0, worst_case_not_visible_s: 0, events: 0, exclusion_reasons: [] });
const block = () => ({
  metrics: { outcome: "FAIL", availability_lower: 0, availability_upper: 0, threshold: 0.6, longest_known_hidden_s: 0, margin_lower: 0, margin_upper: 0, visible_s: 0, hidden_s: 0, unknown_s: 0, exclusion_reasons: [], known_time_fraction: 1, longest_known_hidden_start: null, longest_known_hidden_end: null, worst_case_not_visible_s: 0 },
  clearance_at_nodes: null, countdown_at_start: { kind: "x", text: "x" },
  intervals: [{ start_s: 0, end_s: 3600, class: "H", start_utc: "2027-01-10T00:00:00Z", end_utc: "2027-01-10T01:00:00Z" }], events: [],
});
const compareResults = {
  run_id: RUN_A, result_id: "r", status: "complete", result_state: "synthetic_demonstration", warnings: [],
  sites: SITES.map((id) => ({ site_id: id, validity: "unverified", site_status: "FAIL_SUN", result_state: "synthetic_demonstration", warnings: [],
    target_metrics: { sun_center: { terrain: block(), flat: block() }, earth_center: { terrain: block(), flat: block() } } })),
};
const comparison = (ids: string[]) => ({
  mode: "sites_in_run", run_id: RUN_A, result_state: "synthetic_demonstration", compatible: true, alignment: "x",
  held_constant: [{ field: "terrain.radius_km", value: 150 }],
  changed: [{ field: "site", values: ids.map((s) => ({ site_id: s, lat_deg: -89.5, lon_east_deg: 0, ground_height_m: 0 })) }],
  site_status: Object.fromEntries(ids.map((s) => [s, "FAIL_SUN"])),
  targets: Object.fromEntries(["sun_center", "earth_center"].map((t) => [t, { sites: ids.map((s) => ({ site_id: s, terrain: cell("FAIL"), flat: cell("PASS") })),
    spread: { availability_lower_min: 0, availability_lower_max: 0, availability_lower_range: 0 } }])),
  facts: [{ fact: "outcomes_same", target: "sun_center", outcomes: Object.fromEntries(ids.map((s) => [s, "FAIL"])) }],
  caveats: [], warnings: [], validated_scopes: [], verified: false,
});

describe("compare page", () => {
  it("a late comparison for the earlier selection does not replace the one for the current selection", async () => {
    const pending: Record<string, ReturnType<typeof deferred<Response>>> = {};
    vi.stubGlobal("fetch", vi.fn((u: string, init?: RequestInit) => {
      if (String(u).includes("/comparisons")) {
        const key = (JSON.parse(String(init?.body)).sites as string[]).join("+");
        pending[key] = deferred<Response>();
        return pending[key].promise;
      }
      return Promise.resolve(json(compareResults));
    }));
    render(<CompareView runId={RUN_A} />);
    await waitFor(() => expect(Object.keys(pending)).toHaveLength(1)); // all three sites requested first
    fireEvent.click(screen.getByLabelText("89.5°S, 240°E")); // the user narrows to two sites
    await waitFor(() => expect(Object.keys(pending)).toHaveLength(2));
    const two = SITES.slice(0, 2);
    await act(async () => pending[two.join("+")].resolve(json(comparison(two))));
    expect(await screen.findByText(/same outcome/)).toBeInTheDocument();
    await act(async () => pending[SITES.join("+")].resolve(json(comparison(SITES)))); // the three-site reply is late
    await new Promise((r) => setTimeout(r, 20));
    const rows = screen.getAllByRole("row").map((r) => r.textContent ?? "").join(" ");
    expect(rows).not.toMatch(/240°E/); // still the two-site comparison
  });
});

// ----------------------------------------------------------------------------- Sky countdown
const iv = (cls: string, a: number, b: number) => ({ start_s: a, end_s: b, class: cls, start_utc: "2027-01-10T00:00:00Z", end_utc: "2027-01-10T01:00:00Z" });
const SKY_RUN = "c".repeat(64);
const SITE = "rule-89.5S-E0";
const skyBlock = () => ({ metrics: { availability_lower: 0.4, availability_upper: 0.45, outcome: "FAIL", threshold: 0.6 }, clearance_at_nodes: null,
  countdown_at_start: { kind: "set", text: "x" }, intervals: [iv("V", 0, 3000)], events: [] });
const skyResults = { run_id: SKY_RUN, result_id: "r", status: "complete", result_state: "synthetic_demonstration", warnings: [],
  sites: [{ site_id: SITE, validity: "unverified", site_status: "FAIL_SUN", result_state: "synthetic_demonstration", warnings: [],
    target_metrics: { sun_center: { terrain: skyBlock(), series: { step_s: 600, az_deg: [1, 2, 3, 4, 5, 6], el_deg: [2, 2, 2, 2, 2, 2] } },
      earth_center: { terrain: skyBlock(), series: { step_s: 600, az_deg: [1, 2, 3, 4, 5, 6], el_deg: [5, 5, 5, 5, 5, 5] } } } }] };
const skyProfile = { site_id: SITE, result_state: "synthetic_demonstration", settings: { radius_km: 20, az_step_deg: 90 },
  azimuth_deg: [0, 90, 180, 270], horizon_el_deg: [1, 2, 3, 4], argmax_distance_km: [], sector_state: [],
  sectors: { certified: 4, coverage_limited: 0, unsupported: 0 }, skyline_min_deg: 1, skyline_max_deg: 4 };

describe("sky countdown", () => {
  it("a late countdown for an earlier cursor position does not replace the current one", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    const byT: Record<string, ReturnType<typeof deferred<Response>>> = {};
    vi.stubGlobal("fetch", vi.fn((u: string) => {
      const url = String(u);
      if (url.includes("/countdown")) {
        const t = new URL(url, "http://x").searchParams.get("t") as string;
        byT[t] = deferred<Response>();
        return byT[t].promise;
      }
      return Promise.resolve(json(url.includes("/horizon/") ? skyProfile : skyResults));
    }));
    const answer = (t: number, text: string) => json({ run_id: SKY_RUN, site_id: SITE, horizon: "terrain", result_state: "synthetic_demonstration",
      state: "V", t, mission_end: 3000, kind: "set", at: 2000, remaining_s: 2000 - t, solver_bracket_s: 1, text });
    render(<SkyView runId={SKY_RUN} siteId={SITE} />);
    await waitFor(() => expect(byT["0.0"]).toBeDefined(), { timeout: 3000 }); // the cursor starts at 0
    fireEvent.change(screen.getByRole("slider"), { target: { value: "600" } });
    await waitFor(() => expect(byT["600.0"]).toBeDefined(), { timeout: 3000 });
    await act(async () => byT["600.0"].resolve(answer(600, "CURRENT answer")));
    expect(await screen.findAllByText(/CURRENT answer/)).not.toHaveLength(0);
    await act(async () => byT["0.0"].resolve(answer(0, "STALE answer"))); // the reply for the old position arrives last
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/STALE answer/)).toBeNull();
    expect(screen.getAllByText(/CURRENT answer/).length).toBeGreaterThan(0);
  });
});
