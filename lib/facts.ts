import type { CompareFact } from "./api/types";
import { duration, pct, siteLabel, targetLabel, utc } from "./format";
import { OUTCOME } from "./status";

/**
 * Fixed templates for the service's typed comparison facts (spec 7.6, FR-14). The service decides
 * which facts hold; this only phrases them. There is no free-form wording and no ranking.
 */
export function factText(f: CompareFact): string {
  const T = (t: string) => targetLabel(t);
  switch (f.fact) {
    case "terrain_changes_outcome":
      return (
        `At ${siteLabel(f.site_id)}, terrain changes the ${T(f.target)} result: ` +
        `${OUTCOME[f.flat_outcome].label} on a flat horizon (${pct(f.flat_availability_lower)}) but ` +
        `${OUTCOME[f.terrain_outcome].label} with the terrain skyline (${pct(f.terrain_availability_lower)}).`
      );
    case "outcomes_differ":
      return (
        `For ${T(f.target)}, the sites reach different outcomes: ` +
        Object.entries(f.outcomes).map(([s, o]) => `${siteLabel(s)} ${OUTCOME[o].label}`).join("; ") +
        ". LunaScope does not rank them; the trade-off is yours to weigh."
      );
    case "outcomes_same": {
      const o = Object.values(f.outcomes)[0];
      return `For ${T(f.target)}, every compared site has the same outcome (${OUTCOME[o].label}); the sites differ in the numbers below.`;
    }
    case "equal_availability_different_outage":
      return (
        `For ${T(f.target)}, ${siteLabel(f.sites[0])} and ${siteLabel(f.sites[1])} have about the same availability ` +
        `(${pct(f.availability_lower[0])} and ${pct(f.availability_lower[1])}), but their longest hidden period differs: ` +
        `${duration(f.longest_known_hidden_s[0])} versus ${duration(f.longest_known_hidden_s[1])}.`
      );
    case "unresolved_time_matters":
      return (
        `For ${T(f.target)}, ${f.sites.map(siteLabel).join(" and ")} ${f.sites.length > 1 ? "have" : "has"} a wide gap between the ` +
        `lower and upper availability bounds, so a pass or fail near the threshold is not certain.`
      );
  }
}

/** Friendly names for the held-constant fields the service lists. */
const FIELD: Record<string, string> = {
  "mission.start_utc": "Start",
  "mission.duration_s": "Duration",
  "mission.step_s": "Base step",
  "requirements.sun_min_availability": "Sunlight requirement",
  "requirements.earth_min_availability": "Earth requirement",
  "terrain.dem_profile": "Elevation data",
  "terrain.radius_km": "Horizon radius",
  "terrain.az_step_deg": "Azimuth step",
  "terrain.observer_height_m": "Observer height",
  "terrain.clearance_margin_deg": "Clearance margin",
  algorithm_id: "Algorithm",
  geometry_provider: "Geometry provider",
  interpolation: "Interpolation",
  horizon_algorithm: "Horizon algorithm",
  stack_kind: "Data stack",
  "resource.dem": "DEM pin (SHA-256)",
  "resource.spice_kernels": "SPICE kernels pin (SHA-256)",
};

export function fieldLabel(key: string): string {
  return FIELD[key] ?? key;
}

export function fieldValue(key: string, v: string | number): string {
  if (key === "mission.duration_s" || key === "mission.step_s") return duration(Number(v));
  if (key.startsWith("requirements.")) return `at least ${Math.round(Number(v) * 100)}%`;
  if (key.endsWith("_km")) return `${v} km`;
  if (key.endsWith("_deg")) return `${v}°`;
  if (key.endsWith("_m")) return `${v} m`;
  if (key.startsWith("resource.")) return `${String(v).slice(0, 16)}…`;
  if (key.endsWith("_utc")) return utc(String(v));
  return String(v);
}
