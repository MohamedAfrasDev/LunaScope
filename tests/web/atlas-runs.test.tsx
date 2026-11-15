import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TopBar } from "@/components/atlas/TopBar";
import { SelectedSitePanel, analyseDraft, analyseHref } from "@/components/atlas/SelectedSitePanel";
import { DEFAULT_TARGET, isReferenceId, isRunId, sameTarget, searchFor, targetFromSearch, targetKey } from "@/lib/atlas/run-target";
import { clearRecentRuns, rememberRun, resetRecentRunsForTests } from "@/lib/recent-runs";
import { fromCatalog } from "@/lib/atlas/sites";
import { decodeShare, SHARE_PARAM } from "@/lib/draft";
import type { CatalogSite } from "@/lib/api/types";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({ ...(await orig<typeof import("@/lib/api/client")>()), getJson: (...a: unknown[]) => get(...a), postJson: (...a: unknown[]) => post(...a) }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/atlas", useRouter: () => ({ push }) }));
vi.mock("@/components/shell/CommandPalette", () => ({ openCommandPalette: vi.fn() }));

const { RunsPanel } = await import("@/components/atlas/RunsPanel");
const { useRun } = await import("@/components/atlas/useRun");
const { AnalyzeForm } = await import("@/components/AnalyzeForm");

const A = "a".repeat(64);
const B = "b".repeat(64);

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  push.mockReset();
  localStorage.clear();
  resetRecentRunsForTests();
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
});

describe("which run the Atlas shows", () => {
  it("reads the address: a run id, a reference, or the default reference mission", () => {
    expect(targetFromSearch("")).toEqual(DEFAULT_TARGET);
    expect(targetFromSearch(`?run=${A}`)).toEqual({ kind: "run", id: A });
    expect(targetFromSearch("?ref=GR-002")).toEqual({ kind: "reference", id: "GR-002" });
    expect(targetFromSearch("?run=nope")).toEqual(DEFAULT_TARGET);
    expect(targetFromSearch("?ref=../etc")).toEqual(DEFAULT_TARGET);
    expect(targetFromSearch(`?run=${A}&ref=GR-002`)).toEqual({ kind: "run", id: A }); // a run id wins
    expect(isRunId(A)).toBe(true);
    expect(isRunId("A".repeat(64))).toBe(false);
    expect(isReferenceId("GR-003")).toBe(true);
    expect(isReferenceId("GR-3")).toBe(false);
  });

  it("writes it back, keeping other parameters and leaving the default address clean", () => {
    expect(searchFor({ kind: "run", id: A }, "")).toBe(`run=${A}`);
    expect(searchFor({ kind: "reference", id: "GR-002" }, `run=${A}&x=1`)).toBe("x=1&ref=GR-002");
    expect(searchFor(DEFAULT_TARGET, `run=${A}`)).toBe("");
    expect(searchFor({ kind: "run", id: B }, `ref=GR-002`)).toBe(`run=${B}`);
    expect(sameTarget({ kind: "run", id: A }, { kind: "run", id: A })).toBe(true);
    expect(sameTarget({ kind: "run", id: A }, { kind: "reference", id: A })).toBe(false);
    expect(targetKey(DEFAULT_TARGET)).toBe("reference:GR-001");
  });
});

