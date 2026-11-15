import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HorizonProfileResponse, IntervalRow, TargetHorizonResult, Target } from "@/lib/api/types";
import type { Track } from "@/lib/atlas/run";
import { frac, intervalsCsv, metricsView, segments, thin, timeAt, timelineSummary } from "@/lib/atlas/views";
import type { RunWindow } from "@/lib/atlas/clock";
import { duration, degrees, pctRange } from "@/lib/format";

const post = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({ ...(await orig<typeof import("@/lib/api/client")>()), postJson: (...a: unknown[]) => post(...a) }));

const { TimelinePanel } = await import("@/components/atlas/TimelinePanel");
const { MetricsPanel } = await import("@/components/atlas/MetricsPanel");
const { ClearancePanel } = await import("@/components/atlas/ClearancePanel");
const { SkyPathPanel } = await import("@/components/atlas/SkyPathPanel");
const { ComparePanel } = await import("@/components/atlas/ComparePanel");

const START = Date.UTC(2026, 10, 15, 7, 3);
const TOTAL = 4 * 3600;
const W: RunWindow = { startMs: START, totalS: TOTAL };

const iv = (a: number, b: number, c: IntervalRow["class"]): IntervalRow => ({
  start_s: a,
  end_s: b,
  start_utc: new Date(START + a * 1000).toISOString().replace(/\.\d+Z$/, "Z"),
  end_utc: new Date(START + b * 1000).toISOString().replace(/\.\d+Z$/, "Z"),
  class: c,
});

function result(lo: number, hi: number, o: Partial<TargetHorizonResult["metrics"]> = {}, intervals: IntervalRow[] = [iv(0, 3600, "H"), iv(3600, TOTAL, "V")]): TargetHorizonResult {
  return {
    metrics: {
      visible_s: 7200, hidden_s: 3600, unknown_s: 0, availability_lower: lo, availability_upper: hi, known_time_fraction: 1,
      longest_known_hidden_s: 7200, longest_known_hidden_start: 0, longest_known_hidden_end: 7200, worst_case_not_visible_s: 0,
      exclusion_reasons: [], threshold: 0.6, outcome: "FAIL", margin_lower: -0.1, margin_upper: -0.05, ...o,
    },
    clearance_at_nodes: { min_deg: -2.5, median_deg: 1, max_deg: 3.2 },
    countdown_at_start: { kind: "set", text: "Predicted set under this terrain model", remaining_s: 5400 },
    intervals,
    events: [],
  } as unknown as TargetHorizonResult;
}

function track(el: number[], az: number[], lo = 0.745, hi = 0.747, flatLo = 1, flatHi = 1): Track {
  const terrain = result(lo, hi);
  terrain.events = [{ t_s: 3600, t_utc: new Date(START + 3600_000).toISOString(), type: "rise", solver_bracket_s: 1, geometry_timing_bound_s: null, quality: "ok" }];
  return { series: { step_s: 3600, az_deg: az, el_deg: el }, intervals: terrain.intervals!, events: terrain.events!, terrain, flat: result(flatLo, flatHi, { outcome: "PASS" }) };
}

const sun = track([-1, 2, 4, 3, 1], [10, 20, 30, 40, 50]);
const earth = track([5, 5.1, 5.2, 5.1, 5], [300, 301, 302, 303, 304], 1, 1, 1, 1);
const tracks: Partial<Record<Target, Track>> = { sun_center: sun, earth_center: earth };

const profile = (): HorizonProfileResponse =>
  ({
    site_id: "s", result_state: "synthetic_demonstration", settings: { radius_km: 150, az_step_deg: 90 },
    azimuth_deg: [0, 90, 180, 270], horizon_el_deg: [1, 2, 3, null], argmax_distance_km: [1, 1, 1, null],
    sector_state: ["certified", "certified", "certified", "unsupported"], sectors: { certified: 3, coverage_limited: 0, unsupported: 1 },
    skyline_min_deg: 1, skyline_max_deg: 3,
  }) as unknown as HorizonProfileResponse;

