import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EvidencePanel } from "@/components/EvidencePanel";

const RUN = "d".repeat(64);
const json = (x: unknown) => new Response(JSON.stringify(x), { headers: { "content-type": "application/json" } });
afterEach(() => vi.unstubAllGlobals());

const reading = (outcome: string, lo: number, hi = lo, hidden = 0) => ({
  margin_deg: 0, outcome, availability_lower: lo, availability_upper: hi, longest_known_hidden_s: hidden, events: 1,
});
const target = (r: number, up: ReturnType<typeof reading>, c: ReturnType<typeof reading>, whole: ReturnType<typeof reading>) => ({
  angular_radius_deg: r,
  centre: { outcome: c.outcome, availability_lower: c.availability_lower, availability_upper: c.availability_upper, longest_known_hidden_s: c.longest_known_hidden_s },
  upper_limb: up, whole_disk: whole,
  outcome_changes: { upper_limb: up.outcome !== c.outcome, whole_disk: whole.outcome !== c.outcome },
  matters: up.outcome !== c.outcome || whole.outcome !== c.outcome,
});
const NOTE = "The main result uses the centre of each disc. These two cases bracket that assumption. Earth's varies; not modelled.";
const stable = { schema: "lunascope.disk_edge/1", note: NOTE, matters: false, targets: {
  sun_center: target(0.27, reading("FAIL", 0), reading("FAIL", 0), reading("FAIL", 0, 0, 604800)),
  earth_center: target(0.95, reading("PASS", 0.8), reading("PASS", 0.75), reading("PASS", 0.7)) } };
const sensitive = { schema: "lunascope.disk_edge/1", note: NOTE, matters: true, targets: {
  earth_center: target(0.95, reading("PASS", 0.9), reading("FAIL", 0.4, 0.42, 86400), reading("FAIL", 0.1, 0.1, 172800)) } };

const site = (id: string, disk_edge: unknown) => ({
  site_id: id, observer: { ground_height_m: 0, lat_deg: -89.5, lon_deg_east: 0 }, geometry: {}, caveats: ["Screening only."], disk_edge,
});
const provenance = (sites: unknown[]) => ({
  run_id: RUN, result_id: "f".repeat(64), algorithm_id: "x", result_state: "real_data_unverified", verified: false,
  validated_scopes: [], resources: [], sites,
});
const validation = { run_id: RUN, result_state: "real_data_unverified", scopes_closed: [], note: "n", summary: { met: 0, not_met: 0, not_evaluated: 0 }, cards: [], groups: [] };

function show(sites: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async (u: string) => json(String(u).includes("/validation") ? validation : provenance(sites))));
  return render(<EvidencePanel runId={RUN} />);
}

describe("Evidence: disc size, centre or edge", () => {
  it("shows three readings per target, with the centre marked as the one used", async () => {
    show([site("rule-89.5S-E0", stable)]);
    const section = (await screen.findByRole("heading", { name: "Disc size: centre or edge?" })).closest("section") as HTMLElement;
    for (const h of ["Upper limb", "Centre (used)", "Whole disc"]) expect(within(section).getByRole("columnheader", { name: h })).toBeInTheDocument();
    expect(within(section).getByText("radius 0.95°")).toBeInTheDocument();
    expect(within(section).getByText("radius 0.27°")).toBeInTheDocument();
    expect(within(section).getByText(/no outcome changes between the upper limb, the centre and the whole disc/)).toBeInTheDocument();
    expect(within(section).queryByText("changed")).toBeNull();
    expect(within(section).getByText(/Earth is about 1.9° across/)).toBeInTheDocument();
    expect(within(section).getByText(/not modelled/)).toBeInTheDocument();
  });

  it("flags in words, not only colour, when the disc size changes an outcome", async () => {
    show([site("rule-89.5S-E0", sensitive)]);
    const section = (await screen.findByRole("heading", { name: "Disc size: centre or edge?" })).closest("section") as HTMLElement;
    expect(within(section).getByText(/treating the disc as a point changes an outcome here/)).toBeInTheDocument();
    expect(within(section).getAllByText("changed")).toHaveLength(1); // the upper limb differs; the whole disc matches the centre
    expect(within(section).getAllByText("Pass").length).toBeGreaterThan(0);
    expect(within(section).getAllByText("Fail").length).toBeGreaterThan(0);
    expect(within(section).getByText("longest hidden 2 d")).toBeInTheDocument();
  });

  it("says plainly when a result was made before the check existed, and never invents numbers", async () => {
    show([site("rule-89.5S-E0", null)]);
    expect(await screen.findByText(/Not computed for this analysis: it was made before this check existed/)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /disc reading/ })).toBeNull();
  });

  it("handles a mix: sites that have it show it, others say not computed", async () => {
    show([site("rule-89.5S-E0", stable), site("rule-89.5S-E120", undefined)]);
    expect(await screen.findByRole("table", { name: /89\.5°S, 0°E: availability and outcome by disc reading/ })).toBeInTheDocument();
    expect(screen.getByText("89.5°S, 120°E: not computed for this result.")).toBeInTheDocument();
  });
});
