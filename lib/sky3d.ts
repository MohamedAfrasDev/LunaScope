/**
 * Geometry for the 3D sky view. Pure functions, no three.js and no DOM, so they are unit-tested directly.
 *
 * Display only. Everything drawn is data the service already decided: the skyline (HorizonProfileResponse), the
 * Sun and Earth directions (SkySeries) and the classified intervals. Nothing here decides visibility.
 *
 * Coordinates: the observer is the origin; +x is east, +y is up, +z is south (so north is -z and a camera looking
 * down -z faces north). A direction at azimuth az (clockwise from north) and elevation el on a sphere of radius R:
 *   x = R cos(el) sin(az),  y = R sin(el),  z = -R cos(el) cos(az).
 */
import type { IntervalClass, IntervalRow, SkySeries } from "./api/types";

export type Vec3 = [number, number, number];

const RAD = Math.PI / 180;

export function dirFromAzEl(azDeg: number, elDeg: number, R = 1): Vec3 {
  const az = azDeg * RAD;
  const el = elDeg * RAD;
  return [R * Math.cos(el) * Math.sin(az), R * Math.sin(el), -R * Math.cos(el) * Math.cos(az)];
}

/** Inverse of dirFromAzEl, for tests and for "face this direction". */
export function azElFromDir(v: Vec3): { az: number; el: number } {
  const [x, y, z] = v;
  const h = Math.hypot(x, z);
  return { az: (((Math.atan2(x, -z) / RAD) % 360) + 360) % 360, el: Math.atan2(y, h) / RAD };
}

/** Vertical exaggeration applies to ELEVATION ANGLES only, and is stated on screen whenever it is not 1. */
export const exaggerate = (elDeg: number, k: number): number => elDeg * k;

export interface Mesh {
  positions: Float32Array;
  indices: Uint32Array;
}

/**
 * The terrain skyline as a solid wall: for every azimuth bin, a vertical strip from `floorEl` up to that bin's skyline
 * elevation. Unknown bins (null) get NO strip: an unknown skyline is left open, never drawn as flat or as ground.
 */
export function skylineWall(
  azimuthDeg: number[],
  horizonElDeg: (number | null)[],
  R: number,
  floorEl: number,
  k = 1,
): Mesh {
  const n = azimuthDeg.length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = horizonElDeg[i];
    const b = horizonElDeg[j];
    if (a == null || b == null) continue;
    const base = pos.length / 3;
    pos.push(
      ...dirFromAzEl(azimuthDeg[i], floorEl, R),
      ...dirFromAzEl(azimuthDeg[i], exaggerate(a, k), R),
      ...dirFromAzEl(j === 0 ? azimuthDeg[j] + 360 : azimuthDeg[j], floorEl, R),
      ...dirFromAzEl(j === 0 ? azimuthDeg[j] + 360 : azimuthDeg[j], exaggerate(b, k), R),
    );
    idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

/**
 * Texture coordinates for `skylineWall`, in the same order (four vertices per known bin: floor and top at the start of the bin, floor
 * and top at its end). `repeat` is how many times the picture goes round the circle; `vSpan` is how much of the picture the wall
 * covers vertically, so its texels stay about square.
 */
export function skylineWallUv(azimuthDeg: number[], horizonElDeg: (number | null)[], repeat = 10, vSpan = 0.3): Float32Array {
  const n = azimuthDeg.length;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (horizonElDeg[i] == null || horizonElDeg[j] == null) continue;
    const u0 = (i / n) * repeat;
    const u1 = ((i + 1) / n) * repeat;
    out.push(u0, 0, u0, vSpan, u1, 0, u1, vSpan);
  }
  return new Float32Array(out);
}

