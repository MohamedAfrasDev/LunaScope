import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { DataStatusProvider } from "@/components/DataStatusBanner";
import { SelectedSitePanel, type SiteCursor } from "@/components/atlas/SelectedSitePanel";
import { TimeDock, type DockRun } from "@/components/atlas/TimeDock";
import { useClock, type ClockActions } from "@/components/atlas/useClock";
import { initialClock, type ClockState, type RunWindow } from "@/lib/atlas/clock";
import { fromCatalog } from "@/lib/atlas/sites";
import type { CatalogSite } from "@/lib/api/types";

const START = Date.UTC(2026, 10, 15, 7, 3);
const DAY = 86400;
const W: RunWindow = { startMs: START, totalS: 7 * DAY };

const ready = (o: Partial<Extract<DockRun, { kind: "ready" }>> = {}): DockRun => ({ kind: "ready", window: W, events: [3600, 7200, 90_000], eventScope: "this site", label: "GR-001", synthetic: true, ...o });

type MockActions = Record<keyof ClockActions, Mock>;
function actions(): MockActions {
  return { toggle: vi.fn(), setSpeed: vi.fn(), toggleReverse: vi.fn(), toggleLoop: vi.fn(), seek: vi.fn() };
}

function dock(run: DockRun, clock: Partial<ClockState> = {}, a: MockActions = actions(), reducedMotion = false) {
  const ui = (c: ClockState, r: DockRun) => (
    <DataStatusProvider>
      <TimeDock run={r} clock={c} actions={a as unknown as ClockActions} reducedMotion={reducedMotion} />
    </DataStatusProvider>
  );
  const out = render(ui({ ...initialClock(), ...clock }, run));
  return { a, ...out, again: (c: Partial<ClockState>, r: DockRun = run) => out.rerender(ui({ ...initialClock(), ...c }, r)) };
}

beforeEach(() => {
  // every test starts without reduced motion (one test sets it)
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
});