describe("RunsPanel", () => {
  it("lists the reference missions with their names, marks the open one, and loads a chosen one", async () => {
    get.mockImplementation((path: string) =>
      Promise.resolve(path === "references/GR-002" ? { reference_id: "GR-002", status: "frozen", title: "Artemis III features", purpose: "Six named places over one week." } : { reference_id: path.slice(11), status: "draft" }),
    );
    const onChoose = vi.fn();
    render(<RunsPanel current={{ kind: "reference", id: "GR-001" }} onChoose={onChoose} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /GR-001/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /GR-002/ })).toHaveAttribute("aria-current", "false");
    await waitFor(() => expect(screen.getByRole("button", { name: /GR-002 · frozen/ })).toHaveTextContent("Artemis III features"));
    expect(screen.getByRole("button", { name: /GR-002/ })).toHaveTextContent("Six named places over one week.");
    fireEvent.click(screen.getByRole("button", { name: /GR-002/ }));
    expect(onChoose).toHaveBeenCalledWith({ kind: "reference", id: "GR-002" });
    expect(screen.getByText(/not landing recommendations/)).toBeInTheDocument();
  });

  it("keeps a reference's plain name when its definition cannot be read", async () => {
    get.mockRejectedValue(new Error("down"));
    render(<RunsPanel current={{ kind: "run", id: A }} onChoose={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /GR-003/ })).toHaveTextContent("Well-known south-polar craters");
  });

  it("lists runs opened on this device, and says so when there are none", () => {
    get.mockResolvedValue({});
    const { unmount } = render(<RunsPanel current={DEFAULT_TARGET} onChoose={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/None yet/)).toBeInTheDocument();
    unmount();
    act(() => rememberRun({ id: A, label: "Haworth and 2 more", state: "synthetic_demonstration", sites: ["a", "b", "c"] }));
    const onChoose = vi.fn();
    render(<RunsPanel current={{ kind: "run", id: A }} onChoose={onChoose} onClose={() => {}} />);
    const b = screen.getByRole("button", { name: /Haworth and 2 more/ });
    expect(b).toHaveAttribute("aria-current", "true");
    expect(b).toHaveTextContent("a".repeat(12));
    fireEvent.click(b);
    expect(onChoose).toHaveBeenCalledWith({ kind: "run", id: A });
    clearRecentRuns();
  });

  it("opens a run by id, and refuses an id that is not one without asking the service", () => {
    get.mockResolvedValue({});
    const onChoose = vi.fn();
    render(<RunsPanel current={DEFAULT_TARGET} onChoose={onChoose} onClose={() => {}} />);
    const input = screen.getByLabelText("Open a run by its id");
    const open = screen.getByRole("button", { name: "Open" });
    expect(open).toBeDisabled();
    fireEvent.change(input, { target: { value: "not an id" } });
    fireEvent.click(open);
    expect(screen.getByRole("alert")).toHaveTextContent("A run id is 64 characters, 0 to 9 and a to f.");
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: `  ${B.toUpperCase()} ` } });
    fireEvent.click(open);
    expect(onChoose).toHaveBeenCalledWith({ kind: "run", id: B });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the run chip", () => {
  const base = { scale: "moon" as const, onScale: vi.fn(), open: [] as never[], onTogglePanel: vi.fn(), onView: vi.fn(), placing: false, onTogglePlacing: vi.fn() };
  it("names the open run, opens the Runs panel, and reads Runs when there is none", () => {
    const { rerender } = render(<TopBar {...base} runLabel="Run GR-002" />);
    const chip = screen.getByTestId("run-chip");
    expect(chip).toHaveTextContent("Run GR-002");
    expect(chip).toHaveAccessibleName("Run GR-002: choose another run");
    fireEvent.click(chip);
    expect(base.onTogglePanel).toHaveBeenCalledWith("runs");
    rerender(<TopBar {...base} />);
    expect(screen.getByTestId("run-chip")).toHaveTextContent("Runs");
    expect(screen.getByRole("button", { name: "Dates" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Evidence" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyse" })).toBeInTheDocument();
  });
});

