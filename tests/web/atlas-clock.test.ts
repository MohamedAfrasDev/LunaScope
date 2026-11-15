import { describe, expect, it } from "vitest";
import {
  advance,
  clamp,
  elapsedLabel,
  eventBefore,
  initialClock,
  nextEventAfter,
  parseUtcInput,
  speedSeconds,
  statusLine,
  utcInputValue,
  utcLabel,
  windowFromIntervals,
  type ClockState,
  type RunWindow,
} from "@/lib/atlas/clock";
import { buildRunData, cursorAt, eventScopeWords, eventTimesFor } from "@/lib/atlas/run";
import type { ResultsResponse } from "@/lib/api/types";

const START = Date.UTC(2026, 10, 15, 7, 3); // 2026-11-15 07:03 UTC
const DAY = 86400;
const W: RunWindow = { startMs: START, totalS: 7 * DAY };
const playing = (o: Partial<ClockState> = {}): ClockState => ({ ...initialClock(), playing: true, ...o });

describe("advance", () => {
  it("does nothing while paused, with no window, or with no elapsed time", () => {
    const c = initialClock();
    expect(advance(c, 1000, W.totalS)).toBe(c);
    expect(advance(playing(), 1000, 0).t).toBe(0);
    expect(advance(playing(), 0, W.totalS).t).toBe(0);
  });

  it("moves by the speed per real second, in either direction", () => {
    expect(advance(playing({ speed: "1h" }), 1000, W.totalS).t).toBe(3600);
    expect(advance(playing({ speed: "1d" }), 500, W.totalS).t).toBe(DAY / 2);
    expect(advance(playing({ speed: "1h", reverse: true, t: 10_000 }), 1000, W.totalS).t).toBe(10_000 - 3600);
    expect(speedSeconds("10m")).toBe(600);
  });

  it("wraps at either end when looping", () => {
    expect(advance(playing({ speed: "1d", loop: true, t: W.totalS - 3600 }), 1000, W.totalS).t).toBe(DAY - 3600);
    expect(advance(playing({ speed: "1d", loop: true, reverse: true, t: 3600 }), 1000, W.totalS).t).toBe(W.totalS - (DAY - 3600));
  });

  it("stops and pauses at the end when not looping, so it never runs off the window", () => {
    const end = advance(playing({ speed: "1d", loop: false, t: W.totalS - 100 }), 1000, W.totalS);
    expect(end).toMatchObject({ t: W.totalS, playing: false });
    const start = advance(playing({ speed: "1d", loop: false, reverse: true, t: 100 }), 1000, W.totalS);
    expect(start).toMatchObject({ t: 0, playing: false });
  });

  it("clamps", () => {
    expect(clamp(-5, 100)).toBe(0);
    expect(clamp(500, 100)).toBe(100);
    expect(clamp(50, 100)).toBe(50);
  });
});

describe("time words", () => {
  it("writes UTC and elapsed time plainly", () => {
    expect(utcLabel(W, 0)).toBe("2026-11-15 07:03 UTC");
    expect(utcLabel(W, DAY + 3600)).toBe("2026-11-16 08:03 UTC");
    expect(utcLabel(W, 99 * DAY)).toBe(utcLabel(W, W.totalS)); // clamped to the window
    expect(utcInputValue(W, 0)).toBe("2026-11-15T07:03");
    expect(elapsedLabel(3 * DAY + 14 * 3600 + 59)).toBe("T+ 3 D 14 H");
    expect(elapsedLabel(-4)).toBe("T+ 0 D 0 H");
  });

  it("says what is playing", () => {
    expect(statusLine(initialClock())).toBe("Paused · 1 hour per second · loop");
    expect(statusLine({ ...initialClock(), playing: true, speed: "6h", reverse: true, loop: false })).toBe("Playing · 6 hours per second · reverse");
  });

  it("parses a go-to time as UTC and refuses one outside the window, saying where the window is", () => {
    expect(parseUtcInput(W, "2026-11-16T07:03")).toEqual({ ok: true, t: DAY });
    const early = parseUtcInput(W, "2026-11-14T00:00");
    expect(early).toMatchObject({ ok: false });
    expect(early.ok === false && early.reason).toMatch(/outside the run window \(2026-11-15 07:03 UTC to 2026-11-22 07:03 UTC\)/);
    expect(parseUtcInput(W, "2026-12-30T00:00").ok).toBe(false);
    expect(parseUtcInput(W, "")).toMatchObject({ ok: false, reason: "Enter a date and time." });
    expect(parseUtcInput(W, "not a date").ok).toBe(false);
  });

  it("reads the window from the service's intervals", () => {
    const w = windowFromIntervals([
      { start_s: 0, end_s: 600, start_utc: "2026-11-15T07:03:00Z" },
      { start_s: 600, end_s: 1200, start_utc: "2026-11-15T07:13:00Z" },
    ]);
    expect(w).toEqual({ startMs: START, totalS: 1200 });
    expect(windowFromIntervals([])).toBeNull();
    expect(windowFromIntervals([{ start_s: 0, end_s: 0, start_utc: "2026-11-15T07:03:00Z" }])).toBeNull();
    expect(windowFromIntervals([{ start_s: 0, end_s: 10, start_utc: "nope" }])).toBeNull();
  });
});

