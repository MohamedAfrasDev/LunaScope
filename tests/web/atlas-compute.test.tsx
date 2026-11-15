import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SelectedSitePanel } from "@/components/atlas/SelectedSitePanel";
import type { RunWindow } from "@/lib/atlas/clock";
import type { RunData } from "@/lib/atlas/run";
import { baseRequestFromProvenance, buildSiteRequest, mergeRuns, runIdFor, sameWindow, serviceSiteId, siteRequestEntry, type BaseRequest } from "@/lib/atlas/site-run";
import { fromCatalog, type AtlasSite } from "@/lib/atlas/sites";
import type { CatalogSite, ProvenanceResponse } from "@/lib/api/types";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({ ...(await orig<typeof import("@/lib/api/client")>()), getJson: (...a: unknown[]) => get(...a), postJson: (...a: unknown[]) => post(...a) }));

const { useRunRequest, useSiteRuns } = await import("@/components/atlas/useSiteRuns");

const START = Date.UTC(2026, 10, 15, 7, 3);
const W: RunWindow = { startMs: START, totalS: 3600 };
const BASE = "a".repeat(64);
const COMPUTED = "c".repeat(64);

const cov = { covered_fraction: 1, fully_covered: true, radius_km: 150, sectors_with_gap: 0 };
const haworth = fromCatalog({ site_id: "iau-haworth", label: "Haworth", name: "Haworth", group: "artemis", kind: "named_feature", convention: "planetocentric", dem_coverage_150km: cov, lat_deg: -87.45, lon_east_deg: 354.8, precision_m: 100, source: "IAU" } as CatalogSite);
const custom: AtlasSite = { ...haworth, id: "custom-1", label: "Custom point 1", kind: "custom", latDeg: -88.123456789, lonEastDeg: 45.5, source: "Placed by hand in the Atlas", precisionM: 1000 };

const prov = (over: Record<string, unknown> = {}) =>
  ({
    run_id: BASE, result_id: "x", algorithm_id: "a", result_state: "synthetic_demonstration", verified: false, validated_scopes: [], resources: [], sites: [],
    request: {
      mission: { start_utc: "2026-11-15T07:03:00Z", duration_s: 3600, step_s: 600 },
      requirements: { sun_min_availability: 0.6, earth_min_availability: 0.5 },
      terrain: { dem_profile: "lola-80s-20m-adj", radius_km: 150, az_step_deg: 0.1, observer_height_m: 2, clearance_margin_deg: 0.25 },
    },
    ...over,
  }) as unknown as ProvenanceResponse;

const request = (): BaseRequest => baseRequestFromProvenance(prov())!;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe("building a one-site request", () => {
  it("takes the loaded run's window, requirements and terrain, and leaves out its clearance margin", () => {
    const r = request();
    expect(r.mission).toEqual({ start_utc: "2026-11-15T07:03:00Z", duration_s: 3600, step_s: 600 });
    expect(r.requirements).toEqual({ sun_min_availability: 0.6, earth_min_availability: 0.5 });
    expect(r.terrain).toEqual({ dem_profile: "lola-80s-20m-adj", radius_km: 150, az_step_deg: 0.1, observer_height_m: 2 });
    expect(baseRequestFromProvenance(prov({ request: undefined }))).toBeNull();
    expect(baseRequestFromProvenance(prov({ request: { mission: {} } }))).toBeNull();
  });

  it("names a catalog site by its id and a custom point by its typed coordinates", () => {
    expect(siteRequestEntry(haworth)).toEqual({ site_id: "iau-haworth" });
    expect(siteRequestEntry(custom)).toEqual({
      custom: { lat_deg: -88.123457, lon_deg: 45.5, lon_direction: "east_positive", convention: "planetocentric", source: "Placed by hand in the Atlas", precision_m: 1000 },
    });
  });

  it("is a complete one-site request with no sensitivity check", () => {
    const body = buildSiteRequest(request(), haworth);
    expect(body).toMatchObject({ schema_version: "1", sites: [{ site_id: "iau-haworth" }], options: { sensitivity: false } });
    expect(body.mission).toEqual(request().mission);
    expect(buildSiteRequest(request(), custom).sites).toHaveLength(1);
  });
});