beforeEach(() => {
  post.mockReset();
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
});

describe("panel views, worded with the run pages' own formatters", () => {
  it("metrics: every string is the same one the Timeline page prints", () => {
    const v = metricsView("sun_center", sun);
    expect(v.availability).toBe(pctRange(0.745, 0.747, 2));
    expect(v.availability).toBe("74.50–74.70%");
    expect(v.needs).toBe("needs at least 60%");
    expect(v.flatAvailability).toBe(pctRange(1, 1, 2));
    expect(v.longestHidden).toBe(duration(7200));
    expect(v.bestClearance).toBe(degrees(3.2));
    expect(v.atStart).toBe("Predicted set under this terrain model, in 1 h 30 min");
    expect(v.outcome.label).toBe("Fail");
    expect(v.exclusion).toBeNull();
  });

  it("metrics: unresolved time is named, unknown clearance is said, exclusion reasons are listed", () => {
    const t = track([1], [1]);
    t.terrain = result(0.5, 0.6, { unknown_s: 1800, exclusion_reasons: ["DEM_COVERAGE_INCOMPLETE"], outcome: "EXCLUDED" });
    t.terrain.clearance_at_nodes = null;
    const v = metricsView("earth_center", t);
    expect(v.totalHidden).toBe("1 h (plus 30 min unresolved or unknown)");
    expect(v.bestClearance).toBe("unknown");
    expect(v.exclusion).toBe("Excluded because: DEM_COVERAGE_INCOMPLETE.");
    expect(v.outcome.label).toBe("Excluded");
  });

  it("the timeline sentence quotes the service's ranges", () => {
    const s = timelineSummary(tracks);
    expect(s).toMatch(/^Sun above the terrain skyline for 74\.5–74\.7% of the window, line of sight to Earth for 100\.0% of the window\./);
    expect(timelineSummary({})).toBe("No timeline for this site.");
  });

  it("positions are fractions of the window, clamped, and a pointer maps back to a time", () => {
    expect(frac(TOTAL / 2, TOTAL)).toBe(0.5);
    expect(frac(-5, TOTAL)).toBe(0);
    expect(frac(5, 0)).toBe(0);
    expect(timeAt(0.25, TOTAL)).toBe(TOTAL / 4);
    expect(timeAt(2, TOTAL)).toBe(TOTAL);
    expect(timeAt(-1, TOTAL)).toBe(0);
    expect(segments([iv(0, 3600, "H"), iv(3600, 3600, "V"), iv(3600, TOTAL, "V")], TOTAL)).toEqual([
      { x: 0, w: 0.25, cls: "H" },
      { x: 0.25, w: 0.75, cls: "V" },
    ]); // an empty interval draws nothing
  });

  it("thins long series to a bound, keeping both ends", () => {
    const a = Array.from({ length: 1000 }, (_, i) => i);
    const t = thin(a, 100);
    expect(t).toHaveLength(100);
    expect(t[0].i).toBe(0);
    expect(t[99].i).toBe(999);
    expect(thin([1, 2, 3], 100).map((x) => x.v)).toEqual([1, 2, 3]);
  });

  it("the CSV has the run page's columns", () => {
    const csv = intervalsCsv([{ target: "sun_center", intervals: [iv(0, 3600, "H")] }]);
    expect(csv.split("\n")[0]).toBe("target,class,start_utc,end_utc,start_s,end_s");
    expect(csv.split("\n")[1]).toBe("sun_center,H,2026-11-15T07:03:00Z,2026-11-15T08:03:00Z,0,3600");
  });
});