describe("useRun", () => {
  const ref = { reference_id: "GR-002", status: "frozen", request: { sites: [] } };
  const iv = [{ start_s: 0, end_s: 600, start_utc: "2026-11-15T07:03:00Z", end_utc: "2026-11-15T07:13:00Z", class: "V" }];
  const results = (runId: string) => ({
    run_id: runId, result_id: "x", status: "complete", result_state: "synthetic_demonstration", warnings: [],
    sites: [{ site_id: "s", validity: "ok", site_status: "PASS", result_state: "synthetic_demonstration", warnings: [], target_metrics: { sun_center: { series: { step_s: 600, az_deg: [1], el_deg: [1] }, terrain: { intervals: iv, events: [], metrics: {} } } } }],
  });

  function route(runId: string, statuses: unknown[] = [{ status: "complete" }]) {
    let i = 0;
    get.mockImplementation((path: string) => {
      if (path.startsWith("references/")) return Promise.resolve(ref);
      if (path.includes("/results")) return Promise.resolve(results(path.split("/")[1]));
      return Promise.resolve(statuses[Math.min(i++, statuses.length - 1)]);
    });
    post.mockResolvedValue({ run_id: runId, status: "queued" });
  }

  it("submits a reference as the service holds it, polls, and then holds its series", async () => {
    route(A);
    const { result } = renderHook(() => useRun({ kind: "reference", id: "GR-002" }));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(post).toHaveBeenCalledWith("analyses", ref.request);
    expect(get).toHaveBeenCalledWith("references/GR-002", expect.anything());
    const r = result.current;
    expect(r.status === "ready" && r.reference).toBe("GR-002");
    expect(r.status === "ready" && r.run.runId).toBe(A);
  });

  it("opens a run by id without submitting anything", async () => {
    route(A);
    const { result } = renderHook(() => useRun({ kind: "run", id: B }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(post).not.toHaveBeenCalled();
    expect(get.mock.calls.some(([p]) => String(p).startsWith(`analyses/${B}/results`))).toBe(true);
  });

  it("starts a new load when the target changes, and shows loading rather than the old run in between", async () => {
    route(A);
    const { result, rerender } = renderHook(({ t }) => useRun(t), { initialProps: { t: { kind: "run", id: A } as import("@/lib/atlas/run-target").RunTarget } });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    rerender({ t: { kind: "run", id: B } });
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const r = result.current;
    expect(r.status === "ready" && r.run.runId).toBe(B);
  });

  it("says why when the run failed or the service cannot be reached, and shows no run", async () => {
    get.mockResolvedValue({ status: "failed", error: { message: "Terrain data missing." } });
    const failed = renderHook(() => useRun({ kind: "run", id: A }));
    await waitFor(() => expect(failed.result.current.status).toBe("error"));
    expect(failed.result.current).toMatchObject({ message: "Terrain data missing." });
    get.mockRejectedValue(new Error("down"));
    const down = renderHook(() => useRun({ kind: "run", id: B }));
    await waitFor(() => expect(down.result.current.status).toBe("error"));
  });

  it("reports progress while the run is queued or running", async () => {
    vi.useFakeTimers();
    try {
      route(A, [{ status: "running", stage: "Computing skylines", progress: 0.4 }, { status: "complete" }]);
      const { result } = renderHook(() => useRun({ kind: "run", id: A }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(result.current).toMatchObject({ status: "loading", stage: "Computing skylines", progress: 0.4 });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(result.current.status).toBe("ready");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Analyse this site, inside the Atlas", () => {
  const cov = { covered_fraction: 1, fully_covered: true, radius_km: 150, sectors_with_gap: 0 };
  const site = fromCatalog({ site_id: "iau-haworth", label: "Haworth", name: "Haworth", group: "artemis", kind: "named_feature", convention: "planetocentric", dem_coverage_150km: cov, lat_deg: -87.45, lon_east_deg: 354.8, precision_m: 100, source: "IAU" } as CatalogSite);
  const props = { site, onCentre: () => {}, onReset: () => {}, onClose: () => {} };

  it("opens the Analyse panel instead of leaving, and the classic link is still the fallback", () => {
    const onAnalyse = vi.fn();
    const { rerender } = render(<SelectedSitePanel {...props} onAnalyse={onAnalyse} />);
    expect(screen.queryByRole("link", { name: "Analyse this site" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Analyse this site" }));
    expect(onAnalyse).toHaveBeenCalledOnce();
    rerender(<SelectedSitePanel {...props} />);
    expect(screen.getByRole("link", { name: "Analyse this site" })).toHaveAttribute("href", analyseHref(site));
    expect(decodeShare(analyseHref(site).split(`${SHARE_PARAM}=`)[1])).toEqual(analyseDraft(site));
    expect(analyseDraft(site).siteIds).toEqual(["iau-haworth"]);
  });
});

describe("AnalyzeForm inside the Atlas", () => {
  const cov = { covered_fraction: 1, fully_covered: true, radius_km: 150, sectors_with_gap: 0 };
  const catalog = {
    sites: [
      { site_id: "rule-89.5S-E0", label: "-89.5 deg, 0 E (rule point)", kind: "demonstration_rule", convention: "planetocentric", dem_coverage_150km: cov, lat_deg: -89.5, lon_east_deg: 0, precision_m: 100, source: "rule" },
      { site_id: "iau-haworth", label: "Haworth", name: "Haworth", group: "artemis", kind: "named_feature", convention: "planetocentric", dem_coverage_150km: cov, lat_deg: -87.45, lon_east_deg: 354.8, precision_m: 100, source: "IAU" },
    ],
    groups: { artemis: "Artemis III features" },
  };

  it("hands the new run to the Atlas instead of navigating, and can start from a seeded site", async () => {
    sessionStorage.clear();
    get.mockResolvedValue(catalog);
    post.mockResolvedValue({ run_id: A, status: "queued" });
    const onStarted = vi.fn();
    const seed = { ...(await import("@/lib/draft")).referenceDraft(["iau-haworth"]) };
    render(<AnalyzeForm onStarted={onStarted} seed={seed} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Run analysis/ })).toBeEnabled());
    expect((screen.getByRole("checkbox", { name: /Haworth/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Run analysis/ }));
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith(A));
    expect(push).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith("analyses", expect.objectContaining({ sites: [{ site_id: "iau-haworth" }] }));
  });
});
