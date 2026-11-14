import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import WhySouthPoleIsHard from "@/app/why-the-south-pole-is-hard/page";
import { TimelineView } from "@/components/TimelineView";
import { ViewModeToggle, setViewMode } from "@/components/ViewMode";
import { KNOWN_CODES, plainFact, type Fact } from "@/lib/guided";

const json = (x: unknown) => new Response(JSON.stringify(x), { headers: { "content-type": "application/json" } });
afterEach(() => {
  vi.unstubAllGlobals();
  act(() => setViewMode("guided"));
  localStorage.clear();
});

const fact = (code: string, params: Record<string, unknown> = {}, text = "service wording"): Fact => ({ code, text, params });

describe("guided templates", () => {
  it("has a template for every fact code the service can emit (drift guard)", () => {
    const py = readFileSync("science/lunascope/explain.py", "utf-8");
    const codes = Array.from(py.matchAll(/add\(\s*"([A-Z_]+)"/g)).map((m) => m[1]);
    expect(codes.length).toBeGreaterThanOrEqual(8);
    for (const c of codes) expect(KNOWN_CODES, `no guided template for ${c}`).toContain(c);
  });

  const cases: [Fact, "sun_center" | "earth_center", RegExp][] = [
    [fact("HIDDEN_WHOLE_WINDOW"), "sun_center", /The Sun stays below the ridges and crater walls.*no sunlight here/],
    [fact("HIDDEN_WHOLE_WINDOW"), "earth_center", /Earth stays below the ridges and crater walls.*so there is no direct line of sight to Earth here/],
    [fact("CLOSEST_APPROACH_BELOW", { max_clearance_deg: -5.78 }), "sun_center", /highest sampled moment, the Sun is still 5\.8° below the skyline/],
    [fact("VISIBLE_WHOLE_WINDOW"), "earth_center", /clearly above the terrain skyline for the whole window/],
    [fact("AVAILABILITY_RANGE", { lower: 0.745, upper: 0.745 }), "earth_center", /available about 75% of the time/],
    [fact("AVAILABILITY_RANGE", { lower: 0.745, upper: 0.7469 }), "earth_center", /between 74\.5% and 74\.7%.*could not settle/],
    [fact("UNRESOLVED_TIME", { unresolved_s: 4 * 3600 }), "sun_center", /about 4 hours.*left as unknown, never counted as hidden/],
    [fact("LONGEST_HIDDEN", { seconds: 3 * 86400 }), "sun_center", /longest stretch without sunlight is about 3 days/],
    [fact("TERRAIN_CHANGES_OUTCOME", { flat_outcome: "PASS", terrain_outcome: "FAIL" }), "sun_center", /flat-horizon estimate would call this a pass.*it is a fail.*terrain is what changes/],
    [fact("TERRAIN_REDUCES_AVAILABILITY", { flat: 1, terrain: 0.7 }), "sun_center", /flat horizon sunlight would be available 100%.*down to 70%/i],
    [fact("EXCLUDED", { reasons: ["x"] }), "sun_center", /left out rather than failed/],
  ];
  it.each(cases)("phrases %j", (f, t, re) => expect(plainFact(f, t)).toMatch(re));

  it("falls back to the service's own wording for an unknown code or missing numbers, and never invents", () => {
    expect(plainFact(fact("SOMETHING_NEW", {}, "The service said this."), "sun_center")).toBe("The service said this.");
    expect(plainFact(fact("LONGEST_HIDDEN", {}, "service text"), "sun_center")).toBe("service text");
    expect(plainFact(fact("AVAILABILITY_RANGE", { lower: "x" }, "service text"), "sun_center")).toBe("service text");
  });

  it("never calls unknown time hidden, and never ranks, scores or recommends", () => {
    const all = [
      plainFact(fact("UNRESOLVED_TIME", { unresolved_s: 7200 }), "sun_center"),
      ...cases.map(([f, t]) => plainFact(f, t)),
    ].join(" ");
    expect(plainFact(fact("UNRESOLVED_TIME", { unresolved_s: 7200 }), "sun_center")).not.toMatch(/not visible|is hidden/);
    expect(all).not.toMatch(/\b(best|worst|winner|recommend|score|rank)/i);
  });
});

describe("ViewModeToggle", () => {
  it("defaults to guided, switches, and remembers the choice", () => {
    const { unmount } = render(<ViewModeToggle />);
    const guided = screen.getByRole("button", { name: "Guided" });
    const technical = screen.getByRole("button", { name: "Technical" });
    expect(guided).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(technical);
    expect(technical).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("lunascope.view-mode")).toBe("technical");
    unmount();
    render(<ViewModeToggle />);
    expect(screen.getByRole("button", { name: "Technical" })).toHaveAttribute("aria-pressed", "true");
  });

  it("still works when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<ViewModeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Technical" }));
    expect(screen.getByRole("button", { name: "Technical" })).toHaveAttribute("aria-pressed", "true");
    vi.restoreAllMocks();
  });
});

