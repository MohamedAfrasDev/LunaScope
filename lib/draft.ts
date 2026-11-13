import type { AnalysisRequestBody } from "./api/types";

/**
 * The analysis draft: what the form edits. Validation mirrors the service bounds so the user gets
 * field-level messages before submitting (FR-01); the service remains the authority and its
 * errors are shown too. A submitted run stores an immutable snapshot server-side.
 */

export interface CustomDraft {
  lat: string;
  lon: string;
  direction: "east_positive" | "west_positive";
  source: string;
  precision: string;
}

export interface Draft {
  startDate: string; // YYYY-MM-DD, UTC
  startTime: string; // HH:MM, UTC
  durationDays: string;
  stepMin: string;
  sunMinPct: string;
  earthMinPct: string;
  demProfile: "lola-80s-20m-adj" | "lola-80s-20m-pds";
  radiusKm: string;
  azStepDeg: string;
  mastM: string;
  siteIds: string[];
  custom: CustomDraft[];
  sensitivity: boolean;
}

export const STEP_CHOICES = [5, 10, 15, 30, 60];
export const AZ_STEP_CHOICES = [0.05, 0.1, 0.2, 0.25, 0.5, 1];
export const MAX_SAMPLES = 60_000;
export const MAX_SITES = 6;

export const emptyCustom = (): CustomDraft => ({
  lat: "",
  lon: "",
  direction: "east_positive",
  source: "",
  precision: "100",
});

/** The reference mission: 7 days, 60% Sun, 50% Earth, terrain on, the three rule-chosen points. */
export function referenceDraft(siteIds: string[]): Draft {
  return {
    startDate: "2027-01-10",
    startTime: "00:00",
    durationDays: "7",
    stepMin: "10",
    sunMinPct: "60",
    earthMinPct: "50",
    demProfile: "lola-80s-20m-adj",
    radiusKm: "150",
    azStepDeg: "0.1",
    mastM: "2",
    siteIds,
    custom: [],
    sensitivity: false,
  };
}

const num = (s: string): number => (s.trim() === "" ? Number.NaN : Number(s));

export function sampleCount(d: Draft): number {
  const days = num(d.durationDays);
  const step = num(d.stepMin);
  const sites = d.siteIds.length + d.custom.length;
  if (!Number.isFinite(days) || !Number.isFinite(step) || step <= 0) return 0;
  return sites * 2 * (Math.round((days * 1440) / step) + 1);
}

export type Errors = Record<string, string>;