describe("TimeDock without a run", () => {
  it("is honest while loading: every clock control is off and it says what is happening", () => {
    dock({ kind: "loading", text: "Loading the reference run · Running 40%" });
    expect(screen.getByTestId("dock-status")).toHaveTextContent("Loading the reference run · Running 40%");
    expect(screen.getByRole("button", { name: /Play \(no run is loaded\)/ })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "Time (UTC)" })).toBeDisabled();
    for (const n of ["Next event", "Previous event", "Reverse", "Loop", "1 hour"]) expect(screen.getByRole("button", { name: n })).toBeDisabled();
    expect(screen.getByText(/Not endorsed by NASA/)).toBeInTheDocument();
  });

  it("offers Try again when the run could not be loaded", () => {
    const retry = vi.fn();
    dock({ kind: "error", text: "No run loaded · No run 37b308.", retry });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("has no Try again without a retry to call", () => {
    dock({ kind: "error", text: "No run loaded · x" });
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("says why when the run failed, and shows no time", () => {
    dock({ kind: "error", text: "No run loaded · Could not reach the web server." });
    expect(screen.getByTestId("dock-status")).toHaveTextContent("Could not reach the web server.");
    expect(screen.getByTestId("dock-elapsed")).toBeEmptyDOMElement();
    expect(screen.getByRole("slider", { name: "Time (UTC)" })).toBeDisabled();
  });
});

describe("TimeDock with a run", () => {
  it("shows the state, the elapsed time, the window and the run, and tags synthetic data", () => {
    dock(ready(), { t: 3 * DAY + 14 * 3600, speed: "6h", reverse: true });
    expect(screen.getByTestId("dock-status")).toHaveTextContent("Paused · 6 hours per second · reverse · loop");
    expect(screen.getByTestId("dock-elapsed")).toHaveTextContent("T+ 3 D 14 H");
    expect(screen.getByText(/2026-11-15 07:03 UTC/)).toBeInTheDocument();
    expect(screen.getByText(/2026-11-22 07:03 UTC/)).toBeInTheDocument();
    expect(screen.getByText("Run GR-001")).toBeInTheDocument();
    expect(screen.getByText("SYNTHETIC")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Time (UTC)" })).toHaveAttribute("aria-valuetext", "2026-11-18 21:03 UTC");
  });

  it("play and pause, speed, reverse and loop call back, and the pressed state is shown", () => {
    const { a, again } = dock(ready());
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("button", { name: "6 hours" }));
    fireEvent.click(screen.getByRole("button", { name: "Reverse" }));
    fireEvent.click(screen.getByRole("button", { name: "Loop" }));
    expect(a.toggle).toHaveBeenCalledOnce();
    expect(a.setSpeed).toHaveBeenCalledWith("6h");
    expect(a.toggleReverse).toHaveBeenCalledOnce();
    expect(a.toggleLoop).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "1 hour" })).toHaveAttribute("aria-pressed", "true");
    again({ playing: true });
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("Next and Previous event jump to the service's event times, and say so when there is none", () => {
    const { a } = dock(ready(), { t: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "Next event" }));
    expect(a.seek).toHaveBeenLastCalledWith(7200);
    fireEvent.click(screen.getByRole("button", { name: "Previous event" }));
    expect(a.seek).toHaveBeenLastCalledWith(3600);
  });

  it("names the end of the events instead of inventing one", () => {
    const { a } = dock(ready(), { t: 100_000 });
    fireEvent.click(screen.getByRole("button", { name: "Next event" }));
    expect(a.seek).not.toHaveBeenCalled();
    expect(screen.getByText("No event before the end of the window.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous event" }));
    expect(a.seek).toHaveBeenCalledWith(90_000);
  });

  it("tells whose events they are", () => {
    dock(ready({ eventScope: "any site in the run" }));
    expect(screen.getByRole("group", { name: "Events of any site in the run" })).toBeInTheDocument();
  });

  it("go to a UTC time seeks there, and refuses a time outside the run window in words", () => {
    const { a } = dock(ready(), { t: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Go to time" })); // folded away by default
    const input = screen.getByLabelText("Go to (UTC)") as HTMLInputElement;
    expect(input.value).toBe("2026-11-15T07:03");
    fireEvent.change(input, { target: { value: "2026-11-17T07:03" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(a.seek).toHaveBeenCalledWith(2 * DAY);
    fireEvent.change(input, { target: { value: "2027-01-01T00:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(screen.getByText(/outside the run window/)).toBeInTheDocument();
    expect(a.seek).toHaveBeenCalledOnce();
  });

  it("a typed go-to time survives the field losing focus, because pressing Go blurs it first", () => {
    const { a } = dock(ready(), { t: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Go to time" })); // folded away by default
    const input = screen.getByLabelText("Go to (UTC)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-11-17T07:03" } });
    fireEvent.blur(input);
    expect(input.value).toBe("2026-11-17T07:03");
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(a.seek).toHaveBeenCalledWith(2 * DAY);
  });

  it("the field follows the cursor again once the cursor moves", () => {
    const { again } = dock(ready(), { t: 0 });
    const input = screen.getByLabelText("Go to (UTC)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-11-17T07:03" } });
    again({ t: DAY });
    expect(input.value).toBe("2026-11-16T07:03");
  });

  it("the scrubber seeks, and the arrow keys move ten minutes (an hour with Shift)", () => {
    const { a } = dock(ready(), { t: 7200 });
    const slider = screen.getByRole("slider", { name: "Time (UTC)" });
    fireEvent.change(slider, { target: { value: "86400" } });
    expect(a.seek).toHaveBeenLastCalledWith(86400);
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(a.seek).toHaveBeenLastCalledWith(7800);
    fireEvent.keyDown(slider, { key: "ArrowLeft", shiftKey: true });
    expect(a.seek).toHaveBeenLastCalledWith(3600);
  });

  it("keyboard: Space plays, . and , jump between events, [ and ] change speed; typing in a field is left alone", () => {
    const { a } = dock(ready(), { t: 5000, speed: "1h" });
    fireEvent.keyDown(document.body, { key: " " });
    expect(a.toggle).toHaveBeenCalledOnce();
    fireEvent.keyDown(document.body, { key: "." });
    expect(a.seek).toHaveBeenLastCalledWith(7200);
    fireEvent.keyDown(document.body, { key: "," });
    expect(a.seek).toHaveBeenLastCalledWith(3600);
    fireEvent.keyDown(document.body, { key: "]" });
    expect(a.setSpeed).toHaveBeenLastCalledWith("6h");
    fireEvent.keyDown(document.body, { key: "[" });
    expect(a.setSpeed).toHaveBeenLastCalledWith("10m");

    a.toggle.mockClear();
    fireEvent.keyDown(screen.getByLabelText("Go to (UTC)"), { key: " " });
    fireEvent.keyDown(screen.getByRole("button", { name: "Next event" }), { key: " " }); // a button uses Space itself
    expect(a.toggle).not.toHaveBeenCalled();
  });

  it("reduced motion: play is off and says why, while the scrubber and event buttons still work", () => {
    dock(ready(), {}, actions(), true);
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
    expect(screen.getByText(/Playback is off because your system asks for reduced motion/)).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Time (UTC)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next event" })).toBeEnabled();
  });
});

describe("useClock", () => {
  it("starts paused at the start, seeks within the window, and toggles", () => {
    const { result } = renderHook(() => useClock(W));
    expect(result.current.clock).toMatchObject({ t: 0, playing: false, loop: true, speed: "1h", reverse: false });
    act(() => result.current.actions.seek(5000));
    expect(result.current.clock.t).toBe(5000);
    act(() => result.current.actions.seek(10 * DAY));
    expect(result.current.clock.t).toBe(W.totalS);
    act(() => result.current.actions.seek(-5));
    expect(result.current.clock.t).toBe(0);
    act(() => result.current.actions.toggle());
    expect(result.current.clock.playing).toBe(true);
    act(() => result.current.actions.toggle());
    expect(result.current.clock.playing).toBe(false);
    act(() => result.current.actions.setSpeed("1d"));
    act(() => result.current.actions.toggleReverse());
    act(() => result.current.actions.toggleLoop());
    expect(result.current.clock).toMatchObject({ speed: "1d", reverse: true, loop: false });
  });

  it("with loop off, pressing play at the end starts again from the start", () => {
    const { result } = renderHook(() => useClock(W));
    act(() => result.current.actions.toggleLoop());
    act(() => result.current.actions.seek(W.totalS));
    act(() => result.current.actions.toggle());
    expect(result.current.clock).toMatchObject({ playing: true, t: 0 });
  });

  it("does nothing without a window, and a new window puts the cursor back at its start", () => {
    const { result, rerender } = renderHook(({ w }: { w: RunWindow | null }) => useClock(w), { initialProps: { w: null as RunWindow | null } });
    act(() => result.current.actions.toggle());
    expect(result.current.clock.playing).toBe(false);
    rerender({ w: W });
    act(() => result.current.actions.seek(9000));
    expect(result.current.clock.t).toBe(9000);
    rerender({ w: { startMs: START + DAY * 1000, totalS: W.totalS } });
    expect(result.current.clock).toMatchObject({ t: 0, playing: false });
  });

  it("under reduced motion it never plays", () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useClock(W));
    expect(result.current.reducedMotion).toBe(true);
    act(() => result.current.actions.toggle());
    expect(result.current.clock.playing).toBe(false);
  });

  it("while playing, the cursor advances with real time", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    try {
      const { result } = renderHook(() => useClock(W));
      act(() => result.current.actions.toggle());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(result.current.clock.t).toBeGreaterThan(3000); // about one hour of run time in one real second at the default speed
      expect(result.current.clock.t).toBeLessThan(4500);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("SelectedSitePanel at the cursor", () => {
  const cov = { covered_fraction: 1, fully_covered: true, radius_km: 150, sectors_with_gap: 0 };
  const site = fromCatalog({ site_id: "iau-haworth", label: "Haworth", name: "Haworth", group: "artemis", kind: "named_feature", convention: "planetocentric", dem_coverage_150km: cov, lat_deg: -87.45, lon_east_deg: 354.8, precision_m: 100, source: "IAU" } as CatalogSite);
  const props = { site, onCentre: () => {}, onReset: () => {}, onClose: () => {} };
  const show = (cursor: SiteCursor) => render(<SelectedSitePanel {...props} cursor={cursor} />);

  it("shows each target's position and the service's state words at the clock time, marked derived", () => {
    show({
      kind: "ready",
      timeLabel: "2026-11-18 21:48 UTC",
      runLabel: "GR-001",
      readings: [
        { target: "sun_center", azDeg: 128.64, elDeg: 5.263, state: "V" },
        { target: "earth_center", azDeg: 330.4, elDeg: -0.1, state: "H" },
      ],
    });
    const block = screen.getByTestId("site-cursor");
    expect(block).toHaveTextContent("2026-11-18 21:48 UTC · run GR-001");
    expect(block).toHaveTextContent("AZ 128.6° · EL +5.26°");
    expect(block).toHaveTextContent("Visible (terrain-aware)");
    expect(block).toHaveTextContent("AZ 330.4° · EL −0.10°");
    expect(block).toHaveTextContent("Hidden by terrain or below the horizon (terrain-aware)");
    expect(screen.getAllByText("DERIVED").length).toBeGreaterThan(0);
  });

  it("says plainly when there is nothing to show, and never fills the gap", () => {
    const { rerender } = show({ kind: "none" });
    expect(screen.getByText(/No run is loaded, so there is no Sun or Earth result/)).toBeInTheDocument();
    rerender(<SelectedSitePanel {...props} cursor={{ kind: "loading" }} />);
    expect(screen.getByText(/Loading the run/)).toBeInTheDocument();
    rerender(<SelectedSitePanel {...props} cursor={{ kind: "error", text: "Could not reach the web server." }} />);
    expect(screen.getByText(/could not be loaded.*Could not reach the web server/)).toBeInTheDocument();
    rerender(<SelectedSitePanel {...props} cursor={{ kind: "not-in-run", runLabel: "GR-001" }} />);
    expect(screen.getByText(/not in the loaded run \(GR-001\)/)).toBeInTheDocument();
    expect(screen.queryByTestId("site-cursor")).toBeNull();
  });
});