describe("events", () => {
  const times = [100, 500, 900];
  it("finds the next and previous event, strictly", () => {
    expect(nextEventAfter(times, 0)).toBe(100);
    expect(nextEventAfter(times, 100)).toBe(500);
    expect(nextEventAfter(times, 900)).toBeNull();
    expect(eventBefore(times, 1000)).toBe(900);
    expect(eventBefore(times, 500)).toBe(100);
    expect(eventBefore(times, 100)).toBeNull();
    expect(nextEventAfter([], 0)).toBeNull();
  });
});

function results(): ResultsResponse {
  const iv = (a: number, b: number, c: "V" | "H") => ({ start_s: a, end_s: b, start_utc: new Date(START + a * 1000).toISOString(), end_utc: new Date(START + b * 1000).toISOString(), class: c });
  const track = (ev: number[]) => ({
    series: { step_s: 600, az_deg: [350, 10, 30], el_deg: [1, 2, 3] },
    terrain: { intervals: [iv(0, 600, "H"), iv(600, 1200, "V")], events: ev.map((t) => ({ t_s: t, t_utc: "", type: "rise" as const, solver_bracket_s: 1, geometry_timing_bound_s: null, quality: "ok" })) },
  });
  return {
    run_id: "r".repeat(64),
    result_id: "x",
    status: "complete",
    result_state: "synthetic_demonstration",
    warnings: [],
    sites: [
      { site_id: "a", validity: "ok", site_status: "pass", result_state: "synthetic_demonstration", warnings: [], target_metrics: { sun_center: track([300]), earth_center: track([900]) } },
      { site_id: "b", validity: "ok", site_status: "pass", result_state: "synthetic_demonstration", warnings: [], target_metrics: { sun_center: track([100, 300]) } },
      { site_id: "empty", validity: "ok", site_status: "pass", result_state: "synthetic_demonstration", warnings: [], target_metrics: {} },
    ],
  } as unknown as ResultsResponse;
}

describe("run data", () => {
  it("keeps only sites with a series and intervals, and takes the window from the service", () => {
    const run = buildRunData(results())!;
    expect(Object.keys(run.sites).sort()).toEqual(["a", "b"]);
    expect(run.window).toEqual({ startMs: START, totalS: 1200 });
    expect(run.resultState).toBe("synthetic_demonstration");
  });

  it("has no run data when the service sent no usable window", () => {
    expect(buildRunData({ ...results(), sites: [] })).toBeNull();
  });

  it("reads each target at the cursor: interpolated position, and the service's classified state", () => {
    const run = buildRunData(results())!;
    const at0 = cursorAt(run, "a", 0)!;
    expect(at0.map((r) => r.target)).toEqual(["sun_center", "earth_center"]);
    expect(at0[0]).toMatchObject({ azDeg: 350, elDeg: 1, state: "H" });
    const mid = cursorAt(run, "a", 900)!;
    expect(mid[0].state).toBe("V");
    expect(mid[0].azDeg).toBeCloseTo(20, 5); // halfway between 10 and 30
    expect(mid[0].elDeg).toBeCloseTo(2.5, 5);
    expect(cursorAt(run, "b", 0)).toHaveLength(1); // only the Sun was returned for this site
    expect(cursorAt(run, "nope", 0)).toBeNull(); // a site that is not in the run has no reading
  });

  it("jumps between the selected site's events, or between every site's when none is selected", () => {
    const run = buildRunData(results())!;
    expect(eventTimesFor(run, "a")).toEqual([300, 900]);
    expect(eventTimesFor(run, "b")).toEqual([100, 300]);
    expect(eventTimesFor(run, null)).toEqual([100, 300, 900]);
    expect(eventTimesFor(run, "not-in-run")).toEqual([100, 300, 900]);
    expect(eventScopeWords(run, "a")).toBe("this site");
    expect(eventScopeWords(run, null)).toBe("any site in the run");
  });
});