describe("merging a computed site into the loaded run", () => {
  const track = { series: { step_s: 600, az_deg: [1], el_deg: [1] }, intervals: [], events: [], terrain: {}, flat: null } as never;
  const base: RunData = { runId: BASE, resultState: "synthetic_demonstration", window: W, sites: { a: { sun_center: track } } };

  it("adds the site and remembers which run holds it, without touching the loaded run", () => {
    const merged = mergeRuns(base, { "custom-1": { runId: COMPUTED, serviceId: "custom-9f3a", tracks: { sun_center: track } } });
    expect(Object.keys(merged.sites).sort()).toEqual(["a", "custom-1"]);
    expect(runIdFor(merged, "custom-1")).toBe(COMPUTED);
    // the skyline of a computed site is asked of its own run, under the id the service gave it
    expect(serviceSiteId(merged, "custom-1")).toBe("custom-9f3a");
    expect(serviceSiteId(merged, "a")).toBe("a");
    expect(runIdFor(merged, "a")).toBe(BASE);
    expect(base.sites).not.toHaveProperty("custom-1");
    expect(merged.runId).toBe(BASE);
  });

  it("never replaces a site the loaded run already holds, and returns the same object when there is nothing to add", () => {
    const merged = mergeRuns(base, { a: { runId: COMPUTED, serviceId: "a", tracks: {} } });
    expect(merged).toBe(base);
    expect(mergeRuns(base, {})).toBe(base);
  });

  it("compares windows exactly", () => {
    expect(sameWindow(W, { ...W })).toBe(true);
    expect(sameWindow(W, { ...W, totalS: 7200 })).toBe(false);
    expect(sameWindow(W, { ...W, startMs: START + 1 })).toBe(false);
  });
});

describe("useRunRequest", () => {
  it("reads the loaded run's inputs from its provenance, and says nothing when it cannot", async () => {
    get.mockResolvedValue(prov());
    const { result } = renderHook(() => useRunRequest(BASE));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.mission.duration_s).toBe(3600);
    get.mockRejectedValue(new Error("down"));
    const bad = renderHook(() => useRunRequest("b".repeat(64)));
    await new Promise((r) => setTimeout(r, 20));
    expect(bad.result.current).toBeNull();
    expect(renderHook(() => useRunRequest(null)).result.current).toBeNull();
  });
});

describe("useSiteRuns", () => {
  const results = (window = W) => ({
    run_id: COMPUTED, result_id: "x", status: "complete", result_state: "synthetic_demonstration", warnings: [],
    sites: [
      {
        site_id: "iau-haworth", validity: "ok", site_status: "PASS", result_state: "synthetic_demonstration", warnings: [],
        target_metrics: {
          sun_center: {
            series: { step_s: 600, az_deg: [1, 2], el_deg: [1, 2] },
            terrain: { intervals: [{ start_s: 0, end_s: window.totalS, start_utc: new Date(window.startMs).toISOString(), end_utc: "x", class: "V" }], events: [], metrics: {} },
          },
        },
      },
    ],
  });
  const route = (statuses: unknown[] = [{ status: "complete" }], res: unknown = results()) => {
    let i = 0;
    get.mockImplementation((path: string) => {
      if (path.includes("/results")) return Promise.resolve(res);
      return Promise.resolve(statuses[Math.min(i++, statuses.length - 1)]);
    });
    post.mockResolvedValue({ run_id: COMPUTED, status: "queued" });
  };

  it("submits a one-site run with the loaded run's settings, follows it, and holds the site's series", async () => {
    route();
    const { result } = renderHook(() => useSiteRuns(BASE, W, request()));
    expect(result.current.canCompute).toBe(true);
    act(() => result.current.compute(haworth));
    expect(result.current.states["iau-haworth"]).toMatchObject({ status: "loading" });
    await waitFor(() => expect(result.current.states["iau-haworth"]?.status).toBe("ready"));
    expect(post).toHaveBeenCalledWith("analyses", expect.objectContaining({ sites: [{ site_id: "iau-haworth" }], options: { sensitivity: false } }));
    expect(result.current.extras["iau-haworth"].runId).toBe(COMPUTED);
    expect(result.current.extras["iau-haworth"].serviceId).toBe("iau-haworth");
    expect(result.current.extras["iau-haworth"].tracks.sun_center?.series.az_deg).toEqual([1, 2]);
  });

  it("holds a custom point under the id the Atlas gave it, whatever id the service assigned", async () => {
    route();
    const { result } = renderHook(() => useSiteRuns(BASE, W, request()));
    act(() => result.current.compute(custom));
    await waitFor(() => expect(result.current.states["custom-1"]?.status).toBe("ready"));
    expect(Object.keys(result.current.extras)).toEqual(["custom-1"]);
    expect(post.mock.calls[0][1].sites[0]).toHaveProperty("custom");
  });

  it("reports progress while the run is queued or running", async () => {
    vi.useFakeTimers();
    try {
      route([{ status: "running", stage: "Computing skylines", progress: 0.4 }, { status: "complete" }]);
      const { result } = renderHook(() => useSiteRuns(BASE, W, request()));
      act(() => result.current.compute(haworth));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(result.current.states["iau-haworth"]).toMatchObject({ status: "loading", stage: "Computing skylines", progress: 0.4 });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(result.current.states["iau-haworth"]?.status).toBe("ready");
    } finally {
      vi.useRealTimers();
    }
  });

  it("says why when the service refuses or the run fails, and holds nothing", async () => {
    post.mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useSiteRuns(BASE, W, request()));
    act(() => result.current.compute(haworth));
    await waitFor(() => expect(result.current.states["iau-haworth"]?.status).toBe("error"));
    expect(Object.keys(result.current.extras)).toHaveLength(0);

    post.mockResolvedValue({ run_id: COMPUTED, status: "queued" });
    get.mockResolvedValue({ status: "failed", error: { message: "Terrain data missing." } });
    act(() => result.current.compute(haworth));
    await waitFor(() => expect(result.current.states["iau-haworth"]).toMatchObject({ status: "error", message: "Terrain data missing." }));
  });

  it("refuses a result whose window is not the loaded run's, so the clock never disagrees with a path", async () => {
    route([{ status: "complete" }], results({ startMs: START + 999_000, totalS: 3600 }));
    const { result } = renderHook(() => useSiteRuns(BASE, W, request()));
    act(() => result.current.compute(haworth));
    await waitFor(() => expect(result.current.states["iau-haworth"]?.status).toBe("error"));
    expect(result.current.states["iau-haworth"]).toMatchObject({ message: expect.stringMatching(/does not match the loaded run/) });
    expect(Object.keys(result.current.extras)).toHaveLength(0);
  });

  it("cannot start without a loaded run or its settings, and forgets everything when another run is loaded", async () => {
    const none = renderHook(() => useSiteRuns(null, null, null));
    expect(none.result.current.canCompute).toBe(false);
    act(() => none.result.current.compute(haworth));
    expect(post).not.toHaveBeenCalled();
    const noReq = renderHook(() => useSiteRuns(BASE, W, null));
    expect(noReq.result.current.canCompute).toBe(false);

    route();
    const { result, rerender } = renderHook(({ id }: { id: string }) => useSiteRuns(id, W, request()), { initialProps: { id: BASE } });
    act(() => result.current.compute(haworth));
    await waitFor(() => expect(result.current.states["iau-haworth"]?.status).toBe("ready"));
    rerender({ id: "b".repeat(64) });
    expect(result.current.states).toEqual({});
    expect(result.current.extras).toEqual({});
  });
});

