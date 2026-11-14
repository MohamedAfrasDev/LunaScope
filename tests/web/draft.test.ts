import { describe, expect, it } from "vitest";
import { nowStart, emptyCustom, fieldKeyFromService, referenceDraft, sampleCount, toRequest, validateDraft } from "@/lib/draft";
import { degrees, duration, pct, pctRange, siteLabel, utc } from "@/lib/format";

const ref = () => referenceDraft(["rule-89.5S-E0", "rule-89.5S-E120", "rule-89.5S-E240"]);

describe("analysis draft", () => {
  it("the reference mission is valid and becomes the documented request", () => {
    expect(validateDraft(ref())).toEqual({});
    const r = toRequest(ref());
    expect(r.mission).toEqual({ start_utc: "2027-01-10T00:00:00Z", duration_s: 604800, step_s: 600 });
    expect(r.requirements).toEqual({ sun_min_availability: 0.6, earth_min_availability: 0.5 });
    expect(r.terrain).toMatchObject({ radius_km: 150, az_step_deg: 0.1, observer_height_m: 2 });
    expect(r.sites).toEqual([
      { site_id: "rule-89.5S-E0" },
      { site_id: "rule-89.5S-E120" },
      { site_id: "rule-89.5S-E240" },
    ]);
    expect(sampleCount(ref())).toBe(3 * 2 * 1009);
  });

  it("blocks invalid values with a message on the field, not a generic error", () => {
    const d = {
      ...ref(),
      startDate: "2027-13-40",
      startTime: "25:00",
      durationDays: "45",
      stepMin: "7",
      sunMinPct: "120",
      earthMinPct: "-1",
      radiusKm: "0",
      azStepDeg: "0.3",
      mastM: "80",
      siteIds: [],
    };
    const e = validateDraft(d);
    for (const k of [
      "mission.start_date",
      "mission.start_time",
      "mission.duration",
      "mission.step",
      "requirements.sun",
      "requirements.earth",
      "terrain.radius",
      "terrain.az_step",
      "terrain.mast",
      "sites",
    ])
      expect(e[k], k).toBeTruthy();
  });

  it("requires the duration to be a whole number of steps", () => {
    expect(validateDraft({ ...ref(), durationDays: "0.0833", stepMin: "10" })["mission.duration"]).toBeTruthy();
    expect(validateDraft({ ...ref(), durationDays: "0.5", stepMin: "10" })).toEqual({});
  });

  it("enforces the sample budget before anything is sent", () => {
    const six = ["a", "b", "c", "d", "e", "f"];
    const big = { ...ref(), siteIds: six, durationDays: "30", stepMin: "5" };
    expect(validateDraft(big).sites).toMatch(/exceeds/);
  });

  it("validates custom points: tile bounds, source note without links", () => {
    const d = { ...ref(), custom: [{ ...emptyCustom(), lat: "-70", lon: "10", source: "http://x" }] };
    const e = validateDraft(d);
    expect(e["custom.0.lat"]).toBeTruthy();
    expect(e["custom.0.source"]).toBeTruthy();
    const ok = { ...ref(), custom: [{ ...emptyCustom(), lat: "-88.5", lon: "30", source: "typed by user" }] };
    expect(validateDraft(ok)).toEqual({});
    expect(toRequest(ok).sites.at(-1)).toEqual({
      custom: expect.objectContaining({ lat_deg: -88.5, lon_deg: 30, source: "typed by user" }),
    });
  });

  it("maps service field paths onto form fields", () => {
    expect(fieldKeyFromService("terrain.az_step_deg")).toBe("terrain.az_step");
    expect(fieldKeyFromService("mission.start_utc")).toBe("mission.start_date");
    expect(fieldKeyFromService("sites.0.site_id")).toBe("sites");
    expect(fieldKeyFromService(null)).toBeNull();
    expect(fieldKeyFromService("something.else")).toBeNull();
  });
});

describe("formatting", () => {
  it("shows a bound as a range so unresolved time is never hidden", () => {
    expect(pctRange(0.745, 0.7469)).toBe("74.5–74.7%");
    expect(pctRange(0.5, 0.5)).toBe("50.0%");
    expect(pctRange(0, 0)).toBe("0.0%");
    expect(pct(1)).toBe("100.0%");
  });
  it("formats durations", () => {
    expect(duration(0)).toBe("0 s");
    expect(duration(59)).toBe("59 s");
    expect(duration(330)).toBe("5 min 30 s");
    expect(duration(600)).toBe("10 min");
    expect(duration(3600 * 49 + 60 * 5)).toBe("2 d 1 h 5 min");
    expect(duration(7 * 86400)).toBe("7 d");
  });
  it("uses a true minus sign and keeps UTC explicit", () => {
    expect(degrees(-2.508)).toBe("−2.51°");
    expect(degrees(0.4)).toBe("+0.40°");
    expect(utc("2027-01-10T00:00:00.000Z")).toBe("2027-01-10 00:00:00 UTC");
  });
  it("labels catalog sites readably and leaves other ids alone", () => {
    expect(siteLabel("rule-89.5S-E120")).toBe("89.5°S, 120°E");
    expect(siteLabel("custom-88p00000S_330p00000E")).toBe("custom-88p00000S_330p00000E");
  });
});

describe("start from now", () => {
  it("uses the current UTC hour, rounded down, and is a valid window start", () => {
    expect(nowStart(new Date("2026-11-14T13:47:59Z"))).toEqual({ startDate: "2026-11-14", startTime: "13:00" });
    expect(nowStart(new Date("2026-12-31T23:59:59Z"))).toEqual({ startDate: "2026-12-31", startTime: "23:00" });
    expect(validateDraft({ ...ref(), ...nowStart(new Date("2026-11-14T00:00:00Z")) })).toEqual({});
  });
  it("gives one request to everyone pressing it in the same hour", () => {
    const a = toRequest({ ...ref(), ...nowStart(new Date("2026-11-14T13:01:00Z")) });
    const b = toRequest({ ...ref(), ...nowStart(new Date("2026-11-14T13:59:00Z")) });
    expect(a).toEqual(b);
  });
});
