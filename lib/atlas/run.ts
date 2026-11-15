/**
 * What the Atlas keeps of a finished run: its window, and for every site and target the service's series, intervals and
 * events. Pure helpers (redesign phase D). The browser picks and interpolates; it never decides whether a target is visible:
 * the state at a time is the service's classified interval (see lib/sky.ts).
 */
import type { EventRow, IntervalClass, IntervalRow, ResultsResponse, ResultState, SkySeries, Target, TargetHorizonResult } from "@/lib/api/types";
import { classAt, interpAzEl } from "@/lib/sky";
import { windowFromIntervals, type RunWindow } from "@/lib/atlas/clock";

export const TARGETS: Target[] = ["sun_center", "earth_center"];

/**
 * One target at one site. `terrain` is what decides; `flat` is the flat-horizon comparison. `intervals` and `events` are the
 * terrain-aware ones, kept at the top level for the clock and the cursor.
 */
export type Track = {
  series: SkySeries;
  intervals: IntervalRow[];
  events: EventRow[];
  terrain: TargetHorizonResult;
  flat: TargetHorizonResult | null;
};

export type RunData = {
  runId: string;
  resultState: ResultState;
  window: RunWindow;
  /** site id to the tracks of its targets (terrain-aware). */
  sites: Record<string, Partial<Record<Target, Track>>>;
};

/** Build the run data from `GET results?include=intervals,events,series`. Null if the service returned no usable window. */
export function buildRunData(r: ResultsResponse): RunData | null {
  const sites: RunData["sites"] = {};
  let window: RunWindow | null = null;
  for (const s of r.sites) {
    const tracks: Partial<Record<Target, Track>> = {};
    for (const target of TARGETS) {
      const m = s.target_metrics[target];
      const series = m?.series;
      const terrain = m?.terrain;
      if (!series || !terrain?.intervals?.length) continue;
      tracks[target] = { series, intervals: terrain.intervals, events: terrain.events ?? [], terrain, flat: m?.flat ?? null };
      window ??= windowFromIntervals(terrain.intervals);
    }
    if (Object.keys(tracks).length) sites[s.site_id] = tracks;
  }
  return window ? { runId: r.run_id, resultState: r.result_state, window, sites } : null;
}

export type CursorReading = { target: Target; azDeg: number; elDeg: number; state: IntervalClass | null };

/** Where each target is at time t for one site, and the service's classified state there. Null if the site is not in the run. */
export function cursorAt(run: RunData, siteId: string, t: number): CursorReading[] | null {
  const tracks = run.sites[siteId];
  if (!tracks) return null;
  return TARGETS.flatMap((target) => {
    const tr = tracks[target];
    if (!tr) return [];
    const { az, el } = interpAzEl(tr.series, t);
    return [{ target, azDeg: az, elDeg: el, state: classAt(tr.intervals, t) }];
  });
}

/**
 * The event times the clock can jump between: those of the selected site if it is in the run, otherwise the union over every
 * site of the run. Sorted, without duplicates.
 */
export function eventTimesFor(run: RunData, siteId: string | null): number[] {
  const ids = siteId && run.sites[siteId] ? [siteId] : Object.keys(run.sites);
  const set = new Set<number>();
  for (const id of ids) for (const tr of Object.values(run.sites[id] ?? {})) for (const e of tr?.events ?? []) set.add(e.t_s);
  return [...set].sort((a, b) => a - b);
}

export function eventScopeWords(run: RunData, siteId: string | null): string {
  return siteId && run.sites[siteId] ? "this site" : "any site in the run";
}