describe("Compute sky on the Selected site card", () => {
  const props = { site: haworth, onCentre: () => {}, onReset: () => {}, onClose: () => {}, cursor: { kind: "not-in-run" as const, runLabel: "GR-001" } };

  it("offers to compute a point the run does not hold, and starts it", () => {
    const onStart = vi.fn();
    render(<SelectedSitePanel {...props} compute={{ canStart: true, state: undefined, onStart }} />);
    expect(screen.getByText(/not in the loaded run \(GR-001\)/)).toBeInTheDocument();
    expect(screen.getByTestId("compute-block")).toHaveTextContent(/one-site run, which can take from seconds to minutes/);
    fireEvent.click(screen.getByRole("button", { name: "Compute sky for this site" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("is off when the loaded run's settings are not known, and says why", () => {
    render(<SelectedSitePanel {...props} compute={{ canStart: false, state: undefined, onStart: () => {} }} />);
    const b = screen.getByRole("button", { name: "Compute sky for this site" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("title", expect.stringMatching(/settings the service returned/));
  });

  it("shows progress while it runs, and the reason with Try again when it fails", () => {
    const { rerender } = render(<SelectedSitePanel {...props} compute={{ canStart: true, state: { status: "loading", stage: "Computing skylines", progress: 0.4 }, onStart: () => {} }} />);
    expect(screen.getByTestId("compute-status")).toHaveTextContent("Computing · Computing skylines 40%");
    expect(screen.getByRole("button", { name: "Computing…" })).toBeDisabled();
    rerender(<SelectedSitePanel {...props} compute={{ canStart: true, state: { status: "error", message: "This copy is a replay: it shows saved runs only." }, onStart: () => {} }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("replay");
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("is not shown for a point the run already holds", () => {
    render(
      <SelectedSitePanel
        {...props}
        cursor={{ kind: "ready", timeLabel: "2026-11-15 07:03 UTC", runLabel: "GR-001", readings: [{ target: "sun_center", azDeg: 1, elDeg: 1, state: "V" }] }}
        compute={{ canStart: true, state: undefined, onStart: () => {} }}
      />,
    );
    expect(screen.queryByTestId("compute-block")).toBeNull();
    expect(screen.getByTestId("site-cursor")).toBeInTheDocument();
  });
});
