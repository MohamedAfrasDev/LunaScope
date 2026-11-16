/**
 * The skyline as mountains. The top edge is exactly the service's horizon profile (so what is hidden behind it is unchanged); the
 * body below it is drawn as rock: a stack of rows that darken toward the foot (haze and shade), a lit rim along the crest, faces
 * that are steep in the data shaded darker so they read as slopes, and rock-like mottling. Display only.
 */
import { dirFromAzEl, exaggerate } from "@/lib/sky3d";

export type MountainMesh = { positions: Float32Array; colors: Float32Array; uvs: Float32Array; indices: Uint32Array };

const hash = (n: number): number => {
  let h = (n * 374761393) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (((h ^ (h >>> 16)) >>> 0) % 100000) / 100000;
};
/** Smooth value noise along a line (no per-bin streaks): about one feature per `period` units. */
const smoothNoise = (x: number, period: number, salt: number): number => {
  const u = x / period;
  const i = Math.floor(u);
  const f = u - i;
  const t = f * f * (3 - 2 * f);
  return hash(i * 977 + salt) * (1 - t) + hash((i + 1) * 977 + salt) * t;
};

export function mountainWall(
  azimuthDeg: number[],
  horizonElDeg: (number | null)[],
  R: number,
  floorEl: number,
  k: number,
  rows = 9,
  uRepeat = 6,
): MountainMesh {
  const n = azimuthDeg.length;
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const step = n > 1 ? Math.abs(azimuthDeg[1] - azimuthDeg[0]) || 1 : 1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = horizonElDeg[i];
    const b = horizonElDeg[j];
    if (a == null || b == null) continue;
    const slope = Math.min(Math.abs(b - a) / step / 2, 1); // how steep this face is in the data: 0 flat, 1 very steep
    const base = pos.length / 3;
    for (const [bin, el] of [[i, a], [j, b]] as const) {
      const az = bin === j && j === 0 ? azimuthDeg[bin] + 360 : azimuthDeg[bin]; // the last bin closes the circle
      const top = exaggerate(el, k);
      for (let r = 0; r <= rows; r++) {
        const t = r / rows;
        const e = top + (floorEl - top) * Math.pow(t, 1.35);
        pos.push(...dirFromAzEl(az, e, R));
        // rock tone: a little shade toward the foot (it meets the ground, which is lit the same way), a lit rim at the crest, steep faces
        // darker, and broad soft mottling that varies along the horizon and down the face (never a stripe per bin)
        const mottle = (smoothNoise(bin, 9, r * 31 + 5) - 0.5) * 0.2 + (smoothNoise(bin, 2.5, r * 17 + 11) - 0.5) * 0.08;
        const rim = r === 0 ? 1.12 : 1;
        const v = Math.min(1.2, Math.max(0.3, (0.96 - 0.22 * Math.pow(t, 0.8)) * (1 - 0.3 * slope) * rim + mottle));
        col.push(v, v * 0.985, v * 0.95); // a slightly warm grey
        uv.push((bin / n) * uRepeat, t * 0.22);
      }
    }
    // two columns of (rows + 1) vertices: the first is bin i, the second bin j
    const w = rows + 1;
    for (let r = 0; r < rows; r++) {
      const i0 = base + r;
      const i1 = base + r + 1;
      const j0 = base + w + r;
      const j1 = base + w + r + 1;
      idx.push(i0, j0, i1, i1, j0, j1);
    }
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col), uvs: new Float32Array(uv), indices: new Uint32Array(idx) };
}
