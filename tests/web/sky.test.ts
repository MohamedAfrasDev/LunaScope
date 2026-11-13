import { describe, expect, it } from "vitest";
import type { IntervalRow } from "@/lib/api/types";
import {
  classAt,
  elevationBand,
  eventTimes,
  interpAzEl,
  nextEvent,
  polar,
  prevEvent,
  runsByClass,
  skylineAt,
  wrap360,
} from "@/lib/sky";

const series = (az: number[], el: number[], step_s = 600) => ({ step_s, az_deg: az, el_deg: el });
const iv = (cls: IntervalRow["class"], a: number, b: number): IntervalRow => ({
  start_s: a,
  end_s: b,
  start_utc: "",
  end_utc: "",
  class: cls,
});

describe("display interpolation", () => {
  it("interpolates linearly between nodes and clamps outside the window", () => {
    const s = series([10, 20, 40], [1, 2, 4]);
    expect(interpAzEl(s, 300)).toEqual({ az: 15, el: 1.5 });
    expect(interpAzEl(s, 900)).toEqual({ az: 30, el: 3 });
    expect(interpAzEl(s, -50)).toEqual({ az: 10, el: 1 });
    expect(interpAzEl(s, 99999)).toEqual({ az: 40, el: 4 });
  });

  it("takes the short way round north", () => {
    const s = series([358, 2], [0, 0]);
    expect(interpAzEl(s, 300).az).toBeCloseTo(0, 9);
    const r = interpAzEl(series([350, 10], [0, 0]), 150);
    expect(r.az).toBeCloseTo(355, 9);
    expect(wrap360(-10)).toBe(350);
    expect(wrap360(370)).toBe(10);
  });

  it("copes with a one-node series", () => {
    expect(interpAzEl(series([123], [4]), 500)).toEqual({ az: 123, el: 4 });
  });
});

describe("classified intervals", () => {
  const ivs = [iv("V", 0, 100), iv("U", 100, 120), iv("H", 120, 300)];
  it("picks the interval that starts at a shared boundary", () => {
    expect(classAt(ivs, 0)).toBe("V");
    expect(classAt(ivs, 99.9)).toBe("V");
    expect(classAt(ivs, 100)).toBe("U");
    expect(classAt(ivs, 120)).toBe("H");
    expect(classAt(ivs, 300)).toBe("H"); // mission end: the last interval
    expect(classAt(ivs, -1)).toBeNull();
  });

  it("splits a track into runs by class and shares the joint point", () => {
    const s = series([0, 1, 2, 3, 4], [0, 0, 0, 0, 0], 60);
    const runs = runsByClass(s, [iv("V", 0, 125), iv("H", 125, 300)]);
    expect(runs.map((r) => r.cls)).toEqual(["V", "H"]);
    expect(runs[0].idx).toEqual([0, 1, 2]);
    expect(runs[1].idx).toEqual([2, 3, 4]);
  });
});

describe("skyline lookup", () => {
  const prof = { azimuth_deg: [0, 90, 180, 270], horizon_el_deg: [0, 10, 0, null] as (number | null)[] };
  it("interpolates circularly and returns null instead of guessing across unknown bins", () => {
    expect(skylineAt(prof, 45)).toBeCloseTo(5, 9);
    expect(skylineAt(prof, 135)).toBeCloseTo(5, 9);
    expect(skylineAt(prof, 225)).toBeNull();
    expect(skylineAt(prof, 315)).toBeNull(); // 270 unknown
    expect(skylineAt(prof, -45)).toBeNull();
  });
});

describe("polar geometry", () => {
  const band = { min: -5, max: 15 };
  it("puts north up, east right, and low elevations near the centre", () => {
    const c = polar(0, -5, band, 100);
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(0);
    const n = polar(0, 15, band, 100);
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(-100); // up on the screen
    const e = polar(90, 15, band, 100);
    expect(e.x).toBeCloseTo(100);
    expect(e.y).toBeCloseTo(0);
    expect(polar(180, 15, band, 100).y).toBeCloseTo(100);
    expect(polar(270, 15, band, 100).x).toBeCloseTo(-100);
  });
  it("never lets a value below the band flip through the centre", () => {
    const p = polar(45, -50, band, 100);
    expect(Math.hypot(p.x, p.y)).toBe(0);
  });
  it("chooses a band that holds the skyline, the tracks and the flat horizon", () => {
    const b = elevationBand([0.5, 11, null, 31.2], [[0.4, 0.9], [-1.5, 6]]);
    expect(b.min).toBeLessThanOrEqual(-2);
    expect(b.max).toBeGreaterThanOrEqual(32);
    expect(Math.abs(b.min % 5)).toBe(0);
    expect(Math.abs(b.max % 5)).toBe(0);
  });
});

describe("event navigation", () => {
  const times = eventTimes([[{ t_s: 500 }, { t_s: 100 }], [{ t_s: 100 }, { t_s: 900 }]]);
  it("merges, de-duplicates and sorts event times", () => {
    expect(times).toEqual([100, 500, 900]);
  });
  it("finds the next and previous event strictly around the cursor", () => {
    expect(nextEvent(times, 0)).toBe(100);
    expect(nextEvent(times, 100)).toBe(500); // standing on an event moves on
    expect(nextEvent(times, 900)).toBeNull();
    expect(prevEvent(times, 900)).toBe(500);
    expect(prevEvent(times, 100)).toBeNull();
    expect(prevEvent(times, 101)).toBe(100);
  });
});
