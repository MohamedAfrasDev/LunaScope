import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimelineView } from "@/components/TimelineView";

const RUN = "d".repeat(64);
const json = (x: unknown) => new Response(JSON.stringify(x), { headers: { "content-type": "application/json" } });
afterEach(() => vi.unstubAllGlobals());

const metrics = (outcome: string, lo: number, hi: number) => ({
  outcome, availability_lower: lo, availability_upper: hi, threshold: 0.6, longest_known_hidden_s: 604800, margin_lower: 0, margin_upper: 0,
  visible_s: 0, hidden_s: 604800, unknown_s: 0, exclusion_reasons: [], known_time_fraction: 1, longest_known_hidden_start: 0,
  longest_known_hidden_end: 604800, worst_case_not_visible_s: 0,
});
const iv = (cls: string) => ({ start_s: 0, end_s: 604800, class: cls, start_utc: "2027-01-10T00:00:00.000Z", end_utc: "2027-01-17T00:00:00.000Z" });
const block = (o: string, cls: string, lo: number, hi: number, events: unknown[] = []) => ({
  metrics: metrics(o, lo, hi), clearance_at_nodes: { min_deg: -9, median_deg: -7, max_deg: -5.78, samples: 1009 },
  countdown_at_start: { kind: "no_event", text: "No change before the end of the computed window" }, intervals: [iv(cls)], events,
});
const rise = { t_s: 3600, t_utc: "2027-01-10T01:00:00.000Z", type: "rise", solver_bracket_s: 1, geometry_timing_bound_s: 0.05 };
const variant = {
  variant: "azimuth_step_halved", sensitivity_high: false, tolerance_availability: 0.01,
  targets: { sun_center: { delta_lower: 0, outcome_changed: false, outcome_base: "FAIL", outcome_variant: "FAIL", event_count_base: 0, event_count_variant: 0, max_event_shift_s: 0 } },
};
const results = {
  run_id: RUN, result_id: "r", status: "complete_with_warnings", result_state: "real_data_unverified", warnings: [],
  sites: [{ site_id: "rule-89.5S-E0", validity: "unverified", site_status: "FAIL_SUN", result_state: "real_data_unverified",
    warnings: ["UNVERIFIED", "EOP_PREDICTED"], sensitivity: [variant],
    target_metrics: {
      sun_center: { terrain: block("FAIL", "H", 0, 0), flat: block("PASS", "V", 1, 1), explanations: [] },
      earth_center: { terrain: block("PASS", "V", 0.745, 0.747, [rise]), flat: block("PASS", "V", 0.92, 0.924), explanations: [] },
    } }],
};

async function show() {
  vi.stubGlobal("fetch", vi.fn(async () => json(results)));
  render(<TimelineView runId={RUN} siteId="rule-89.5S-E0" />);
  return screen.findByRole("list", { name: "Verdict by requirement" });
}

describe("Timeline hierarchy", () => {
  it("opens with one verdict per requirement: icon, word, the bound, the requirement and the flat-horizon comparison", async () => {
    const list = await show();
    const [sun, earth] = within(list).getAllByRole("listitem");
    expect(within(sun).getByText("Sun")).toBeInTheDocument();
    expect(within(sun).getByText("Fail")).toBeInTheDocument();
    expect(within(sun).getByText("0.00%")).toBeInTheDocument();
    expect(sun).toHaveTextContent(/needs at least 60%\. Flat horizon would give 100\.00%/);
    expect(within(earth).getByText("Pass")).toBeInTheDocument();
    expect(within(earth).getByText("74.50–74.70%")).toBeInTheDocument(); // a bound, not a point
  });

  it("puts the chart before the per-requirement detail, with the download beside the legend", async () => {
    const list = await show();
    const chart = screen.getByRole("img", { name: /Visibility timeline for 89.5°S, 0°E/ });
    const detail = screen.getByRole("region", { name: "Sun summary" });
    const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(list, chart)).toBe(true);
    expect(follows(chart, detail)).toBe(true);
    expect(screen.getByRole("button", { name: "Download intervals (CSV)" })).toBeVisible();
  });

  it("keeps the detail sections and their pinned headings", async () => {
    await show();
    for (const n of ["Sun summary", "Earth summary"]) expect(screen.getByRole("region", { name: n })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Sensitivity" })).toBeInTheDocument();
  });

  it("collapses events, warnings and the sensitivity table, and counts them", async () => {
    await show();
    const events = screen.getByText("Predicted events (1)").closest("details")!;
    expect(events).not.toHaveAttribute("open");
    expect(within(events).getByText(/Earth rise/)).toBeInTheDocument();

    const warn = screen.getByText("Warnings carried with these results (2)").closest("details")!;
    expect(warn).not.toHaveAttribute("open");
    expect(within(warn).getByText("UNVERIFIED")).toBeInTheDocument();

    // the sensitivity verdict stays visible; only its table is behind a click
    const sens = screen.getByRole("region", { name: "Sensitivity" });
    expect(within(sens).getByRole("heading", { name: /Half the azimuth step/ })).toBeInTheDocument();
    expect(within(sens).getByText("Within tolerance")).toBeInTheDocument();
    expect(within(sens).getByText("Differences from the base run").closest("details")).not.toHaveAttribute("open");
  });

  it("marks the Sun and Earth chart rows with their shapes, and the word still names each row", async () => {
    await show();
    const svg = screen.getByRole("img", { name: /Visibility timeline/ });
    expect(svg.querySelectorAll('circle[aria-hidden="true"]').length).toBe(2); // Sun, terrain and flat rows
    expect(svg.querySelectorAll('path[aria-hidden="true"]').length).toBe(2); // Earth rows
    expect(svg.textContent).toContain("Sun");
    expect(svg.textContent).toContain("Earth");
  });
});
