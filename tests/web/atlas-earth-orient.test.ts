import { describe, expect, it } from "vitest";
import { gmstDeg, julianDate, moonRaDec, sphereDirection, subLunarPoint } from "@/lib/atlas/earth-orient";

const H = 3600_000;

describe("time and sidereal time", () => {
  it("knows the Julian date of the epochs it is checked against", () => {
    expect(julianDate(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(2451545.0, 6);
    expect(julianDate(Date.UTC(1970, 0, 1))).toBeCloseTo(2440587.5, 6);
  });

  it("GMST at J2000 is the standard 280.46 degrees, and advances about 15.04 degrees an hour", () => {
    expect(gmstDeg(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(280.4606, 3);
    const a = gmstDeg(Date.UTC(2026, 10, 15, 0));
    const b = gmstDeg(Date.UTC(2026, 10, 15, 1));
    expect((b - a + 360) % 360).toBeCloseTo(15.0411, 3);
  });
});

describe("the Moon's place in the sky", () => {
  it("stays within the declination band the Moon can reach, over a lunar month", () => {
    const t0 = Date.UTC(2026, 10, 1);
    let min = 90, max = -90;
    for (let h = 0; h < 30 * 24; h += 6) {
      const { decDeg, raDeg } = moonRaDec(t0 + h * H);
      min = Math.min(min, decDeg);
      max = Math.max(max, decDeg);
      expect(raDeg).toBeGreaterThanOrEqual(0);
      expect(raDeg).toBeLessThan(360);
    }
    expect(max).toBeLessThan(29.5);
    expect(min).toBeGreaterThan(-29.5);
    expect(max - min).toBeGreaterThan(40); // it does swing across a wide band within a month
  });

  it("agrees with a known position: the Moon on 1992 April 12 at 0h TD was at RA 134.7 degrees, Dec 13.8 degrees (Meeus)", () => {
    const { raDeg, decDeg } = moonRaDec(Date.UTC(1992, 3, 12, 0));
    expect(raDeg).toBeGreaterThan(133.5);
    expect(raDeg).toBeLessThan(136);
    expect(decDeg).toBeGreaterThan(13);
    expect(decDeg).toBeLessThan(14.8);
  });
});

describe("which side of the Earth faces the Moon", () => {
  it("turns westward as the Earth turns: about 14.5 degrees an hour, so the continents move as the clock runs", () => {
    const t = Date.UTC(2026, 10, 18, 9);
    const a = subLunarPoint(t);
    const b = subLunarPoint(t + H);
    let d = b.lonDeg - a.lonDeg;
    d = ((d + 540) % 360) - 180;
    expect(d).toBeGreaterThan(-14.9);
    expect(d).toBeLessThan(-14.0);
    expect(Math.abs(b.latDeg - a.latDeg)).toBeLessThan(0.6); // the latitude changes slowly
  });

  it("is a full turn in about a day: the same longitude returns after 24.84 hours (a lunar day)", () => {
    const t = Date.UTC(2026, 10, 18, 9);
    const a = subLunarPoint(t);
    const b = subLunarPoint(t + 24.84 * H);
    let d = b.lonDeg - a.lonDeg;
    d = ((d + 540) % 360) - 180;
    expect(Math.abs(d)).toBeLessThan(6);
  });

  it("returns longitudes from -180 to 180 and latitudes within the Moon's reach", () => {
    for (let h = 0; h < 100; h += 7) {
      const p = subLunarPoint(Date.UTC(2027, 0, 10) + h * H);
      expect(p.lonDeg).toBeGreaterThanOrEqual(-180);
      expect(p.lonDeg).toBeLessThanOrEqual(180);
      expect(Math.abs(p.latDeg)).toBeLessThan(29.5);
    }
  });
});

describe("sphereDirection", () => {
  it("puts the middle of the picture on +x, the north pole up, and east toward -z", () => {
    const [x, y, z] = sphereDirection(0, 0);
    expect([x, y, z].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1, 0, -0]);
    expect(sphereDirection(90, 0)[1]).toBeCloseTo(1, 9);
    expect(sphereDirection(0, 90)[2]).toBeCloseTo(-1, 9);
    expect(sphereDirection(0, -90)[2]).toBeCloseTo(1, 9);
  });

  it("is always a unit vector", () => {
    for (const [la, lo] of [[10, 20], [-45, 170], [80, -120]] as const) {
      const [x, y, z] = sphereDirection(la, lo);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 9);
    }
  });
});
