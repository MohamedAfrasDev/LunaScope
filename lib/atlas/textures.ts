/**
 * Procedural pictures for the Site sky scene (redesign phase I): regolith for the ground and the terrain wall, a globe for the
 * Earth, and a glow for the Sun. They are drawn, not photographed: the Earth and the ground are ILLUSTRATIONS and the scene says
 * so. Seeded, so the same picture is drawn every time. Browser only (they use a 2D canvas).
 */

function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise on an integer lattice that repeats every `period` cells, so a texture tiles without seams. */
function tiledNoise(seed: number, period: number): (x: number, y: number) => number {
  const r = rng(seed);
  const grid = Float32Array.from({ length: period * period }, () => r());
  const at = (i: number, j: number) => grid[(((j % period) + period) % period) * period + (((i % period) + period) % period)];
  return (x, y) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = smooth(x - i);
    const fy = smooth(y - j);
    return at(i, j) * (1 - fx) * (1 - fy) + at(i + 1, j) * fx * (1 - fy) + at(i, j + 1) * (1 - fx) * fy + at(i + 1, j + 1) * fx * fy;
  };
}

/** Value noise in 3D from a hash, for the Earth (no seam on a sphere). */
function noise3(seed: number): (x: number, y: number, z: number) => number {
  const h = (x: number, y: number, z: number) => {
    let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  return (x, y, z) => {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
    const fx = smooth(x - i), fy = smooth(y - j), fz = smooth(z - k);
    const l = (a: number, b: number, c: number) => h(i + a, j + b, k + c);
    const x00 = l(0, 0, 0) * (1 - fx) + l(1, 0, 0) * fx;
    const x10 = l(0, 1, 0) * (1 - fx) + l(1, 1, 0) * fx;
    const x01 = l(0, 0, 1) * (1 - fx) + l(1, 0, 1) * fx;
    const x11 = l(0, 1, 1) * (1 - fx) + l(1, 1, 1) * fx;
    return (x00 * (1 - fy) + x10 * fy) * (1 - fz) + (x01 * (1 - fy) + x11 * fy) * fz;
  };
}

function canvas(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } | null {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  return g ? { c, g } : null;
}

/** A tiling grey regolith: soft mottling, darker patches and fine grain. */
export function regolithCanvas(size = 512): HTMLCanvasElement | null {
  const made = canvas(size, size);
  if (!made) return null;
  const { c, g } = made;
  const n1 = tiledNoise(11, 8);
  const n2 = tiledNoise(23, 16);
  const n3 = tiledNoise(37, 64);
  const grain = rng(5);
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const base = 0.8 + 0.3 * (n1(u * 8, v * 8) - 0.5) + 0.18 * (n2(u * 16, v * 16) - 0.5) + 0.08 * (n3(u * 64, v * 64) - 0.5);
      const patch = n2(u * 16 + 3.3, v * 16 + 1.7);
      const shade = patch > 0.6 ? 0.7 + (0.6 - patch) * 0.6 : 1; // darker mottled patches
      const g0 = Math.max(0, Math.min(1, base * shade + (grain() - 0.5) * 0.05));
      const o = (y * size + x) * 4;
      img.data[o] = 214 * g0 + 8;
      img.data[o + 1] = 210 * g0 + 8;
      img.data[o + 2] = 200 * g0 + 8;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** A globe, equirectangular: oceans, land, polar ice and cloud. An illustration of an Earth, not an image of it. */
export function earthCanvas(w = 512, h = 256): HTMLCanvasElement | null {
  const made = canvas(w, h);
  if (!made) return null;
  const { c, g } = made;
  const land = noise3(101);
  const cloud = noise3(202);
  const fbm = (f: (x: number, y: number, z: number) => number, x: number, y: number, z: number, o = 4) => {
    let a = 0, amp = 0.5, fr = 1;
    for (let i = 0; i < o; i++) {
      a += amp * f(x * fr, y * fr, z * fr);
      amp *= 0.5;
      fr *= 2.1;
    }
    return a;
  };
  const img = g.createImageData(w, h);
  for (let py = 0; py < h; py++) {
    const lat = (0.5 - (py + 0.5) / h) * Math.PI;
    for (let px = 0; px < w; px++) {
      const lon = ((px + 0.5) / w) * 2 * Math.PI;
      const x = Math.cos(lat) * Math.cos(lon);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.sin(lon);
      const l = fbm(land, x * 1.8 + 4, y * 1.8 + 4, z * 1.8 + 4);
      const isLand = l > 0.5;
      let r: number, gr: number, b: number;
      if (isLand) {
        const dry = fbm(land, x * 3 + 9, y * 3 + 9, z * 3 + 9, 3);
        const t = Math.min(1, Math.max(0, (dry - 0.35) * 2.2 + (Math.abs(lat) < 0.5 ? 0.15 : -0.1)));
        r = 70 + 110 * t; gr = 105 + 55 * t - 40 * t * t; b = 55 + 20 * t;
      } else {
        const d = Math.min(1, (0.5 - l) * 3);
        r = 14 + 14 * (1 - d); gr = 52 + 40 * (1 - d); b = 120 + 70 * (1 - d);
      }
      if (Math.abs(lat) > 1.18 + 0.1 * fbm(land, x * 4, y * 4, z * 4, 2)) { r = 232; gr = 238; b = 245; } // polar ice
      const cl = fbm(cloud, x * 3.4 + 20, y * 4.6 + 20, z * 3.4 + 20, 5);
      const a = Math.min(1, Math.max(0, (cl - 0.5) * 3.2));
      r = r * (1 - a) + 248 * a; gr = gr * (1 - a) + 250 * a; b = b * (1 - a) + 252 * a;
      const o = (py * w + px) * 4;
      img.data[o] = r; img.data[o + 1] = gr; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** A soft round glow: a bright core fading through `mid` to nothing. Colours are CSS strings. */
export function glowCanvas(size: number, core: string, mid: string): HTMLCanvasElement | null {
  const made = canvas(size, size);
  if (!made) return null;
  const { c, g } = made;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, core);
  grad.addColorStop(0.12, core);
  grad.addColorStop(0.32, mid);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}
