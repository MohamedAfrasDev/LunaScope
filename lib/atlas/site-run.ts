/**
 * Sun and Earth paths for a site the loaded run does not hold (redesign: compute for any site). The science service computes them:
 * the Atlas submits a one-site run with the same window, requirements and terrain settings as the loaded run, and merges the answer
 * into what it shows. Pure helpers here; the browser decides nothing about visibility.
 */
import type { AnalysisRequestBody, ProvenanceResponse } from "@/lib/api/types";
import type { RunWindow } from "@/lib/atlas/clock";
import type { RunData } from "@/lib/atlas/run";
import type { AtlasSite } from "@/lib/atlas/sites";

export type BaseRequest = Pick<AnalysisRequestBody, "mission" | "requirements" | "terrain">;

/** The inputs of the loaded run, from its provenance, in the shape a new request takes. Null if the service did not give them. */
export function baseRequestFromProvenance(p: ProvenanceResponse): BaseRequest | null {
  const r = p.request;
  if (!r?.mission || !r.requirements || !r.terrain) return null;
  return {
    mission: { start_utc: r.mission.start_utc, duration_s: r.mission.duration_s, step_s: r.mission.step_s },
    requirements: { sun_min_availability: r.requirements.sun_min_availability, earth_min_availability: r.requirements.earth_min_availability },
    // only the fields a request takes: the run's own clearance margin is a setting of the service, not an input
    terrain: { dem_profile: r.terrain.dem_profile, radius_km: r.terrain.radius_km, az_step_deg: r.terrain.az_step_deg, observer_height_m: r.terrain.observer_height_m },
  };
}

/** How the request names a site: a catalog id, or a typed custom point (planetocentric, east longitude). */
export function siteRequestEntry(site: AtlasSite): AnalysisRequestBody["sites"][number] {
  if (site.kind !== "custom") return { site_id: site.id };
  return {
    custom: {
      lat_deg: Number(site.latDeg.toFixed(6)),
      lon_deg: Number(site.lonEastDeg.toFixed(6)),
      lon_direction: "east_positive",
      convention: "planetocentric",
      source: site.source.slice(0, 200),
      precision_m: site.precisionM,
    },
  };
}

/** A one-site request with the loaded run's window and settings, and no sensitivity check (it would only make it slower). */
export function buildSiteRequest(base: BaseRequest, site: AtlasSite): AnalysisRequestBody {
  return { schema_version: "1", mission: base.mission, requirements: base.requirements, terrain: base.terrain, sites: [siteRequestEntry(site)], options: { sensitivity: false } };
}

export const sameWindow = (a: RunWindow, b: RunWindow): boolean => a.startMs === b.startMs && a.totalS === b.totalS;

export type SiteExtra = { runId: string; /** The id the service gave the site in that run. */ serviceId: string; tracks: RunData["sites"][string] };

/**
 * The loaded run with the computed sites added. Each site remembers which run holds it (`siteRun`), because the skyline and the
 * comparison are asked of that run. The base run's own sites are never replaced.
 */
export function mergeRuns(base: RunData, extras: Record<string, SiteExtra>): RunData {
  const ids = Object.keys(extras).filter((id) => !(id in base.sites));
  if (!ids.length) return base;
  const sites = { ...base.sites };
  const siteRun = { ...(base.siteRun ?? {}) };
  const siteServiceId = { ...(base.siteServiceId ?? {}) };
  for (const id of ids) {
    sites[id] = extras[id].tracks;
    siteRun[id] = extras[id].runId;
    siteServiceId[id] = extras[id].serviceId;
  }
  return { ...base, sites, siteRun, siteServiceId };
}

/** The run that holds a site: its own computed run, or the loaded run. */
export const runIdFor = (run: RunData, siteId: string): string => run.siteRun?.[siteId] ?? run.runId;

/** The id to ask the run for this site's skyline: the Atlas's own id for a site of the loaded run, the service's for a computed one. */
export const serviceSiteId = (run: RunData, siteId: string): string => run.siteServiceId?.[siteId] ?? siteId;
