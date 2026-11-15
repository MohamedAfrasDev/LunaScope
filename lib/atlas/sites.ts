/**
 * Pure helpers for the Atlas site layer (redesign phase C): the site model, grouping and search, coordinate wording,
 * coverage wording and label decluttering. No Cesium and no React here, so every rule is cheap to test.
 */
import type { CatalogSite, CustomSiteCheck, SitesResponse } from "@/lib/api/types";

export type SiteKind = "demonstration" | "named" | "custom";

export type Coverage = { fullyCovered: boolean; coveredFraction: number; radiusKm: number; sectorsWithGap: number };

export type AtlasSite = {
  id: string;
  /** What the pin and the list call it. */
  label: string;
  latDeg: number;
  /** East longitude, 0 to 360, as the catalog states it. */
  lonEastDeg: number;
  kind: SiteKind;
  group: string;
  featureType: string | null;
  diameterKm: number | null;
  source: string;
  iauUrl: string | null;
  precisionM: number;
  /** null means the coverage has not been established, which is shown as "unknown", never as covered. */
  coverage: Coverage | null;
};

/** The terrain model covers 80°S to the pole, so nothing else can be analysed. */
export const TERRAIN_MIN_LAT_DEG = -90;
export const TERRAIN_MAX_LAT_DEG = -80;
export const MAX_CUSTOM_POINTS = 6;

export function normalizeEastLon(lonDeg: number): number {
  return ((lonDeg % 360) + 360) % 360;
}

export function inTerrainData(latDeg: number): boolean {
  return Number.isFinite(latDeg) && latDeg >= TERRAIN_MIN_LAT_DEG && latDeg <= TERRAIN_MAX_LAT_DEG;
}

function coverageOf(c: { covered_fraction: number; fully_covered: boolean; radius_km: number; sectors_with_gap: number }): Coverage {
  return { fullyCovered: c.fully_covered, coveredFraction: c.covered_fraction, radiusKm: c.radius_km, sectorsWithGap: c.sectors_with_gap };
}

export function fromCatalog(s: CatalogSite): AtlasSite {
  return {
    id: s.site_id,
    label: s.name ?? s.label,
    latDeg: s.lat_deg,
    lonEastDeg: normalizeEastLon(s.lon_east_deg),
    kind: s.kind === "demonstration_rule" || !s.group ? "demonstration" : "named",
    group: s.group ?? "demonstration",
    featureType: s.feature_type ?? null,
    diameterKm: s.diameter_km ?? null,
    source: s.source,
    iauUrl: s.iau_url ?? null,
    precisionM: s.precision_m,
    coverage: coverageOf(s.dem_coverage_150km),
  };
}

export function fromCustomCheck(n: number, check: CustomSiteCheck): AtlasSite {
  return {
    id: `custom-${n}`,
    label: `Custom point ${n}`,
    latDeg: check.lat_deg,
    lonEastDeg: normalizeEastLon(check.lon_east_deg),
    kind: "custom",
    group: "custom",
    featureType: null,
    diameterKm: null,
    source: check.source,
    iauUrl: null,
    precisionM: check.precision_m,
    coverage: coverageOf(check.dem_coverage_150km),
  };
}

/** "87.450° S" and "354.800° E": latitude with its hemisphere, east longitude from 0 to 360, as the catalog states them. */
export function formatLat(latDeg: number): string {
  return `${Math.abs(latDeg).toFixed(3)}° ${latDeg < 0 ? "S" : "N"}`;
}
export function formatEastLon(lonEastDeg: number): string {
  return `${normalizeEastLon(lonEastDeg).toFixed(3)}° E`;
}

/** What the terrain data says about a site, in words. Unknown stays unknown. */
export function coverageWords(c: Coverage | null): { word: string; known: boolean; full: boolean } {
  if (!c) return { word: "Unknown coverage: the terrain data has not been checked for this point", known: false, full: false };
  if (c.fullyCovered) return { word: `Terrain data covers the whole ${c.radiusKm} km footprint`, known: true, full: true };
  const pct = Math.round(c.coveredFraction * 100);
  const gaps = c.sectorsWithGap;
  return {
    word: `Partly outside the terrain data: ${pct}% of the ${c.radiusKm} km footprint is covered, ${gaps} direction sector${gaps === 1 ? "" : "s"} unknown`,
    known: true,
    full: false,
  };
}

export function kindWords(k: SiteKind): string {
  if (k === "demonstration") return "Demonstration point (rule-chosen, not a candidate site)";
  if (k === "named") return "Named feature (IAU centre point, not a landing recommendation)";
  return "Custom point";
}

/** The catalog grouped for display: demonstration points first, then each named group in catalog order. Custom points last. */
export function groupSites(sites: AtlasSite[], groups: SitesResponse["groups"] | undefined): { id: string; title: string; sites: AtlasSite[] }[] {
  const titles: Record<string, string> = {
    demonstration: "Demonstration points",
    custom: "Your points",
    ...(groups as Record<string, string> | undefined),
  };
  const order = ["demonstration"];
  const by: Record<string, AtlasSite[]> = {};
  for (const s of sites) {
    (by[s.group] ??= []).push(s);
    if (s.group !== "custom" && !order.includes(s.group)) order.push(s.group);
  }
  if (by.custom) order.push("custom");
  return order.filter((g) => by[g]).map((g) => ({ id: g, title: titles[g] ?? g, sites: by[g] }));
}

/** Search by name, feature type or the words of its group. Empty search keeps everything. */
export function filterSites(sites: AtlasSite[], query: string): AtlasSite[] {
  const q = query.trim().toLowerCase();
  if (!q) return sites;
  return sites.filter((s) => [s.label, s.featureType ?? "", s.group, kindWords(s.kind)].join(" ").toLowerCase().includes(q));
}

export type LabelBox = { id: string; x: number; y: number; w: number; h: number; priority: number };

/**
 * Which labels may be drawn without sitting on another one. Higher priority is placed first, so the selected site always
 * keeps its label; a label that would overlap one already placed is dropped (its pin stays). Ties keep input order.
 */
export function declutter(boxes: LabelBox[], gap = 4): Set<string> {
  const order = boxes.map((b, i) => ({ b, i })).sort((a, b) => b.b.priority - a.b.priority || a.i - b.i);
  const placed: LabelBox[] = [];
  const shown = new Set<string>();
  for (const { b } of order) {
    const clash = placed.some((p) => b.x < p.x + p.w + gap && p.x < b.x + b.w + gap && b.y < p.y + p.h + gap && p.y < b.y + b.h + gap);
    if (!clash) {
      placed.push(b);
      shown.add(b.id);
    }
  }
  return shown;
}

/** A rough label size in CSS pixels for a monospace label of `chars` characters, so the declutter needs no DOM measuring. */
export function labelSize(chars: number): { w: number; h: number } {
  return { w: Math.ceil(chars * 7.4 + 14), h: 22 };
}
