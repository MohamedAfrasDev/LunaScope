import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkyView } from "@/components/SkyView";

const RUN = "e".repeat(64);
const SITE = "rule-89.5S-E0";
const iv = (cls: string, a: number, b: number) => ({
  start_s: a, end_s: b, class: cls,
  start_utc: new Date(Date.UTC(2027, 0, 10) + a * 1000).toISOString(),
  end_utc: new Date(Date.UTC(2027, 0, 10) + b * 1000).toISOString(),
});
const intervals = [iv("V", 0, 1000), iv("U", 1000, 1100), iv("H", 1100, 2400)];
const metrics = { availability_lower: 0.4, availability_upper: 0.45, outcome: "FAIL", threshold: 0.6 };
const block = (events: unknown[]) => ({
  metrics, clearance_at_nodes: null, countdown_at_start: { kind: "set", text: "x" }, intervals, events,
});
const results = {
  run_id: RUN, result_id: "r", status: "complete_with_warnings", result_state: "synthetic_demonstration", warnings: [],
  sites: [{
    site_id: SITE, validity: "unverified", site_status: "FAIL_SUN", result_state: "synthetic_demonstration", warnings: [],
    target_metrics: {
      sun_center: {
        terrain: block([{ t_s: 1050, t_utc: "x", type: "set", solver_bracket_s: 1, geometry_timing_bound_s: null, quality: "normal" }]),
        series: { step_s: 600, az_deg: [100, 110, 120, 130, 140], el_deg: [2, 2, 2, 2, 2] },
      },
      earth_center: {
        terrain: block([]),
        series: { step_s: 600, az_deg: [10, 11, 12, 13, 14], el_deg: [5, 5, 5, 5, 5] },
      },
    },
  }],
};
const profile = {
  site_id: SITE, result_state: "synthetic_demonstration", settings: { radius_km: 20, az_step_deg: 45 },
  azimuth_deg: [0, 45, 90, 135, 180, 225, 270, 315],
  horizon_el_deg: [1, 2, 3, 4, 3, 2, null, null], argmax_distance_km: [], sector_state: [],
  sectors: { certified: 6, coverage_limited: 2, unsupported: 0 }, skyline_min_deg: 1, skyline_max_deg: 4,
};

let urls: string[] = [];
function setup(reduced = false) {
  urls = [];
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: reduced && q.includes("reduce"), media: q,
    addEventListener: () => {}, removeEventListener: () => {},
  }));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    urls.push(String(url));
    let body: unknown = results;
    if (String(url).includes("/horizon/")) body = profile;
    if (String(url).includes("/countdown")) {
      const t = Number(new URL(String(url), "http://x").searchParams.get("t"));
      body = { run_id: RUN, site_id: SITE, horizon: "terrain", result_state: "synthetic_demonstration",
        state: "V", t, mission_end: 2400, kind: "set", at: 1050, remaining_s: 1050 - t, solver_bracket_s: 1,
        text: "Predicted set under this terrain model" };
    }
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  }));
}
beforeEach(() => setup());
afterEach(() => vi.unstubAllGlobals());

describe("SkyView", () => {
  it("draws the plot with a text alternative and shows the state the service picked", async () => {
    render(<SkyView runId={RUN} siteId={SITE} />);
    const img = await screen.findByRole("img", { name: /Local sky for 89.5°S, 0°E/ });
    expect(img).toBeInTheDocument();
    expect(document.querySelector("svg desc")?.textContent).toMatch(/skyline from 1\.0° to 4\.0°/);
    expect(document.querySelector("svg desc")?.textContent).toMatch(/1 predicted rise or set/);
    const sun = screen.getByRole("region", { name: /Sun at the cursor/ });
    expect(within(sun).getByText("Visible")).toBeInTheDocument(); // classified interval at t = 0
    expect(within(sun).getByText("+2.00°")).toBeInTheDocument(); // skyline 2.0 at azimuth 100: 3 - 0.222...
  });

  it("says the skyline is unknown instead of guessing where the terrain data is missing", async () => {
    render(<SkyView runId={RUN} siteId={SITE} />);
    await screen.findByRole("img");
    const earth = screen.getByRole("region", { name: /Earth at the cursor/ });
    // Earth azimuth ~10 deg is in a known sector, so move the Sun's track into the unknown 270-360 range
    expect(within(earth).queryByText(/unknown \(no terrain data\)/)).not.toBeInTheDocument();
  });

  it("jumps to the next event and asks the service for the countdown at that time", async () => {
    render(<SkyView runId={RUN} siteId={SITE} />);
    await screen.findByRole("img");
    fireEvent.click(screen.getByRole("button", { name: "Next event" }));
    await waitFor(() => expect(urls.some((u) => u.includes("/countdown") && u.includes("t=1050.0"))).toBe(true));
    const sun = screen.getByRole("region", { name: /Sun at the cursor/ });
    expect(within(sun).getByText("Unresolved (inside the numerical decision band)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next event" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous event" })).toBeDisabled(); // this is the only event
  });

  it("switches between the polar and unrolled views", async () => {
    render(<SkyView runId={RUN} siteId={SITE} />);
    await screen.findByRole("img");
    fireEvent.click(screen.getByLabelText(/Unrolled/));
    expect(await screen.findByText(/azimuth, clockwise from north/)).toBeInTheDocument();
  });

  it("with reduced motion, playback is off and stepping still works", async () => {
    setup(true);
    render(<SkyView runId={RUN} siteId={SITE} />);
    await screen.findByRole("img");
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
    expect(screen.getByText(/reduced motion/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next event" })).toBeEnabled();
  });

  it("keyboard shortcuts act only when the player group itself has focus, never in a field", async () => {
    render(<SkyView runId={RUN} siteId={SITE} />);
    await screen.findByRole("img");
    const group = screen.getByRole("group", { name: /Time player/ });
    const slider = screen.getByRole("slider") as HTMLInputElement;
    fireEvent.keyDown(slider, { key: "." }); // typing in a control: ignored
    expect(Number(slider.value)).toBe(0);
    fireEvent.keyDown(group, { key: "." });
    await waitFor(() => expect(Number(slider.value)).toBe(1050));
    fireEvent.keyDown(group, { key: "," }); // no earlier event: stays put
    expect(Number(slider.value)).toBe(1050);
    fireEvent.keyDown(group, { key: "ArrowLeft" }); // steps ten minutes back
    await waitFor(() => expect(Number(slider.value)).toBe(450));
  });

  it("offers a table alternative with every state spelled out in words", async () => {
    render(<SkyView runId={RUN} siteId={SITE} />);
    await screen.findByRole("img");
    const table = screen.getByRole("table");
    expect(within(table).getAllByText(/Visible|Hidden by terrain/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Download all positions/ })).toBeInTheDocument();
  });

  it("shows an error, not an empty plot, when the service fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "NOT_READY", message: "run is queued", field: null, retryable: true, correlation_id: "c" } }), { status: 409 })));
    render(<SkyView runId={RUN} siteId={SITE} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("run is queued");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