const metrics = (outcome: string) => ({
  outcome, availability_lower: 0, availability_upper: 0, threshold: 0.6, longest_known_hidden_s: 604800, margin_lower: 0, margin_upper: 0,
  visible_s: 0, hidden_s: 604800, unknown_s: 0, exclusion_reasons: [], known_time_fraction: 1, longest_known_hidden_start: 0,
  longest_known_hidden_end: 604800, worst_case_not_visible_s: 0,
});
const iv = (cls: string) => ({ start_s: 0, end_s: 604800, class: cls, start_utc: "2027-01-10T00:00:00.000Z", end_utc: "2027-01-17T00:00:00.000Z" });
const block = (o: string, cls: string) => ({
  metrics: metrics(o), clearance_at_nodes: { min_deg: -9, median_deg: -7, max_deg: -5.78, samples: 1009 },
  countdown_at_start: { kind: "no_event", text: "No change before the end of the computed window" }, intervals: [iv(cls)], events: [],
});
const results = {
  run_id: "d".repeat(64), result_id: "r", status: "complete_with_warnings", result_state: "real_data_unverified", warnings: [],
  sites: [{ site_id: "rule-89.5S-E0", validity: "unverified", site_status: "FAIL_SUN", result_state: "real_data_unverified", warnings: [],
    target_metrics: {
      sun_center: { terrain: block("FAIL", "H"), flat: block("PASS", "V"), explanations: [
        { code: "HIDDEN_WHOLE_WINDOW", text: "The target is below the terrain skyline for the whole computed window.", params: { hidden_s: 604800 } },
        { code: "CLOSEST_APPROACH_BELOW", text: "At its highest the target is 5.8 deg below the skyline (sampled at 1009 nodes).", params: { max_clearance_deg: -5.78 } },
        { code: "TERRAIN_CHANGES_OUTCOME", text: "With a flat horizon the outcome is PASS; with this terrain it is FAIL.", params: { flat_outcome: "PASS", terrain_outcome: "FAIL" } },
      ] },
      earth_center: { terrain: block("FAIL", "H"), flat: block("PASS", "V"), explanations: [] },
    } }],
};

describe("Timeline guided and technical views", () => {
  it("shows plain sentences in guided mode and the service's own facts in technical mode", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(results)));
    render(<TimelineView runId={"d".repeat(64)} siteId="rule-89.5S-E0" />);
    const sun = (await screen.findByRole("region", { name: "Sun summary" }));
    expect(within(sun).getByText("In plain words")).toBeInTheDocument();
    expect(within(sun).getByText(/stays below the ridges and crater walls on the horizon for every moment computed/)).toBeInTheDocument();
    expect(within(sun).getByText(/flat-horizon estimate would call this a pass/)).toBeInTheDocument();
    expect(within(sun).queryByText(/The target is below the terrain skyline for the whole computed window\./)).toBeNull();
    // the numbers are still there beside the sentences
    expect(within(sun).getByText("Longest known hidden")).toBeInTheDocument();

    act(() => setViewMode("technical"));
    expect(within(sun).getByText("Facts from the service")).toBeInTheDocument();
    expect(within(sun).getByText("The target is below the terrain skyline for the whole computed window.")).toBeInTheDocument();
    expect(within(sun).queryByText(/stays below the ridges and crater walls/)).toBeNull();
  });
});

describe("explainer page", () => {
  it("answers why it is hard, labels its diagram a schematic, and stays within what it can support", () => {
    render(<WhySouthPoleIsHard />);
    expect(screen.getByRole("heading", { level: 1, name: "Why the south pole is hard" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Schematic: the Sun is above a flat horizon but hidden behind a ridge/ })).toBeInTheDocument();
    expect(screen.getByText(/Schematic, not to scale and not computed from data/)).toBeInTheDocument();
    expect(screen.getByText(/What this page is not/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start the reference mission" })).toHaveAttribute("href", "/");
    expect(document.body.textContent).not.toMatch(/\b(NASA (endorse|approved)|guarantee|certif(ied|ies) )/i);
  });
});
