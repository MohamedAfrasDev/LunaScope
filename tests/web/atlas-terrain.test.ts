import { describe, expect, it } from "vitest";
import { matchRoute } from "@/lib/bff";
import { NIGHT_LEVEL, SCENE_RADIUS, buildTerrainMesh, decodeHeights, shadeColors, sunVector } from "@/lib/atlas/terrain";

function pack(values: number[]): string {
  const b = new Uint8Array(values.length * 2);
  values.forEach((v, i) => {
    const u = v < 0 ? v + 0x10000 : v;
    b[2 * i] = u & 255;
    b[2 * i + 1] = u >> 8;
  });
  return btoa(String.fromCharCode(...b));
}

describe("decodeHeights", () => {
  it("reads little-endian signed 16-bit in half-metre units and turns the nodata value into NaN", () => {
    const h = decodeHeights({ size: 2, unit_m: 0.5, nodata: -32768, heights_b64: pack([0, 100, -4, -32768]) });
    expect(Array.from(h).slice(0, 3)).toEqual([0, 50, -2]);
    expect(Number.isNaN(h[3])).toBe(true);
  });

  it("refuses a patch whose size does not match", () => {
    expect(() => decodeHeights({ size: 3, unit_m: 0.5, nodata: -32768, heights_b64: pack([0, 0]) })).toThrow();
  });
});

describe("buildTerrainMesh", () => {
  const flat = (n: number) => new Float32Array(n * n);

  it("puts north at -z (row 0) and east at +x (last column), and maps the patch radius to the scene radius", () => {
    const n = 5;
    const m = buildTerrainMesh(flat(n), n, 1000, 2, 1_737_400);
    const p = m.positions;
    const corner = (r: number, c: number) => [p[3 * (r * n + c)], p[3 * (r * n + c) + 2]];
    expect(corner(0, 2)[1]).toBeLessThan(0); // north is -z
    expect(corner(4, 2)[1]).toBeGreaterThan(0);
    expect(corner(2, 4)[0]).toBeGreaterThan(0); // east is +x
    expect(corner(2, 4)[0]).toBeCloseTo(SCENE_RADIUS, 5);
  });

  it("drops the ground away with the Moon's curvature and scales relief by the exaggeration", () => {
    const n = 3;
    const h = flat(n);
    h[4] = 100; // the middle: 100 m up at the site
    const a = buildTerrainMesh(h, n, 10_000, 10, 1_737_400, 1);
    const b = buildTerrainMesh(h, n, 10_000, 10, 1_737_400, 3);
    const unit = 10_000 / SCENE_RADIUS;
    expect(a.positions[3 * 4 + 1]).toBeCloseTo(100 / unit, 6);
    expect(b.positions[3 * 4 + 1]).toBeCloseTo(300 / unit, 6);
    // 10 km out on flat ground is 10000^2 / (2 R) = 28.8 m lower
    expect(a.positions[3 * 5 + 1]).toBeCloseTo(-(10_000 ** 2) / (2 * 1_737_400) / unit, 6);
  });

  it("leaves holes where there is no height and never invents a triangle across them", () => {
    const n = 4;
    const h = flat(n);
    h[5] = Number.NaN;
    const m = buildTerrainMesh(h, n, 100, 1, 1_737_400);
    expect(m.indices.length).toBe(((n - 1) * (n - 1) - 4) * 6); // the four cells that touch vertex 5
    expect(Array.from(m.indices)).not.toContain(5);
  });

  it("faces up: counter-clockwise seen from above", () => {
    const m = buildTerrainMesh(flat(3), 3, 100, 1, 1_737_400);
    const [a, b, c] = [m.indices[0], m.indices[1], m.indices[2]].map((i) => [m.positions[3 * i], m.positions[3 * i + 2]]);
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    expect(cross).toBeLessThan(0); // x east, z south: this is counter-clockwise from above
  });
});

describe("shading", () => {
  it("sunVector points north on -z and east on +x", () => {
    expect(sunVector(0, 0).map((v) => Math.round(v))).toEqual([0, 0, -1].map((v) => v || 0));
    expect(sunVector(90, 0)[0]).toBeCloseTo(1, 6);
    expect(sunVector(0, 90)[1]).toBeCloseTo(1, 6);
  });

  it("lights a slope toward the Sun, leaves one away from it at the ambient floor, and is only ambient when the Sun is not visible", () => {
    const toward = [0, 0.6, -0.8];
    const away = [0, 0.6, 0.8];
    const out = new Float32Array(6);
    const sun = sunVector(0, 30); // low in the north
    shadeColors([...toward, ...away], sun, 1, out);
    expect(out[0]).toBeGreaterThan(out[3]); // the slope facing the Sun is brighter than the one facing away
    expect(out[3]).toBeGreaterThan(0.3); // and with the Sun up, even that one stays well lit
    shadeColors([...toward, ...away], sun, 0, out);
    expect(out[0]).toBeCloseTo(NIGHT_LEVEL, 6); // no Sun: dark everywhere
    expect(out[3]).toBeCloseTo(NIGHT_LEVEL, 6);
  });
});

describe("the terrain route of the web proxy", () => {
  const s = (q: string) => new URLSearchParams(q);
  it("forwards only well-formed numeric queries", () => {
    const ok = matchRoute("GET", ["terrain", "patch"], s("lat_deg=-89.5&lon_east_deg=222.25&radius_km=25&step_m=150"));
    expect(ok.ok && ok.match.upstreamPath).toBe("/api/v1/terrain/patch");
    expect(matchRoute("GET", ["terrain", "patch"], s("lat_deg=abc&lon_east_deg=1")).ok).toBe(false);
    expect(matchRoute("GET", ["terrain", "patch"], s("evil=1")).ok).toBe(false);
    expect(matchRoute("POST", ["terrain", "patch"], s("")).ok).toBe(false);
  });
});
