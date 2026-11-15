import { describe, expect, it } from "vitest";
import {
  MAX_HEIGHT_M,
  MIN_HEIGHT_M,
  VIEWS,
  formatHeight,
  formatLatLon,
  headingDegrees,
  keyStep,
  niceScale,
} from "@/lib/explore/geometry";

describe("niceScale", () => {
  it("picks the largest 1, 2 or 5 times a power of ten that fits", () => {
    expect(niceScale(10_000, 110)).toMatchObject({ metres: 1_000_000, label: "1000 km" });
    expect(niceScale(5_000, 110)).toMatchObject({ metres: 500_000, label: "500 km" });
    expect(niceScale(20, 110)).toMatchObject({ metres: 2_000, label: "2 km" });
    expect(niceScale(1, 110)).toMatchObject({ metres: 100, label: "100 m" });
  });
  it("never draws a bar longer than the limit", () => {
    for (const m of [0.7, 3, 41, 777, 12_345, 250_000]) {
      const s = niceScale(m, 110)!;
      expect(s.px).toBeLessThanOrEqual(110);
      expect(s.px).toBeGreaterThan(110 / 10);
    }
  });
  it("returns nothing for unusable input", () => {
    for (const bad of [0, -1, NaN, Infinity]) expect(niceScale(bad)).toBeNull();
  });
});

describe("formatLatLon", () => {
  it("shows hemispheres and wraps the longitude into -180..180", () => {
    expect(formatLatLon(-89.5, 0)).toBe("89.5° S · 0.0° E");
    expect(formatLatLon(12.34, 190)).toBe("12.3° N · 170.0° W");
    expect(formatLatLon(0, -540)).toBe("0.0° N · 180.0° W");
    expect(formatLatLon(-0.0004, 0)).toBe("0.0° N · 0.0° E");
  });
});

describe("formatHeight and headingDegrees", () => {
  it("uses kilometres from 10 km up and metres below", () => {
    expect(formatHeight(4_800_000)).toBe("4,800 km");
    expect(formatHeight(9_999)).toBe("9,999 m");
    expect(formatHeight(Number.NaN)).toBe("");
  });
  it("turns radians into whole degrees 0..359", () => {
    expect(headingDegrees(0)).toBe(0);
    expect(headingDegrees(Math.PI / 2)).toBe(90);
    expect(headingDegrees(-Math.PI / 2)).toBe(270);
    expect(headingDegrees(2 * Math.PI)).toBe(0);
  });
});

describe("views and limits", () => {
  it("the two named views are inside the allowed height range", () => {
    for (const v of Object.values(VIEWS)) {
      expect(v.heightM).toBeGreaterThan(MIN_HEIGHT_M);
      expect(v.heightM).toBeLessThan(MAX_HEIGHT_M);
    }
    expect(VIEWS["south-pole"].lat).toBe(-90);
  });
  it("a key press scales with height, so it feels the same near and far", () => {
    const near = keyStep(10_000);
    const far = keyStep(10_000_000);
    expect(near.zoomM).toBeLessThan(far.zoomM);
    expect(near.rotateRad).toBeLessThan(far.rotateRad);
    expect(far.zoomM).toBeCloseTo(2_500_000);
  });
});