/** The ridge line: runs of consecutive known bins, each a polyline (an unknown bin breaks the line). */
export function skylineRuns(azimuthDeg: number[], horizonElDeg: (number | null)[], R: number, k = 1): Float32Array[] {
  const n = azimuthDeg.length;
  const runs: Float32Array[] = [];
  let cur: number[] = [];
  const flush = () => {
    if (cur.length >= 6) runs.push(new Float32Array(cur));
    cur = [];
  };
  for (let i = 0; i < n; i++) {
    const e = horizonElDeg[i];
    if (e == null) flush();
    else cur.push(...dirFromAzEl(azimuthDeg[i], exaggerate(e, k), R));
  }
  flush();
  // close the loop when every bin is known
  if (runs.length === 1 && horizonElDeg.every((v) => v != null) && n > 2) {
    const first = dirFromAzEl(azimuthDeg[0], exaggerate(horizonElDeg[0] as number, k), R);
    const r = runs[0];
    const out = new Float32Array(r.length + 3);
    out.set(r);
    out.set(first, r.length);
    runs[0] = out;
  }
  return runs;
}

/** A circle of constant elevation (a ring around the dome). */
export function elevationRing(elDeg: number, R: number, segments = 180, k = 1): Float32Array {
  const out = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) out.set(dirFromAzEl((360 * i) / segments, exaggerate(elDeg, k), R), i * 3);
  return out;
}

export interface TrackRun {
  cls: IntervalClass | "none";
  positions: Float32Array;
}

/**
 * The Sun's or Earth's whole path as runs of one visibility class each, so it can be styled by the state the service
 * decided. A run ends exactly where the class changes; consecutive runs share their boundary sample.
 */
export function trackRuns(series: SkySeries, intervals: IntervalRow[], R: number, k = 1): TrackRun[] {
  const n = series.az_deg.length;
  if (n === 0) return [];
  const classAtIdx = (i: number): IntervalClass | "none" => {
    const t = i * series.step_s;
    for (const iv of intervals) if (t >= iv.start_s && t < iv.end_s) return iv.class;
    const last = intervals[intervals.length - 1];
    return last && t >= last.end_s ? last.class : "none";
  };
  const runs: TrackRun[] = [];
  let start = 0;
  let cls = classAtIdx(0);
  const emit = (a: number, b: number, c: IntervalClass | "none") => {
    const pts: number[] = [];
    for (let i = a; i <= b; i++) pts.push(...dirFromAzEl(series.az_deg[i], exaggerate(series.el_deg[i], k), R));
    runs.push({ cls: c, positions: new Float32Array(pts) });
  };
  for (let i = 1; i < n; i++) {
    const c = classAtIdx(i);
    if (c !== cls) {
      emit(start, i, cls);
      start = i;
      cls = c;
    }
  }
  emit(start, n - 1, cls);
  return runs.filter((r) => r.positions.length >= 6);
}

export const COMPASS: { label: string; az: number }[] = [
  { label: "N", az: 0 },
  { label: "E", az: 90 },
  { label: "S", az: 180 },
  { label: "W", az: 270 },
];

/** Camera orientation for yaw (azimuth the camera faces) and pitch (elevation it faces): the forward vector. */
export function lookVector(yawDeg: number, pitchDeg: number): Vec3 {
  return dirFromAzEl(yawDeg, pitchDeg, 1);
}

export const clampPitch = (p: number): number => Math.max(-89, Math.min(89, p));
export const clampFov = (f: number): number => Math.max(25, Math.min(100, f));

/** The state of a target as words (colour never carries it alone). */
export const STATE_WORDS: Record<IntervalClass | "none", string> = {
  V: "visible above the terrain",
  H: "hidden by terrain or below the horizon",
  U: "unresolved (inside the numerical decision band)",
  X: "uncertified (the event search could not decide)",
  G: "no data (coverage gap)",
  none: "state unknown",
};

/** A sentence for the canvas's accessible name: where things are right now, in words. */
export function describeScene(opts: {
  site: string;
  clock: string;
  targets: { label: string; az: number; el: number; cls: IntervalClass | "none" }[];
  exaggeration: number;
}): string {
  const parts = opts.targets.map(
    (t) => `${t.label} at azimuth ${t.az.toFixed(0)} degrees, elevation ${t.el.toFixed(1)} degrees, ${STATE_WORDS[t.cls]}`,
  );
  const ex = opts.exaggeration !== 1 ? ` Elevation angles are exaggerated ${opts.exaggeration} times for legibility.` : "";
  return `3D sky from ${opts.site} at ${opts.clock}: ${parts.join("; ")}. The terrain skyline is drawn as a wall around the horizon.${ex}`;
}
