import { describe, expect, it } from "vitest";
import { moonDistanceKm, nextPhaseTime, phaseAngle, phaseName } from "@/lib/atlas/system";

describe("Earth-Moon system estimates", () => {
  it("puts the 2027 New Moon and Full Moon where the almanac does (within a few hours)", () => {
    const newMoon = nextPhaseTime(Date.parse("2027-01-01T00:00:00Z"), 0)!;
    expect(Math.abs(newMoon - Date.parse("2027-01-07T20:24:00Z"))).toBeLessThan(6 * 3600000);
    const full = nextPhaseTime(Date.parse("2027-01-15T00:00:00Z"), 180)!;
    expect(Math.abs(full - Date.parse("2027-01-22T12:17:00Z"))).toBeLessThan(6 * 3600000);
  });

  it("names the phase and keeps the distance in the real range", () => {
    expect(phaseName(0)).toBe("New Moon");
    expect(phaseName(180)).toBe("Full Moon");
    expect(phaseName(45)).toBe("Waxing crescent");
    expect(phaseAngle(Date.parse("2027-01-22T12:17:00Z"))).toBeGreaterThan(170);
    const d = moonDistanceKm(Date.parse("2027-01-10T00:00:00Z"));
    expect(d).toBeGreaterThan(356000);
    expect(d).toBeLessThan(407000);
  });
});
