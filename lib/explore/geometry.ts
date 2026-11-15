/**
 * Pure helpers for the Moon explorer (galaxy-explorer phase E1). No Cesium here, so they are cheap to test and
 * never add to the bundle of the other pages.
 */

/** Mean lunar radius used by the science service (km) and by the globe (m). */
export const MOON_RADIUS_KM = 1737.4;
export const MOON_RADIUS_M = MOON_RADIUS_KM * 1000;

export const TILE_URL =
  "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg";
export const TILE_MAX_LEVEL = 8;
export const FALLBACK_TEXTURE = "/explore/moon-2k.jpg";

export const CREDIT_TEXT =
  "Imagery: NASA/GSFC/Arizona State University, LRO WAC mosaic, via NASA Moon Trek. Illustration of the surface, not an analysis result. Not endorsed by NASA.";

export type ViewName = "moon" | "south-pole";

export type View = { lon: number; lat: number; heightM: number; label: string };

export const VIEWS: Record<ViewName, View> = {
  moon: { lon: 0, lat: 0, heightM: 4_800_000, label: "Whole Moon" },
  "south-pole": { lon: 0, lat: -90, heightM: 4_800_000, label: "South pole" },
};

/** Closest and farthest the camera may be from the surface, in metres. */
export const MIN_HEIGHT_M = 2_000;
export const MAX_HEIGHT_M = 20_000_000;

const NICE = [1, 2, 5];

/**
 * The length of a scale bar: the largest "nice" distance (1, 2 or 5 times a power of ten) that fits in `maxPx`
 * pixels, given how many metres one pixel covers. Returns null when the input is not usable.
 */
export function niceScale(metresPerPixel: number, maxPx = 110): { metres: number; px: number; label: string } | null {
  if (!Number.isFinite(metresPerPixel) || metresPerPixel <= 0) return null;
  const maxMetres = metresPerPixel * maxPx;
  const exp = Math.floor(Math.log10(maxMetres));
  let best = 0;
  for (const e of [exp - 1, exp]) for (const n of NICE) if (n * 10 ** e <= maxMetres && n * 10 ** e > best) best = n * 10 ** e;
  if (best <= 0) return null;
  return { metres: best, px: best / metresPerPixel, label: best >= 1000 ? `${best / 1000} km` : `${best} m` };
}

/** "12.3° S", "45.6° E". Longitude is shown east-positive in -180..180, like the rest of the product. */
export function formatLatLon(latDeg: number, lonDeg: number): string {
  const lon = ((((lonDeg + 180) % 360) + 360) % 360) - 180;
  const rounded = Math.round(latDeg * 10) / 10; // so a hair below zero reads "0.0° N", not "0.0° S"
  const lat = `${Math.abs(rounded).toFixed(1)}° ${rounded < 0 ? "S" : "N"}`;
  const lo = `${Math.abs(lon).toFixed(1)}° ${lon < 0 ? "W" : "E"}`;
  return `${lat} · ${lo}`;
}

/** "4,800 km" above the surface; metres below 10 km. */
export function formatHeight(heightM: number): string {
  if (!Number.isFinite(heightM)) return "";
  if (heightM >= 10_000) return `${Math.round(heightM / 1000).toLocaleString("en-US")} km`;
  return `${Math.round(heightM).toLocaleString("en-US")} m`;
}

/** Heading in radians (0 = north up) to whole degrees 0..359. */
export function headingDegrees(headingRad: number): number {
  const d = Math.round((headingRad * 180) / Math.PI) % 360;
  return (d + 360) % 360;
}

/** How far one key press turns or zooms, scaled to the current height so it feels the same near and far. */
export function keyStep(heightM: number): { rotateRad: number; zoomM: number } {
  const t = Math.min(1, Math.max(0.02, heightM / MOON_RADIUS_M));
  return { rotateRad: 0.04 * Math.min(t, 1.5), zoomM: heightM * 0.25 };
}
