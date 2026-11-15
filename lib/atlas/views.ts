/**
 * What the Atlas result panels say, as plain strings, built with the same formatters as the run pages (lib/format.ts and
 * lib/status.ts), so a number on a panel and the same number on the Timeline page are the same text. Display only: every value
 * here arrived decided by the science service.
 */
import type { IntervalClass, IntervalRow, Target } from "@/lib/api/types";
import { degrees, duration, pctRange } from "@/lib/format";
import { OUTCOME, type Presentation } from "@/lib/status";
import type { Track } from "@/lib/atlas/run";

export const TARGET_WORDS: Record<Target, string> = { sun_center: "Sun", earth_center: "Earth" };
/** What the requirement is about, in the words of each target. */
export const TARGET_SUBJECT: Record<Target, string> = { sun_center: "Sun above the terrain skyline", earth_center: "Line of sight to Earth" };

export type MetricsView = {
  target: Target;
  outcome: Presentation;
  /** "74.50–74.71%" */
  availability: string;
  needs: string;
  flatAvailability: string | null;
  longestHidden: string;
  totalHidden: string;
  bestClearance: string;
  atStart: string;
  exclusion: string | null;
  lower: number;
  upper: number;
  threshold: number;
};

export function metricsView(target: Target, t: Track): MetricsView {
  const m = t.terrain.metrics;
  const f = t.flat?.metrics;
  const cd = t.terrain.countdown_at_start;
  return {
    target,
    outcome: OUTCOME[m.outcome],
    availability: pctRange(m.availability_lower, m.availability_upper, 2),
    needs: `needs at least ${Math.round(m.threshold * 100)}%`,
    flatAvailability: f ? pctRange(f.availability_lower, f.availability_upper, 2) : null,
    longestHidden: duration(m.longest_known_hidden_s),
    totalHidden: `${duration(m.hidden_s)}${m.unknown_s > 0 ? ` (plus ${duration(m.unknown_s)} unresolved or unknown)` : ""}`,
    bestClearance: t.terrain.clearance_at_nodes ? degrees(t.terrain.clearance_at_nodes.max_deg) : "unknown",
    atStart: `${cd.text}${cd.remaining_s != null ? `, in ${duration(cd.remaining_s)}` : ""}`,
    exclusion: m.exclusion_reasons.length ? `Excluded because: ${m.exclusion_reasons.join(", ")}.` : null,
    lower: m.availability_lower,
    upper: m.availability_upper,
    threshold: m.threshold,
  };
}

/** One sentence under the timeline, from the service's own availability ranges. */
export function timelineSummary(tracks: Partial<Record<Target, Track>>): string {
  const parts = (Object.keys(TARGET_WORDS) as Target[]).flatMap((k) => {
    const t = tracks[k];
    if (!t) return [];
    const m = t.terrain.metrics;
    return [`${TARGET_SUBJECT[k][0].toLowerCase()}${TARGET_SUBJECT[k].slice(1)} for ${pctRange(m.availability_lower, m.availability_upper, 1)} of the window`];
  });
  if (!parts.length) return "No timeline for this site.";
  const s = parts.join(", ");
  return `${s[0].toUpperCase()}${s.slice(1)}. Unresolved time is shown as a range, never as an outage.`;
}

/** Position of a time on a bar of width 1. */
export const frac = (t: number, total: number): number => (total > 0 ? Math.min(Math.max(t / total, 0), 1) : 0);

/** A time on the bar from a pointer position (0 to 1 across the bar). */
export const timeAt = (x: number, total: number): number => Math.min(Math.max(x, 0), 1) * total;

export type Segment = { x: number; w: number; cls: IntervalClass };

/** The bar's segments from the service's classified intervals. */
export function segments(intervals: IntervalRow[], total: number): Segment[] {
  return intervals
    .filter((iv) => iv.end_s > iv.start_s)
    .map((iv) => ({ x: frac(iv.start_s, total), w: frac(iv.end_s, total) - frac(iv.start_s, total), cls: iv.class }));
}

/** Samples for the elevation chart, thinned to at most `max` points so a month at five minutes stays light. */
export function thin<T>(arr: T[], max: number): { v: T; i: number }[] {
  if (arr.length <= max) return arr.map((v, i) => ({ v, i }));
  const step = (arr.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, k) => {
    const i = Math.round(k * step);
    return { v: arr[i], i };
  });
}

/** CSV of the terrain-aware intervals of one site: the same columns as the run page's download. */
export function intervalsCsv(rows: { target: Target; intervals: IntervalRow[] }[]): string {
  const lines = ["target,class,start_utc,end_utc,start_s,end_s"];
  for (const r of rows) for (const iv of r.intervals) lines.push([r.target, iv.class, iv.start_utc, iv.end_utc, iv.start_s, iv.end_s].join(","));
  return lines.join("\n");
}
