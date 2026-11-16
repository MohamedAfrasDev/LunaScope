/**
 * Real ground for the Site sky picture (display only, never a visibility result).
 *
 * The service sends a square grid of DEM heights around the site (`/terrain/patch`). This turns it into a mesh in the scene's units:
 * the patch radius is mapped to `SCENE_RADIUS`, the Moon's curvature drop d^2 / 2R is subtracted so far ground falls away, and
 * cells with no height are left as holes (never guessed). The shading is a plain "facing the Sun" factor with no cast shadows, so it
 * is an illustration of the ground's shape; whether the Sun is visible always comes from the service's skyline and intervals.
 */

export const SCENE_RADIUS = 9.8; // scene units; the skyline wall stands at 10

export type TerrainPatch = {
  schema: string;
  size: number;
  step_m: number;
  radius_km: number;
  unit_m: number;
  nodata: number;
  ground_height_m: number;
  reference_radius_m: number;
  covered_fraction: number;
  heights_b64: string;
  result_state?: string;
};

/** Heights in metres relative to the site's ground, row 0 north and column 0 west; NaN where the service had no height. */
export function decodeHeights(p: Pick<TerrainPatch, "size" | "unit_m" | "nodata" | "heights_b64">): Float32Array {
  const bin = atob(p.heights_b64);
  if (bin.length !== p.size * p.size * 2) throw new Error("terrain patch has the wrong size");
  const out = new Float32Array(p.size * p.size);
  for (let i = 0; i < out.length; i++) {
    let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v === p.nodata ? Number.NaN : v * p.unit_m;
  }
  return out;
}

export type TerrainMesh = {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  /** Lowest scene height of any vertex (for placing the backing disc under everything). */
  minY: number;
};

/**
 * Scene axes: x east, y up, z south (so north is -z). `exaggeration` multiplies relief only (the sky look's slider).
 * Triangles with a missing corner, or a corner outside the scene radius, are left out.
 */
export function buildTerrainMesh(
  heights: Float32Array,
  size: number,
  stepM: number,
  radiusKm: number,
  referenceRadiusM: number,
  exaggeration = 1,
  uvPerUnit = 14,
): TerrainMesh {
  const unit = (radiusKm * 1000) / SCENE_RADIUS; // metres per scene unit
  const half = (size - 1) / 2;
  const positions = new Float32Array(size * size * 3);
  const uvs = new Float32Array(size * size * 2);
  const ok = new Uint8Array(size * size);
  let minY = Infinity;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      const east = (c - half) * stepM;
      const north = (half - r) * stepM;
      const d2 = east * east + north * north;
      const h = heights[i];
      const x = east / unit;
      const z = -north / unit;
      const y = Number.isFinite(h) ? (h * exaggeration - d2 / (2 * referenceRadiusM)) / unit : 0;
      positions[3 * i] = x;
      positions[3 * i + 1] = y;
      positions[3 * i + 2] = z;
      uvs[2 * i] = x * uvPerUnit;
      uvs[2 * i + 1] = z * uvPerUnit;
      if (Number.isFinite(h) && Math.hypot(x, z) <= SCENE_RADIUS) {
        ok[i] = 1;
        if (y < minY) minY = y;
      }
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const a = r * size + c;
      const b = a + 1;
      const d = a + size;
      const e = d + 1;
      if (ok[a] && ok[b] && ok[d] && ok[e]) idx.push(a, d, b, b, d, e); // counter-clockwise seen from above
    }
  }
  return { positions, uvs, indices: Uint32Array.from(idx), minY: Number.isFinite(minY) ? minY : 0 };
}

/** The unit vector toward the Sun in scene axes, from azimuth and elevation (degrees, azimuth from north towards east). */
export function sunVector(azDeg: number, elDeg: number): [number, number, number] {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  return [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)];
}

/** How bright the ground is with no Sun on it (a little is left so the shape is not lost), and the level of sunlit flat ground. */
export const NIGHT_LEVEL = 0.16;
export const SUNLIT_LEVEL = 0.84;

/**
 * Brightness per vertex from its normal. `direct` is 0 when the service says the Sun is not visible from the site (below the horizon
 * or behind terrain): the ground is then dark. With the Sun on it the ground is bright, near white, and slopes that face the Sun are
 * brighter and slopes that face away are darker (sunlit regolith stays bright even in a low Sun, so the light is not simply the cosine).
 */
export function shadeColors(normals: ArrayLike<number>, sun: [number, number, number], direct: number, out: Float32Array): Float32Array {
  const n = normals.length / 3;
  for (let i = 0; i < n; i++) {
    const facing = normals[3 * i] * sun[0] + normals[3 * i + 1] * sun[1] + normals[3 * i + 2] * sun[2];
    const lit = Math.min(1, Math.max(0.3, SUNLIT_LEVEL + 0.26 * Math.max(-1, Math.min(1, facing * 6))));
    const v = NIGHT_LEVEL + (lit - NIGHT_LEVEL) * (direct > 0 ? 1 : 0);
    out[3 * i] = v;
    out[3 * i + 1] = v;
    out[3 * i + 2] = v;
  }
  return out;
}
