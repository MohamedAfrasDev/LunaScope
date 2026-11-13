/**
 * Display helpers for the Local Sky view.
 *
 * The browser may pick an already-classified interval, format values, interpolate display
 * directions between nodes and subtract the cursor time from an event time. It never computes
 * clearance, availability, causes or the countdown rule itself: those come from the service.
 */
import type { IntervalClass, IntervalRow, SkySeries } from "./api/types";

export const wrap360 = (a: number): number => ((a % 360) + 360) % 360;

/** Linear interpolation of azimuth/elevation between nodes (display only), wrap-aware. */
export function interpAzEl(s: SkySeries, t: number): { az: number; el: number } {
  const n = s.az_deg.length;
  if (n === 0) return { az: 0, el: 0 };
  const x = Math.min(Math.max(t / s.step_s, 0), n - 1);
  const i = Math.min(Math.floor(x), n - 2 < 0 ? 0 : n - 2);
  const f = n === 1 ? 0 : x - i;
  const a0 = s.az_deg[i];
  const a1 = s.az_deg[Math.min(i + 1, n - 1)];
  let d = a1 - a0;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return { az: wrap360(a0 + d * f), el: s.el_deg[i] + (s.el_deg[Math.min(i + 1, n - 1)] - s.el_deg[i]) * f };
}

/** The classified interval containing t; at a shared boundary the interval that starts there wins. */
export function classAt(intervals: IntervalRow[], t: number): IntervalClass | null {
  for (const iv of intervals) if (t >= iv.start_s && t < iv.end_s) return iv.class;
  const last = intervals[intervals.length - 1];
  return last && t >= last.end_s ? last.class : null;
}

/** Circular linear interpolation of the skyline; null if either neighbouring bin is unknown. */
export function skylineAt(
  profile: { azimuth_deg: number[]; horizon_el_deg: (number | null)[] },
  az: number,
): number | null {
  const n = profile.azimuth_deg.length;
  if (n < 2) return null;
  const step = 360 / n;
  const x = wrap360(az) / step;
  const i0 = Math.floor(x) % n;
  const i1 = (i0 + 1) % n;
  const a = profile.horizon_el_deg[i0];
  const b = profile.horizon_el_deg[i1];
  if (a == null || b == null) return null;
  const f = x - Math.floor(x);
  return a + (b - a) * f;
}

/** Polar position: north up, azimuth clockwise, radius grows with elevation. */
export function polar(
  az: number,
  el: number,
  band: { min: number; max: number },
  R: number,
  cx = 0,
  cy = 0,
): { x: number; y: number } {
  const r = Math.max(0, Math.min((el - band.min) / (band.max - band.min), 1.05)) * R;
  const a = (az * Math.PI) / 180;
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
}

/** A whole-degree band that contains the skyline and every track, with a little headroom. */
export function elevationBand(
  skyline: (number | null)[],
  tracks: number[][],
): { min: number; max: number } {
  const vals = [0, ...skyline.filter((v): v is number => v != null), ...tracks.flat()];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  return { min: Math.floor(Math.min(lo, -2) / 5) * 5, max: Math.ceil((hi + 1) / 5) * 5 };
}

export function eventTimes(lists: { t_s: number }[][]): number[] {
  return Array.from(new Set(lists.flat().map((e) => e.t_s))).sort((a, b) => a - b);
}

export const nextEvent = (times: number[], t: number, eps = 0.5): number | null =>
  times.find((x) => x > t + eps) ?? null;

export function prevEvent(times: number[], t: number, eps = 0.5): number | null {
  for (let i = times.length - 1; i >= 0; i--) if (times[i] < t - eps) return times[i];
  return null;
}

/** Break a polyline into runs of equal class so each run can be styled by state. */
export function runsByClass(
  series: SkySeries,
  intervals: IntervalRow[],
): { cls: IntervalClass | null; idx: number[] }[] {
  const runs: { cls: IntervalClass | null; idx: number[] }[] = [];
  for (let i = 0; i < series.az_deg.length; i++) {
    const cls = classAt(intervals, i * series.step_s);
    const last = runs[runs.length - 1];
    if (last && last.cls === cls) last.idx.push(i);
    else runs.push({ cls, idx: last ? [last.idx[last.idx.length - 1], i] : [i] }); // share the joint
  }
  return runs;
}