export function validateDraft(d: Draft): Errors {
  const e: Errors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.startDate) || Number.isNaN(Date.parse(`${d.startDate}T00:00:00Z`)))
    e["mission.start_date"] = "Use a date as YYYY-MM-DD (UTC).";
  else {
    const y = Number(d.startDate.slice(0, 4));
    if (y < 2020 || y >= 2100) e["mission.start_date"] = "The start must be between 2020 and 2099.";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.startTime)) e["mission.start_time"] = "Use HH:MM (UTC).";

  const days = num(d.durationDays);
  if (!Number.isFinite(days) || days < 1 / 24 || days > 30) e["mission.duration"] = "Between 1 hour (0.042) and 30 days.";
  const step = num(d.stepMin);
  if (!STEP_CHOICES.includes(step)) e["mission.step"] = `Choose one of ${STEP_CHOICES.join(", ")} minutes.`;
  else if (Number.isFinite(days) && Math.abs((days * 1440) / step - Math.round((days * 1440) / step)) > 1e-9)
    e["mission.duration"] = "The duration must be a whole number of steps.";

  for (const [k, v, label] of [
    ["requirements.sun", d.sunMinPct, "Sunlight"],
    ["requirements.earth", d.earthMinPct, "Earth visibility"],
  ] as const) {
    const x = num(v);
    if (!Number.isFinite(x) || x < 0 || x > 100) e[k] = `${label} threshold must be 0 to 100%.`;
  }

  const r = num(d.radiusKm);
  if (!Number.isFinite(r) || r < 1 || r > 300) e["terrain.radius"] = "Horizon radius must be 1 to 300 km.";
  if (!AZ_STEP_CHOICES.includes(num(d.azStepDeg))) e["terrain.az_step"] = `Choose one of ${AZ_STEP_CHOICES.join(", ")}°.`;
  const m = num(d.mastM);
  if (!Number.isFinite(m) || m < 0 || m > 50) e["terrain.mast"] = "Observer height must be 0 to 50 m.";

  const nSites = d.siteIds.length + d.custom.length;
  if (nSites < 1) e.sites = "Choose at least one site.";
  if (nSites > MAX_SITES) e.sites = `At most ${MAX_SITES} sites.`;
  d.custom.forEach((c, i) => {
    const lat = num(c.lat);
    const lon = num(c.lon);
    if (!Number.isFinite(lat) || lat < -90 || lat > -80) e[`custom.${i}.lat`] = "Latitude must be −90 to −80 (the terrain data covers 80°S to the pole).";
    if (!Number.isFinite(lon) || lon < -360 || lon > 360) e[`custom.${i}.lon`] = "Longitude must be −360 to 360.";
    if (c.source.trim() === "" || c.source.length > 200 || c.source.includes("://"))
      e[`custom.${i}.source`] = "Give a short source note (not a link), up to 200 characters.";
    const p = num(c.precision);
    if (!Number.isFinite(p) || p < 0 || p > 10_000) e[`custom.${i}.precision`] = "Precision must be 0 to 10,000 m.";
  });

  if (Object.keys(e).length === 0 && sampleCount(d) > MAX_SAMPLES)
    e.sites = `${sampleCount(d).toLocaleString("en")} samples exceeds the ${MAX_SAMPLES.toLocaleString("en")} limit; shorten the window, use a larger step or fewer sites.`;
  return e;
}

/** Only call after validateDraft returns no errors. */
export function toRequest(d: Draft): AnalysisRequestBody {
  const dur = Math.round(num(d.durationDays) * 86400);
  return {
    schema_version: "1",
    mission: {
      start_utc: `${d.startDate}T${d.startTime}:00Z`,
      duration_s: dur,
      step_s: num(d.stepMin) * 60,
    },
    requirements: {
      sun_min_availability: num(d.sunMinPct) / 100,
      earth_min_availability: num(d.earthMinPct) / 100,
    },
    terrain: {
      dem_profile: d.demProfile,
      radius_km: num(d.radiusKm),
      az_step_deg: num(d.azStepDeg),
      observer_height_m: num(d.mastM),
    },
    sites: [
      ...d.siteIds.map((site_id) => ({ site_id })),
      ...d.custom.map((c) => ({
        custom: {
          lat_deg: num(c.lat),
          lon_deg: num(c.lon),
          lon_direction: c.direction,
          convention: "planetocentric",
          source: c.source.trim(),
          precision_m: num(c.precision),
        },
      })),
    ],
    options: { sensitivity: d.sensitivity },
  };
}

/** Map a service field path ("terrain.az_step_deg", "sites.0.custom.lat_deg") onto a form key. */
export function fieldKeyFromService(path: string | null): string | null {
  if (!path) return null;
  const map: Record<string, string> = {
    "mission.start_utc": "mission.start_date",
    "mission.duration_s": "mission.duration",
    "mission.step_s": "mission.step",
    "terrain.radius_km": "terrain.radius",
    "terrain.az_step_deg": "terrain.az_step",
    "terrain.observer_height_m": "terrain.mast",
    "requirements.sun_min_availability": "requirements.sun",
    "requirements.earth_min_availability": "requirements.earth",
  };
  if (map[path]) return map[path];
  if (path.startsWith("sites")) return "sites";
  return null;
}
