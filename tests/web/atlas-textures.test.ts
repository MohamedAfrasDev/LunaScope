import { afterEach, describe, expect, it, vi } from "vitest";
import { skylineWall, skylineWallUv } from "@/lib/sky3d";
import { earthCanvas, glowCanvas, regolithCanvas } from "@/lib/atlas/textures";

describe("skylineWallUv", () => {
  const az = [0, 90, 180, 270];
  it("has two coordinates for every vertex of the wall, in the same order, and skips the bins the wall skips", () => {
    for (const el of [[1, 2, 3, 4], [1, 2, null, 4], [null, null, null, null]] as (number | null)[][]) {
      const wall = skylineWall(az, el, 10, -8, 1);
      const uv = skylineWallUv(az, el, 10, 0.3);
      expect(uv.length / 2).toBe(wall.positions.length / 3);
    }
  });

  it("goes round the circle once per repeat and floor to top across the span", () => {
    const uv = skylineWallUv([0, 90, 180, 270], [1, 1, 1, 1], 8, 0.5);
    // first bin: floor and top at u = 0, floor and top at u = 8 / 4
    expect(Array.from(uv.slice(0, 8))).toEqual([0, 0, 0, 0.5, 2, 0, 2, 0.5]);
    // the last bin ends at the full repeat, with no wrap back to zero
    expect(uv[uv.length - 2]).toBe(8);
  });
});

describe("procedural pictures", () => {
  /** A stand-in 2D canvas: enough of the API to run the drawing code and read back the pixels. */
  function fake() {
    const made: { w: number; h: number; data: Uint8ClampedArray; stops: number }[] = [];
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag !== "canvas") throw new Error(tag);
      const rec = { w: 0, h: 0, data: new Uint8ClampedArray(0), stops: 0 };
      made.push(rec);
      const el = {
        set width(v: number) { rec.w = v; },
        get width() { return rec.w; },
        set height(v: number) { rec.h = v; },
        get height() { return rec.h; },
        getContext: () => ({
          createImageData: (w: number, h: number) => ((rec.data = new Uint8ClampedArray(w * h * 4)), { data: rec.data }),
          putImageData: () => {},
          createRadialGradient: () => ({ addColorStop: () => (rec.stops += 1) }),
          fillRect: () => {},
          set fillStyle(_v: unknown) {},
        }),
      };
      return el as unknown as HTMLCanvasElement;
    }) as typeof document.createElement);
    return made;
  }
  afterEach(() => vi.restoreAllMocks());

  it("the regolith is drawn at the size asked, opaque, grey, and the same every time", () => {
    const a = fake();
    const c = regolithCanvas(32)!;
    expect(c.width).toBe(32);
    expect(c.height).toBe(32);
    const first = Array.from(a[0].data);
    expect(first.every((v, i) => (i % 4 === 3 ? v === 255 : v >= 0 && v <= 255))).toBe(true);
    // grey: red, green and blue stay close together
    for (let i = 0; i < first.length; i += 4) expect(Math.abs(first[i] - first[i + 2])).toBeLessThan(30);
    vi.restoreAllMocks();
    const b = fake();
    regolithCanvas(32);
    expect(Array.from(b[0].data)).toEqual(first);
    // and it is not flat: there is mottling
    expect(new Set(first.filter((_, i) => i % 4 === 0)).size).toBeGreaterThan(20);
  });

  it("the globe has oceans, land and ice and the same pixels every time", () => {
    const a = fake();
    earthCanvas(64, 32);
    const px = Array.from(a[0].data);
    const reds = px.filter((_, i) => i % 4 === 0);
    const blues = px.filter((_, i) => i % 4 === 2);
    expect(Math.min(...reds)).toBeLessThan(60); // ocean
    expect(Math.max(...blues)).toBeGreaterThan(220); // ice and cloud
    expect(px.every((v) => v >= 0 && v <= 255)).toBe(true);
    // the top row is the pole, so it is ice or cloud: bright
    const top = px.slice(0, 64 * 4).filter((_, i) => i % 4 === 0);
    expect(top.reduce((s, v) => s + v, 0) / top.length).toBeGreaterThan(150);
    vi.restoreAllMocks();
    const b = fake();
    earthCanvas(64, 32);
    expect(Array.from(b[0].data)).toEqual(px);
  });

  it("the glow is a gradient that fades to nothing", () => {
    const a = fake();
    const c = glowCanvas(64, "rgba(255,255,255,1)", "rgba(255,200,120,0.4)");
    expect(c?.width).toBe(64);
    expect(a[0].stops).toBe(4);
  });

  it("without a 2D canvas (an old device) they return nothing instead of failing", () => {
    vi.spyOn(document, "createElement").mockImplementation((() => ({ getContext: () => null })) as unknown as typeof document.createElement);
    expect(regolithCanvas()).toBeNull();
    expect(earthCanvas()).toBeNull();
    expect(glowCanvas(8, "red", "blue")).toBeNull();
  });
});