describe("TimelinePanel", () => {
  const show = (t = TOTAL / 2, onSeek = vi.fn()) => ({ onSeek, ...render(<TimelinePanel siteLabel="Haworth" tracks={tracks} window={W} t={t} onSeek={onSeek} onClose={() => {}} />) });

  it("is a named image with the service's summary as its description, and a cursor at the clock time", () => {
    show();
    const svg = screen.getByRole("img", { name: "Visibility timeline for Haworth" });
    expect(svg).toHaveAccessibleDescription(/Sun above the terrain skyline for 74\.5–74\.7%/);
    const cursor = screen.getByTestId("timeline-cursor");
    // plot starts at 64 and is 570 wide, so halfway is 64 + 285
    expect(Number(cursor.getAttribute("x1"))).toBeCloseTo(64 + 285, 5);
    expect(screen.getByTestId("timeline-summary")).toHaveTextContent("Unresolved time is shown as a range, never as an outage.");
  });

  it("has no combined 'both' row: sunlight and Earth are judged separately", () => {
    show();
    expect(screen.queryByText(/^BOTH$/)).toBeNull();
    expect(screen.getByText("SUN")).toBeInTheDocument();
    expect(screen.getByText("EARTH")).toBeInTheDocument();
  });

  it("the cursor follows the clock and a drag across the bars seeks", () => {
    const { onSeek, rerender } = show(0);
    expect(Number(screen.getByTestId("timeline-cursor").getAttribute("x1"))).toBeCloseTo(64, 5);
    rerender(<TimelinePanel siteLabel="Haworth" tracks={tracks} window={W} t={TOTAL} onSeek={onSeek} onClose={() => {}} />);
    expect(Number(screen.getByTestId("timeline-cursor").getAttribute("x1"))).toBeCloseTo(634, 5);

    const svg = screen.getByTestId("timeline-svg");
    svg.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 640, height: 100, right: 640, bottom: 100, toJSON: () => ({}) }) as DOMRect;
    svg.setPointerCapture = vi.fn();
    fireEvent.pointerDown(svg, { clientX: 64 + 285, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(TOTAL / 2);
    fireEvent.pointerMove(svg, { clientX: 64 + 570, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(TOTAL);
    fireEvent.pointerUp(svg, { pointerId: 1 });
    onSeek.mockClear();
    fireEvent.pointerMove(svg, { clientX: 100, pointerId: 1 });
    expect(onSeek).not.toHaveBeenCalled(); // not dragging any more
  });

  it("the flat-horizon rows are added on request, and the table lists every interval in words", () => {
    show();
    expect(screen.queryByText("SUN FLAT")).toBeNull();
    fireEvent.click(screen.getByLabelText("Compare to a flat horizon"));
    expect(screen.getByText("SUN FLAT")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show as table" }));
    const table = screen.getByRole("table", { name: /Sun intervals at Haworth/ });
    expect(table).toHaveTextContent("Hidden by terrain or below the horizon");
    expect(table).toHaveTextContent("Visible");
    expect(table).toHaveTextContent("2026-11-15 07:03:00Z".replace("Z", " UTC"));
    fireEvent.click(screen.getByRole("button", { name: "Hide table" }));
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("downloads the intervals as CSV", () => {
    show();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
});

describe("MetricsPanel", () => {
  it("shows each target's outcome, range, requirement and flat-horizon comparison, tagged derived and assumption", () => {
    render(<MetricsPanel siteLabel="Haworth" tracks={tracks} cursor={[{ target: "sun_center", azDeg: 20, elDeg: 2.5, state: "V" }]} timeLabel="2026-11-15 09:03 UTC" onClose={() => {}} />);
    expect(screen.getByTestId("availability-sun_center")).toHaveTextContent("74.50–74.70%");
    expect(screen.getByTestId("availability-earth_center")).toHaveTextContent("100.00%");
    const sunCard = screen.getByRole("region", { name: "Sun metrics" });
    expect(sunCard).toHaveTextContent("needs at least 60%");
    expect(sunCard).toHaveTextContent("Fail");
    expect(sunCard).toHaveTextContent("Flat horizon");
    expect(sunCard).toHaveTextContent("Longest hidden");
    expect(sunCard).toHaveTextContent("+3.20°");
    expect(sunCard).toHaveTextContent("AZ 20.0° · EL +2.50°");
    expect(sunCard).toHaveTextContent("Visible");
    expect(screen.getByRole("region", { name: "Earth metrics" })).not.toHaveTextContent("At the cursor"); // no reading for Earth was given
    expect(screen.getAllByText("ASSUMPTION").length).toBe(2);
    expect(screen.getByText(/never combined into a score/)).toBeInTheDocument();
  });
});

describe("ClearancePanel", () => {
  it("draws the service's elevations and skyline with a cursor, and prints the service's clearance figures", () => {
    render(<ClearancePanel siteLabel="Haworth" tracks={tracks} window={W} t={TOTAL / 2} horizon={{ status: "ready", profile: profile() }} onSeek={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("img", { name: /Elevation of the Sun and Earth over the window at Haworth/ })).toBeInTheDocument();
    expect(screen.getByTestId("clearance-summary")).toHaveTextContent("Sun: from −2.50° to +3.20° above the terrain skyline (median +1.00°)");
    expect(screen.getByTestId("clearance-summary")).toHaveTextContent("Earth: from −2.50° to +3.20°");
    expect(Number(screen.getByTestId("clearance-cursor").getAttribute("x1"))).toBeCloseTo(46 + 0.5 * (640 - 46 - 10), 5);
    expect(screen.getByText(/never flat ground/)).toBeInTheDocument();
  });

  it("says so when the skyline is loading or failed, and still draws the elevations", () => {
    const { rerender } = render(<ClearancePanel siteLabel="H" tracks={tracks} window={W} t={0} horizon={{ status: "loading" }} onSeek={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Loading the terrain skyline…")).toBeInTheDocument();
    rerender(<ClearancePanel siteLabel="H" tracks={tracks} window={W} t={0} horizon={{ status: "error", message: "Could not reach the web server." }} onSeek={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/skyline could not be loaded.*Could not reach the web server/);
    expect(screen.getByTestId("clearance-svg")).toBeInTheDocument();
  });

  it("a click on the chart seeks, and the table gives elevation, skyline and the service's state", () => {
    const onSeek = vi.fn();
    render(<ClearancePanel siteLabel="H" tracks={tracks} window={W} t={0} horizon={{ status: "ready", profile: profile() }} onSeek={onSeek} onClose={() => {}} />);
    const svg = screen.getByTestId("clearance-svg");
    svg.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 640, height: 220, right: 640, bottom: 220, toJSON: () => ({}) }) as DOMRect;
    fireEvent.pointerDown(svg, { clientX: 640 - 10, pointerId: 1 });
    expect(onSeek).toHaveBeenCalledWith(TOTAL);
    fireEvent.click(screen.getByRole("button", { name: "Show as table" }));
    const table = screen.getByRole("table");
    expect(table).toHaveTextContent("Sun: elevation, skyline, state");
    expect(table).toHaveTextContent("unknown"); // the skyline is unknown at 270 degrees
  });
});

describe("SkyPathPanel", () => {
  it("draws nothing while the skyline loads or if it failed, and says why", () => {
    const { rerender } = render(<SkyPathPanel siteLabel="H" tracks={tracks} t={0} horizon={{ status: "loading" }} onClose={() => {}} />);
    expect(screen.getByText("Loading the terrain skyline…")).toBeInTheDocument();
    expect(screen.queryByTestId("sky-path")).toBeNull();
    rerender(<SkyPathPanel siteLabel="H" tracks={tracks} t={0} horizon={{ status: "error", message: "nope" }} onClose={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/no sky is drawn/);
  });

  it("shows where each target is now, reusing the run pages' sky plots, with an unrolled and a polar view", () => {
    render(<SkyPathPanel siteLabel="Haworth" tracks={tracks} t={3600} horizon={{ status: "ready", profile: profile() }} onClose={() => {}} />);
    expect(screen.getByTestId("sky-path-now")).toHaveTextContent("Sun at azimuth 20.0°, elevation +2.00°; Earth at azimuth 301.0°, elevation +5.10°");
    const img = screen.getByRole("img", { name: /Sun and Earth over the terrain skyline at Haworth/ });
    expect(img).toHaveAccessibleDescription(/Now: Sun at azimuth 20\.0°/);
    expect(screen.getByRole("button", { name: "Unrolled" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Polar (north up)" }));
    expect(screen.getByRole("button", { name: "Polar (north up)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: /Sun and Earth over the terrain skyline/ })).toBeInTheDocument();
  });
});

describe("ComparePanel", () => {
  const cmp = (sites: string[]) => ({
    mode: "sites_in_run", run_id: "r".repeat(64), result_state: "synthetic_demonstration", compatible: true, alignment: "elapsed",
    held_constant: [{ field: "mission.duration_s", value: 604800 }],
    changed: [{ field: "site", values: [] }],
    site_status: Object.fromEntries(sites.map((s) => [s, "FAIL_SUN"])),
    targets: Object.fromEntries(
      (["sun_center", "earth_center"] as const).map((t) => [
        t,
        {
          sites: sites.map((id) => ({ site_id: id, terrain: result(0.5, 0.52, { outcome: "FAIL" }).metrics, flat: result(1, 1, { outcome: "PASS" }).metrics })),
          spread: { availability_lower_min: 0.5, availability_lower_max: 0.5, availability_lower_range: 0 },
        },
      ]),
    ),
    facts: [{ fact: "outcomes_same", target: "sun_center", outcomes: Object.fromEntries(sites.map((s) => [s, "FAIL"])) }],
    caveats: [], warnings: [], validated_scopes: [], verified: false,
  });
  const names = (id: string) => ({ a: "Haworth", b: "Shackleton", c: "Faustini", d: "Cabeus" })[id] ?? id;
  const ids = ["a", "b", "c", "d"];

  it("asks the service to compare the chosen sites of the run, shows its facts and rows, and never ranks", async () => {
    post.mockResolvedValue(cmp(["a", "b", "c"]));
    render(<ComparePanel runId={"r".repeat(64)} siteIds={ids} nameOf={names} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("compare-facts")).toBeInTheDocument());
    expect(post).toHaveBeenCalledWith("comparisons", { runs: ["r".repeat(64)], sites: ["a", "b", "c"] });
    expect(screen.getByTestId("compare-sun_center-a")).toHaveTextContent("Haworth");
    expect(screen.getByTestId("compare-sun_center-a")).toHaveTextContent("50.00–52.00%");
    expect(screen.getByTestId("compare-sun_center-a")).toHaveTextContent(/Flat horizon would give.*Pass.*100\.00%/);
    expect(screen.getByText(/Sites are not ranked or scored/)).toBeInTheDocument();
    expect(screen.queryByText(/winner|rank 1|best site/i)).toBeNull();
  });

  it("recomputes for a changed choice, and asks for at least two sites instead of calling the service", async () => {
    post.mockResolvedValue(cmp(["a", "b", "c"]));
    render(<ComparePanel runId={"r".repeat(64)} siteIds={ids} nameOf={names} onClose={() => {}} />);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    post.mockResolvedValue(cmp(["a", "b", "c", "d"]));
    fireEvent.click(screen.getByLabelText("Cabeus"));
    await waitFor(() => expect(post).toHaveBeenLastCalledWith("comparisons", { runs: ["r".repeat(64)], sites: ["a", "b", "c", "d"] }));
    const calls = post.mock.calls.length;
    fireEvent.click(screen.getByLabelText("Cabeus"));
    fireEvent.click(screen.getByLabelText("Shackleton"));
    fireEvent.click(screen.getByLabelText("Faustini"));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose at least two sites.");
    expect(screen.queryByTestId("compare-facts")).toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    expect(post.mock.calls.length).toBeGreaterThanOrEqual(calls); // no call was made for a single site
    expect(post).not.toHaveBeenCalledWith("comparisons", expect.objectContaining({ sites: ["a"] }));
  });

  it("shows the service's refusal in words", async () => {
    post.mockRejectedValue(new Error("boom"));
    render(<ComparePanel runId={"r".repeat(64)} siteIds={ids} nameOf={names} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByTestId("compare-facts")).toBeNull();
  });
});
