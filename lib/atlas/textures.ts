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

/**
 * A tiling lunar regolith, the way the ground looks close up: fine grain at many scales, hundreds of small craters with a shadowed
 * inner wall and a bright rim on the sunward side, and scattered pebbles with a shadow each. No large blotches (they read as spots
 * on a cow once the picture repeats). Tileable: anything that crosses an edge is drawn again on the other side.
 */
export function regolithCanvas(size = 512): HTMLCanvasElement | null {
  const made = canvas(size, size);
  if (!made) return null;
  const { c, g } = made;
  const n1 = tiledNoise(11, 6);
  const n2 = tiledNoise(23, 24);
  const n3 = tiledNoise(37, 96);
  const grain = rng(5);
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const base = 0.8 + 0.09 * (n1(u * 6, v * 6) - 0.5) + 0.1 * (n2(u * 24, v * 24) - 0.5) + 0.1 * (n3(u * 96, v * 96) - 0.5);
      const g0 = Math.max(0, Math.min(1, base + (grain() - 0.5) * 0.12)); // grain
      const o = (y * size + x) * 4;
      img.data[o] = 196 * g0 + 12;
      img.data[o + 1] = 191 * g0 + 12;
      img.data[o + 2] = 182 * g0 + 12;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  const rnd = rng(77);
  const wrapped = (cx: number, cy: number, r: number, draw: (x: number, y: number) => void) => {
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        const x = cx + dx;
        const y = cy + dy;
        if (x + r < 0 || x - r > size || y + r < 0 || y - r > size) continue;
        draw(x, y);
      }
    }
  };
  const scale = size / 512;
  // craters: many small, few large; the wall away from the Sun (upper left) in shadow, the wall toward it (lower right) lit
  const count = Math.round(520 * scale * scale);
  for (let i = 0; i < count; i++) {
    const r = (2.5 + 38 * Math.pow(rnd(), 3.4)) * scale;
    const cx = rnd() * size;
    const cy = rnd() * size;
    const depth = 0.55 + rnd() * 0.45;
    wrapped(cx, cy, r * 1.3, (x, y) => {
      const shadow = g.createRadialGradient(x - r * 0.28, y - r * 0.28, r * 0.05, x, y, r);
      shadow.addColorStop(0, `rgba(0,0,0,${0.42 * depth})`);
      shadow.addColorStop(0.65, `rgba(0,0,0,${0.16 * depth})`);
      shadow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = shadow;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      const lit = g.createRadialGradient(x + r * 0.55, y + r * 0.55, r * 0.05, x + r * 0.35, y + r * 0.35, r * 0.75);
      lit.addColorStop(0, `rgba(255,250,238,${0.3 * depth})`);
      lit.addColorStop(1, "rgba(255,250,238,0)");
      g.fillStyle = lit;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = `rgba(255,250,238,${0.18 * depth})`; // the raised rim on the sunward side
      g.lineWidth = Math.max(0.8, r * 0.14);
      g.beginPath();
      g.arc(x, y, r * 1.02, Math.PI * 0.05, Math.PI * 0.6);
      g.stroke();
    });
  }
  // pebbles and small rocks, each with its shadow
  const rocks = Math.round(900 * scale * scale);
  for (let i = 0; i < rocks; i++) {
    const r = (0.7 + 2.6 * Math.pow(rnd(), 2.4)) * scale;
    const cx = rnd() * size;
    const cy = rnd() * size;
    const tone = 105 + Math.round(rnd() * 60);
    wrapped(cx, cy, r + 3, (x, y) => {
      g.fillStyle = "rgba(0,0,0,0.38)";
      g.beginPath();
      g.ellipse(x + r * 0.9, y + r * 0.9, r * 1.1, r * 0.8, 0.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = `rgb(${tone},${tone - 4},${tone - 12})`;
      g.beginPath();
      g.ellipse(x, y, r, r * 0.8, 0.5, 0, Math.PI * 2);
      g.fill();
    });
  }
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

/** A round picture cut out of a square image (the Sun from a full-frame photograph), so stray text and corners do not show. */
export function discFromImage(img: CanvasImageSource & { width: number; height: number }, inset = 0.02): HTMLCanvasElement | null {
  const size = 512;
  const made = canvas(size, size);
  if (!made) return null;
  const { c, g } = made;
  g.clearRect(0, 0, size, size);
  g.save();
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  g.clip();
  const cut = Math.round(img.width * inset);
  // the SDO frame is dim and orange-brown: lift it so the Sun reads as the brightest thing in the sky (ignored where canvas filters are unsupported)
  g.filter = "brightness(1.55) contrast(1.12) saturate(1.2)";
  g.drawImage(img, cut, cut, img.width - 2 * cut, img.height - 2 * cut, 0, 0, size, size);
  g.filter = "none";
  g.restore();
  return c;
}

/**
 * A smooth, low-contrast grey for the far terrain wall: gentle mottling stretched sideways and a slow fade from the foot to the
 * crest, so distant ridges read as plain hills in the same grey as the ground (no blotches). Tiles sideways.
 */
export function hillsideCanvas(w = 512, h = 256): HTMLCanvasElement | null {
  const made = canvas(w, h);
  if (!made) return null;
  const { c, g } = made;
  const n1 = tiledNoise(71, 8);
  const n2 = tiledNoise(83, 32);
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const soft = 0.5 * (n1(u * 8, v * 2) - 0.5) + 0.25 * (n2(u * 32, v * 8) - 0.5); // stretched sideways: long, gentle shading
      const fade = 0.92 + 0.08 * v; // a little darker at the foot
      const g0 = Math.max(0, Math.min(1, (0.78 + 0.22 * soft) * fade));
      const o = (y * w + x) * 4;
      img.data[o] = 214 * g0 + 8;
      img.data[o + 1] = 210 * g0 + 8;
      img.data[o + 2] = 200 * g0 + 8;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Soft, drifting white cloud cover for the Earth: tiled value noise (wraps sideways), transparent where the sky is clear. */
export function cloudCanvas(w = 1024, h = 512): HTMLCanvasElement | null {
  const made = canvas(w, h);
  if (!made) return null;
  const { c, g } = made;
  const hash = (x: number, y: number, s: number): number => {
    let n = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return (((n ^ (n >>> 16)) >>> 0) % 100000) / 100000;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const noise = (u: number, v: number, cells: number, s: number): number => {
    const x = u * cells;
    const y = v * (cells / 2);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const wrap = (i: number) => ((i % cells) + cells) % cells;
    const a = hash(wrap(x0), y0, s);
    const b = hash(wrap(x0 + 1), y0, s);
    const d = hash(wrap(x0), y0 + 1, s);
    const e = hash(wrap(x0 + 1), y0 + 1, s);
    return a + (b - a) * fx + (d - a) * fy + (a - b - d + e) * fx * fy;
  };
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      let amp = 0.55;
      let sum = 0;
      let norm = 0;
      for (let o = 0; o < 5; o++) {
        sum += amp * noise(u, v, 4 << o, o + 3);
        norm += amp;
        amp *= 0.5;
      }
      const f = sum / norm;
      const a = Math.min(Math.max((f - 0.5) / 0.22, 0), 1);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * a * 170);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** The Sun as the System scale draws it: a white-hot core in layered warm bloom, on a transparent square. */
export function sunBloomCanvas(size = 256): HTMLCanvasElement | null {
  const made = canvas(size, size);
  if (!made) return null;
  const { c, g } = made;
  const layer = (radius: number, stops: [number, string][]) => {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, radius);
    for (const [at, col] of stops) grad.addColorStop(at, col);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  };
  layer(size / 2, [[0, "rgba(255,214,150,0.30)"], [0.25, "rgba(255,170,90,0.12)"], [1, "rgba(255,140,60,0)"]]);
  layer(size * 0.2, [[0, "rgba(255,250,235,0.95)"], [0.2, "rgba(255,226,170,0.55)"], [0.55, "rgba(255,180,100,0.16)"], [1, "rgba(255,150,70,0)"]]);
  layer(size * 0.08, [[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,248,225,0.95)"], [0.7, "rgba(255,225,170,0.4)"], [1, "rgba(255,210,150,0)"]]);
  return c;
}

/** Pixels of a picture, read once, for sampling a sphere. */
export type PixelMap = { w: number; h: number; data: Uint8ClampedArray };
export function readPixels(img: CanvasImageSource & { width: number; height: number }, w: number, h: number): PixelMap | null {
  const made = canvas(w, h);
  if (!made) return null;
  made.g.drawImage(img, 0, 0, w, h);
  return { w, h, data: made.g.getImageData(0, 0, w, h).data };
}

/**
 * The Earth as a round picture seen from space: the equirectangular map turned so (latDeg, lonDeg) is at the centre, clouds over it,
 * soft light from the upper left and a blue glow round the edge. Used for the Earth marker in the Moon view.
 */
export function earthDiscImage(map: PixelMap, clouds: PixelMap | null, latDeg: number, lonDeg: number, size = 192): HTMLCanvasElement | null {
  const made = canvas(size, size);
  if (!made) return null;
  const { c, g } = made;
  const R = size * 0.37;
  const C = size / 2;
  const halo = g.createRadialGradient(C, C, R * 0.9, C, C, C);
  halo.addColorStop(0, "rgba(90,160,255,0.55)");
  halo.addColorStop(0.35, "rgba(70,130,255,0.18)");
  halo.addColorStop(1, "rgba(60,110,255,0)");
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  const la0 = (latDeg * Math.PI) / 180;
  const sin0 = Math.sin(la0);
  const cos0 = Math.cos(la0);
  const sample = (m: PixelMap, lat: number, lon: number, i: number): number => {
    const u = (((lon + 540) % 360) / 360) * m.w;
    const v = ((90 - lat) / 180) * m.h;
    return m.data[(Math.min(m.h - 1, Math.max(0, Math.floor(v))) * m.w + (Math.floor(u) % m.w)) * 4 + i];
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x - C) / R;
      const ny = (C - y) / R;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2);
      const lat = (Math.asin(Math.max(-1, Math.min(1, ny * cos0 + nz * sin0))) * 180) / Math.PI;
      const lon = lonDeg + (Math.atan2(nx, nz * cos0 - ny * sin0) * 180) / Math.PI;
      let r = sample(map, lat, lon, 0);
      let gr = sample(map, lat, lon, 1);
      let b = sample(map, lat, lon, 2);
      if (clouds) {
        const a = sample(clouds, lat, lon, 3) / 255;
        r += (255 - r) * a * 0.5;
        gr += (255 - gr) * a * 0.5;
        b += (255 - b) * a * 0.5;
      }
      const light = 0.62 + 0.75 * Math.max(0, -0.45 * nx + 0.4 * ny + 0.8 * nz); // soft light from the upper left
      const rim = Math.pow(1 - nz, 3) * 0.9; // blue haze at the limb
      const i = (y * size + x) * 4;
      img.data[i] = Math.min(255, r * light + rim * 70);
      img.data[i + 1] = Math.min(255, gr * light + rim * 130);
      img.data[i + 2] = Math.min(255, b * light + rim * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
