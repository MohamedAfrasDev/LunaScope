/**
 * The Atlas clock (redesign phase D): pure functions, no React, no browser. The clock is a number of seconds since the start
 * of the loaded run's window. It only moves a cursor: every Sun and Earth value shown at that time was computed by the
 * science service, and the browser interpolates between its samples for display (see lib/sky.ts).
 */

/** Playback speeds, in seconds of run time per second of real time. */
export const SPEEDS = [
  { id: "1m", label: "1 min", s: 60 },
  { id: "10m", label: "10 min", s: 600 },
  { id: "1h", label: "1 hour", s: 3600 },
  { id: "6h", label: "6 hours", s: 21600 },
  { id: "1d", label: "1 day", s: 86400 },
] as const;
export type SpeedId = (typeof SPEEDS)[number]["id"];
export const DEFAULT_SPEED: SpeedId = "1h";

export type RunWindow = { startMs: number; totalS: number };

export type ClockState = {
  /** Seconds since the start of the window. */
  t: number;
  playing: boolean;
  speed: SpeedId;
  reverse: boolean;
  loop: boolean;
};

export const initialClock = (): ClockState => ({ t: 0, playing: false, speed: DEFAULT_SPEED, reverse: false, loop: true });

export const speedSeconds = (id: SpeedId): number => SPEEDS.find((s) => s.id === id)?.s ?? 3600;

export const clamp = (t: number, total: number): number => Math.min(Math.max(t, 0), Math.max(total, 0));

/**
 * Move the clock by `dtMs` of real time. At an end it either wraps (loop) or stops there and pauses, so playing never runs off
 * the window and a stopped clock says so.
 */
export function advance(c: ClockState, dtMs: number, total: number): ClockState {
  if (!c.playing || total <= 0 || dtMs <= 0) return c;
  const next = c.t + (c.reverse ? -1 : 1) * speedSeconds(c.speed) * (dtMs / 1000);
  if (next >= 0 && next <= total) return { ...c, t: next };
  if (c.loop) return { ...c, t: ((next % total) + total) % total };
  return { ...c, t: c.reverse ? 0 : total, playing: false };
}

/** Next event strictly after t, or null. `times` is sorted. */
export const nextEventAfter = (times: number[], t: number, eps = 0.5): number | null => times.find((x) => x > t + eps) ?? null;

/** Previous event strictly before t, or null. */
export function eventBefore(times: number[], t: number, eps = 0.5): number | null {
  for (let i = times.length - 1; i >= 0; i--) if (times[i] < t - eps) return times[i];
  return null;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** "2026-11-18 21:48 UTC" */
export function utcLabel(w: RunWindow, t: number): string {
  const d = new Date(w.startMs + clamp(t, w.totalS) * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** The value a `datetime-local` input takes ("2026-11-18T21:48"), read as UTC. */
export function utcInputValue(w: RunWindow, t: number): string {
  return utcLabel(w, t).replace(" UTC", "").replace(" ", "T");
}

/** Parse a `datetime-local` value as UTC and return seconds since the window start, or an explanation if it is outside. */
export function parseUtcInput(w: RunWindow, value: string): { ok: true; t: number } | { ok: false; reason: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return { ok: false, reason: "Enter a date and time." };
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const t = (ms - w.startMs) / 1000;
  if (!Number.isFinite(t) || t < 0 || t > w.totalS) {
    return { ok: false, reason: `That time is outside the run window (${utcLabel(w, 0)} to ${utcLabel(w, w.totalS)}).` };
  }
  return { ok: true, t };
}

/** "T+ 3 D 14 H": elapsed time since the start of the window. */
export function elapsedLabel(t: number): string {
  const s = Math.max(0, Math.floor(t));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return `T+ ${d} D ${h} H`;
}

/** The sentence under the play button. */
export function statusLine(c: ClockState): string {
  const sp = SPEEDS.find((s) => s.id === c.speed)?.label ?? "";
  return `${c.playing ? "Playing" : "Paused"} · ${sp} per second${c.reverse ? " · reverse" : ""}${c.loop ? " · loop" : ""}`;
}

/** The window of a run from the intervals the service returned: where it starts in UTC and how long it lasts. */
export function windowFromIntervals(intervals: { start_s: number; end_s: number; start_utc: string }[]): RunWindow | null {
  const first = intervals[0];
  const last = intervals[intervals.length - 1];
  if (!first || !last) return null;
  const startMs = Date.parse(first.start_utc) - first.start_s * 1000;
  if (!Number.isFinite(startMs) || last.end_s <= 0) return null;
  return { startMs, totalS: last.end_s };
}
