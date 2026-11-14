import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkyView } from "@/components/SkyView";
import { variantRange } from "@/lib/sky";

const json = (x: unknown) => new Response(JSON.stringify(x), { headers: { "content-type": "application/json" } });
afterEach(() => vi.unstubAllGlobals());

const row = (shift: number, base = 1, variant = 1) => ({ max_event_shift_s: shift, event_count_base: base, event_count_variant: variant });

describe("variantRange", () => {
  it("takes the largest shift across variants and notes a changed event count", () => {
    const r = variantRange([{ targets: { sun_center: row(12) } }, { targets: { sun_center: row(90, 1, 2) } }], "sun_center");
    expect(r).toEqual({ maxShiftS: 90, countChanged: true, variants: 2 });
  });
  it("is null when there is nothing to report for the target", () => {
    expect(variantRange(undefined, "sun_center")).toBeNull();
    expect(variantRange([], "sun_center")).toBeNull();
    expect(variantRange([{ targets: { earth_center: row(5) } }], "sun_center")).toBeNull();
  });
});

const RUN = "c".repeat(64);
const SITE = "rule-89.5S-E0";
const iv = (cls: string, a: number, b: number) => ({ start_s: a, end_s: b, class: cls, start_utc: "2027-01-10T00:00:00Z", end_utc: "2027-01-10T01:00:00Z" });
const block = () => ({ metrics: { availability_lower: 0.4, availability_upper: 0.45, outcome: "FAIL", threshold: 0.6 }, clearance_at_nodes: null,
  countdown_at_start: { kind: "set", text: "x" }, intervals: [iv("V", 0, 3000)], events: [] });
const results = (sensitivity?: unknown) => ({ run_id: RUN, result_id: "r", status: "complete", result_state: "synthetic_demonstration", warnings: [],
  sites: [{ site_id: SITE, validity: "unverified", site_status: "FAIL_SUN", result_state: "synthetic_demonstration", warnings: [], sensitivity,
    target_metrics: {
      sun_center: { terrain: block(), series: { step_s: 600, az_deg: [1, 2, 3, 4, 5, 6], el_deg: [2, 2, 2, 2, 2, 2] } },
      earth_center: { terrain: block(), series: { step_s: 600, az_deg: [1, 2, 3, 4, 5, 6], el_deg: [5, 5, 5, 5, 5, 5] } } } }] });
const profile = { site_id: SITE, result_state: "synthetic_demonstration", settings: { radius_km: 20, az_step_deg: 90 }, azimuth_deg: [0, 90, 180, 270],
  horizon_el_deg: [1, 2, 3, 4], argmax_distance_km: [], sector_state: [], sectors: { certified: 4, coverage_limited: 0, unsupported: 0 }, skyline_min_deg: 1, skyline_max_deg: 4 };
const variant = (name: string, sun: ReturnType<typeof row>, earth = row(0)) => ({
  variant: name, sensitivity_high: false, tolerance_availability: 0.01, targets: { sun_center: sun, earth_center: earth } });

function show(sensitivity?: unknown, kind: "set" | "unknown" = "set") {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
  vi.stubGlobal("fetch", vi.fn(async (u: string) => {
    const url = String(u);
    if (url.includes("/countdown")) {
      const t = Number(new URL(url, "http://x").searchParams.get("t"));
      return json(kind === "set"
        ? { run_id: RUN, site_id: SITE, horizon: "terrain", result_state: "synthetic_demonstration", state: "V", t, mission_end: 3000, kind: "set", at: 2000, remaining_s: 2000 - t, solver_bracket_s: 1, text: "Predicted set under this terrain model" }
        : { run_id: RUN, site_id: SITE, horizon: "terrain", result_state: "synthetic_demonstration", state: "X", t, mission_end: 3000, kind: "unknown", text: "Unknown: no data here" });
    }
    return json(url.includes("/horizon/") ? profile : results(sensitivity));
  }));
  return render(<SkyView runId={RUN} siteId={SITE} />);
}

describe("countdown range across terrain variants", () => {
  it("says by how much the predicted time moves across the variants, from the service's numbers", async () => {
    show([variant("azimuth_step_halved", row(41)), variant("alternate_dem_release", row(1260))]);
    const notes = await screen.findAllByText(/Across 2 terrain variants \(finer azimuth step, other DEM release\) this time moves by up to 21 min/, undefined, { timeout: 4000 });
    expect(notes.length).toBeGreaterThan(0);
  });

  it("says it does not move when every variant agrees to the second", async () => {
    show([variant("azimuth_step_halved", row(0))]);
    expect((await screen.findAllByText(/Across 1 terrain variant .* this time does not move/, undefined, { timeout: 4000 })).length).toBeGreaterThan(0);
  });

  it("warns when a variant finds a different number of events", async () => {
    show([variant("alternate_dem_release", row(300, 1, 2))]);
    expect((await screen.findAllByText(/finds a different number of events here, so treat this prediction as sensitive/, undefined, { timeout: 4000 })).length).toBeGreaterThan(0);
  });

  it("says plainly that no range exists when no sensitivity check was run, rather than showing nothing", async () => {
    show([]);
    expect((await screen.findAllByText(/No sensitivity check was run, so no range across terrain variants is shown/, undefined, { timeout: 4000 })).length).toBeGreaterThan(0);
  });

  it("shows no range where the countdown itself is unknown", async () => {
    show([variant("azimuth_step_halved", row(41))], "unknown");
    await screen.findAllByText(/Unknown: no data here/, undefined, { timeout: 4000 });
    expect(screen.queryByText(/Across 2? ?terrain variant/)).toBeNull();
    expect(screen.queryByText(/this time moves by/)).toBeNull();
  });
});

describe("reduced motion without matchMedia", () => {
  it("does not crash where the browser has no matchMedia, and assumes motion is allowed", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => json(String(u).includes("/horizon/") ? profile : results([]))));
    const original = window.matchMedia;
    // @ts-expect-error simulate an environment without matchMedia
    delete window.matchMedia;
    try {
      render(<SkyView runId={RUN} siteId={SITE} />);
      expect(await screen.findByRole("heading", { level: 1 }, { timeout: 4000 })).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });
});
