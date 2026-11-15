import { describe, expect, it } from "vitest";
import { subSolarPoint, sunDirection } from "@/lib/atlas/sun-light";

const at = (s: string) => Date.parse(s);
const wrap = (d: number) => ((d + 540) % 360) - 180;

describe("subSolarPoint", () => {
  it("is on the far side (180 E) at New Moon and on the near side (0) at Full Moon", () => {
    expect(Math.abs(wrap(subSolarPoint(at("2027-01-07T20:24:00Z")).lonEastDeg - 180))).toBeLessThan(6); // New Moon, 2027-01-07
    expect(Math.abs(wrap(subSolarPoint(at("2027-01-22T12:17:00Z")).lonEastDeg))).toBeLessThan(6); // Full Moon, 2027-01-22
  });

  it("moves west by about 12.2 degrees a day, so the morning terminator sweeps from east to west", () => {
    const a = subSolarPoint(at("2027-01-10T00:00:00Z")).lonEastDeg;
    const b = subSolarPoint(at("2027-01-11T00:00:00Z")).lonEastDeg;
    expect(wrap(b - a)).toBeCloseTo(-12.2, 0);
  });

  it("agrees with the service's Sun over the south pole on 2027-01-10 (azimuth near 153 from 0 E, just above the horizon)", () => {
    const s = subSolarPoint(at("2027-01-10T00:00:00Z"));
    expect(s.lonEastDeg).toBeGreaterThan(145);
    expect(s.lonEastDeg).toBeLessThan(165);
    expect(Math.abs(s.latDeg)).toBeLessThanOrEqual(1.54);
  });

  it("keeps the Sun within 1.54 degrees of the equator over a year", () => {
    for (let m = 0; m < 12; m++) expect(Math.abs(subSolarPoint(Date.UTC(2027, m, 15)).latDeg)).toBeLessThanOrEqual(1.5400001);
  });
});

describe("sunDirection", () => {
  it("is a unit vector, along +x at 0 N 0 E and +y at 0 N 90 E", () => {
    expect(sunDirection({ latDeg: 0, lonEastDeg: 0 })).toEqual([1, 0, 0]);
    expect(sunDirection({ latDeg: 0, lonEastDeg: 90 })[1]).toBeCloseTo(1, 10);
    const v = sunDirection({ latDeg: -1.2, lonEastDeg: 153 });
    expect(Math.hypot(...v)).toBeCloseTo(1, 10);
  });
});
