/**
 * An illustrative stretch of lunar ground, used in Site sky only when the real DEM patch for the site is not available. It is NOT the
 * site's terrain: it is a plausible surface (gentle undulation, craters of many sizes with raised rims, a level spot under the
 * observer) so the ground reads as ground and not as a flat disc. The skyline wall and every visibility result still come from the
 * service; this only fills in what you stand on, and the scene says so. Deterministic: the same name always gives the same ground.
 */

export const SYNTHETIC_SIZE = 193;
export const SYNTHETIC_RADIUS_KM = 0.7;
export const SYNTHETIC_STEP_M = (SYNTHETIC_RADIUS_KM * 1000 * 2) / (SYNTHETIC_SIZE - 1);
export const MOON_RADIUS_M = 1_737_400;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Heights in metres relative to the observer's ground; row 0 north, column 0 west (the same layout as the service's patch). */
export function syntheticHeights(seedKey: string): Float32Array {
  const n = SYNTHETIC_SIZE;
  const seed = hashString(seedKey || "site");
  const rnd = mulberry32(seed);
  const out = new Float32Array(n * n);
  const half = (n - 1) / 2;
  const stepM = SYNTHETIC_STEP_M;

  // smooth undulation: value noise at a few scales
  const lattice = (ix: number, iy: number, s: number) => {
    let h = (ix * 374761393 + iy * 668265263 + (seed ^ s) * 982451653) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return (((h ^ (h >>> 16)) >>> 0) % 100000) / 100000;
  };
  const noise = (x: number, y: number, s: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const a = lattice(x0, y0, s);
    const b = lattice(x0 + 1, y0, s);
    const c = lattice(x0, y0 + 1, s);
    const d = lattice(x0 + 1, y0 + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };

  // craters: many small, a few large, bowl with a raised rim, older ones softer
  const craters: { x: number; y: number; r: number; depth: number }[] = [];
  const half_m = half * stepM;
  for (let i = 0; i < 170; i++) {
    const u = rnd();
    const r = 6 + 230 * Math.pow(u, 3.2); // power law: small craters far outnumber large ones
    const x = (rnd() * 2 - 1) * half_m;
    const y = (rnd() * 2 - 1) * half_m;
    if (Math.hypot(x, y) < r + 22) continue; // keep the spot under the observer level
    craters.push({ x, y, r, depth: r * (0.1 + rnd() * 0.12) });
  }

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const east = (col - half) * stepM;
      const north = (half - row) * stepM;
      const px = (col / (n - 1)) * 6;
      const py = (row / (n - 1)) * 6;
      let h =
        (noise(px, py, 1) - 0.5) * 9 + // long gentle swells
        (noise(px * 3.1, py * 3.1, 2) - 0.5) * 3.2 +
        (noise(px * 9.7, py * 9.7, 3) - 0.5) * 0.9; // fine roughness
      for (const c of craters) {
        const dx = east - c.x;
        const dy = north - c.y;
        const d = Math.hypot(dx, dy);
        if (d > c.r * 1.9) continue;
        const q = d / c.r;
        if (q < 1) h += -c.depth * (1 - q * q) + 0.22 * c.depth * q * q * q * q; // bowl, flat-ish floor
        else h += 0.3 * c.depth * Math.exp(-Math.pow((q - 1) / 0.28, 2)); // raised rim
      }
      // level under the observer, and a gentle fade at the edge so the ground meets the skyline wall without a cliff
      const rm = Math.hypot(east, north);
      const centre = smooth(Math.min(Math.max((rm - 12) / 40, 0), 1));
      const edge = 1 - smooth(Math.min(Math.max((rm / (SYNTHETIC_RADIUS_KM * 1000) - 0.82) / 0.18, 0), 1));
      out[row * n + col] = h * centre * edge;
    }
  }
  return out;
}

/** A DEM patch with next to no relief (the demonstration runs have one): standing on it looks like a flat table, so the stand-in ground is used. */
export const FLAT_RELIEF_M = 25;
export function reliefOf(heights: Float32Array): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const h of heights) {
    if (!Number.isFinite(h)) continue;
    if (h < lo) lo = h;
    if (h > hi) hi = h;
  }
  return Number.isFinite(lo) ? hi - lo : 0;
}

/**
 * Fine surface detail to lay over a real DEM, which is too coarse (150 m cells) to show the craters and swells you would see standing
 * there. Returns the detail's height, in scene units, at a scene position (x east, z south), for the same units the stand-in ground uses.
 * Illustrative: the large-scale shape stays the DEM's.
 */
export function detailSampler(seedKey: string, sceneRadius: number): (x: number, z: number) => number {
  const grid = syntheticHeights(seedKey);
  const n = SYNTHETIC_SIZE;
  const unitM = (SYNTHETIC_RADIUS_KM * 1000) / sceneRadius; // metres per scene unit for the detail
  const half = (n - 1) / 2;
  return (x, z) => {
    const col = (x * unitM) / SYNTHETIC_STEP_M + half;
    const row = half - (-z * unitM) / SYNTHETIC_STEP_M;
    if (col < 0 || row < 0 || col > n - 1 || row > n - 1) return 0;
    const c0 = Math.floor(col);
    const r0 = Math.floor(row);
    const c1 = Math.min(c0 + 1, n - 1);
    const r1 = Math.min(r0 + 1, n - 1);
    const fx = col - c0;
    const fy = row - r0;
    const a = grid[r0 * n + c0];
    const b = grid[r0 * n + c1];
    const d = grid[r1 * n + c0];
    const e = grid[r1 * n + c1];
    const h = a + (b - a) * fx + (d - a) * fy + (a - b - d + e) * fx * fy;
    return h / unitM;
  };
}
