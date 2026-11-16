/**
 * Where the Moon and the Sun are in the Earth-Moon system at a UTC time (the Atlas System scale). Low-precision series from the
 * Astronomical Almanac: good to about half a degree, enough to draw the orbit and the lighting. It is a DISPLAY estimate, not a service
 * result; the scene says so. Positions are in the equatorial frame (x to the March equinox, y to the celestial north pole, z completing
 * a right-handed set turned so the picture matches three.js), in units of 10,000 km.
 */
import { gmstDeg, julianDate } from "@/lib/atlas/earth-orient";

const RAD = Math.PI / 180;
/** One scene unit, in kilometres. */
export const UNIT_KM = 10000;
export const EARTH_RADIUS_KM = 6378.14;
export const MOON_RADIUS_KM = 1737.4;
/** Mean obliquity of the ecliptic, degrees. */
export const OBLIQUITY_DEG = 23.4393;
/** One orbit of the Moon relative to the stars, in days. */
export const SIDEREAL_MONTH_DAYS = 27.321661;

export type Vec3 = [number, number, number];

const centuries = (utcMs: number): number => (julianDate(utcMs) - 2451545.0) / 36525;

/** Ecliptic frame: x to the equinox, y to the ecliptic north pole, z = -(direction of longitude 90 degrees). */
function ecliptic(lonDeg: number, latDeg: number, r: number): Vec3 {
  const lo = lonDeg * RAD;
  const la = latDeg * RAD;
  return [r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)];
}

/** The Moon, from the centre of the Earth, in the ecliptic frame, in scene units. */
export function moonPosition(utcMs: number): Vec3 {
  const T = centuries(utcMs);
  const s = (a: number, b: number) => Math.sin((a + b * T) * RAD);
  const c = (a: number, b: number) => Math.cos((a + b * T) * RAD);
  const lon = 218.32 + 481267.881 * T + 6.29 * s(135.0, 477198.87) - 1.27 * s(259.3, -413335.36) + 0.66 * s(235.7, 890534.22) + 0.21 * s(269.9, 954397.74) - 0.19 * s(357.5, 35999.05) - 0.11 * s(186.5, 966404.03);
  const lat = 5.13 * s(93.3, 483202.02) + 0.28 * s(228.2, 960400.89) - 0.28 * s(318.3, 6003.15) - 0.17 * s(217.6, -407332.21);
  const parallax = 0.9508 + 0.0518 * c(135.0, 477198.87) + 0.0095 * c(259.3, -413335.36) + 0.0078 * c(235.7, 890534.22) + 0.0028 * c(269.9, 954397.74);
  const km = EARTH_RADIUS_KM / Math.sin(parallax * RAD);
  return ecliptic(lon, lat, km / UNIT_KM);
}

/** The unit direction from the Earth to the Sun, in the ecliptic frame. */
export function sunDirection(utcMs: number): Vec3 {
  const T = centuries(utcMs);
  const L = 280.459 + 36000.771 * T;
  const g = (357.529 + 35999.05 * T) * RAD;
  const lon = L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
  return ecliptic(lon, 0, 1);
}

/** The Moon's orbit as a closed loop of points: one sidereal month starting at utcMs. */
export function orbitLoop(utcMs: number, steps = 180): Vec3[] {
  const span = SIDEREAL_MONTH_DAYS * 86400000;
  return Array.from({ length: steps + 1 }, (_, i) => moonPosition(utcMs + (span * i) / steps));
}

/** The Moon's path across [startMs, endMs] (the loaded run window). */
export function orbitSpan(startMs: number, endMs: number, steps = 90): Vec3[] {
  return Array.from({ length: steps + 1 }, (_, i) => moonPosition(startMs + ((endMs - startMs) * i) / steps));
}

/** How much of the Moon's face is lit, 0 (new) to 1 (full), from the Sun-Earth-Moon angle. */
export function moonIllumination(utcMs: number): number {
  const m = moonPosition(utcMs);
  const sun = sunDirection(utcMs);
  const len = Math.hypot(m[0], m[1], m[2]);
  const cos = (m[0] * sun[0] + m[1] * sun[1] + m[2] * sun[2]) / len; // Moon-Earth-Sun elongation
  return (1 - cos) / 2;
}

/** The turn of the Earth about its own axis: degrees east of the equinox direction facing the sphere's +x. */
export function earthTurnDeg(utcMs: number): number {
  return gmstDeg(utcMs);
}

/** The Moon's distance from the Earth's centre, km. */
export function moonDistanceKm(utcMs: number): number {
  const m = moonPosition(utcMs);
  return Math.hypot(m[0], m[1], m[2]) * UNIT_KM;
}

const norm360 = (d: number): number => ((d % 360) + 360) % 360;
const eclLon = (v: Vec3): number => norm360(Math.atan2(-v[2], v[0]) / RAD);

/** Moon phase angle: degrees the Moon is ahead of the Sun along the ecliptic. 0 new, 90 first quarter, 180 full, 270 last quarter. */
export function phaseAngle(utcMs: number): number {
  return norm360(eclLon(moonPosition(utcMs)) - eclLon(sunDirection(utcMs)));
}

export const PHASES = [
  { name: "New Moon", angle: 0 },
  { name: "First quarter", angle: 90 },
  { name: "Full Moon", angle: 180 },
  { name: "Last quarter", angle: 270 },
] as const;

/** Plain-words phase from the phase angle. */
export function phaseName(angle: number): string {
  const a = norm360(angle);
  if (a < 6 || a >= 354) return "New Moon";
  if (a < 84) return "Waxing crescent";
  if (a < 96) return "First quarter";
  if (a < 174) return "Waxing gibbous";
  if (a < 186) return "Full Moon";
  if (a < 264) return "Waning gibbous";
  if (a < 276) return "Last quarter";
  return "Waning crescent";
}

/** Days since the last New Moon (mean month scaled by the phase angle). */
export const moonAgeDays = (angle: number): number => (norm360(angle) / 360) * 29.530589;

/** The next time (UTC ms) after utcMs that the phase angle reaches `target`, found by stepping and bisecting. Null if none within 32 days. */
export function nextPhaseTime(utcMs: number, target: number): number | null {
  const step = 6 * 3600000;
  const diff = (t: number) => ((phaseAngle(t) - target + 540) % 360) - 180; // 0 at the target, rising through it
  let a = utcMs;
  let da = diff(a);
  for (let i = 0; i < 32 * 4; i++) {
    const b = a + step;
    const db = diff(b);
    if (da < 0 && db >= 0) {
      let lo = a;
      let hi = b;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        if (diff(mid) < 0) lo = mid;
        else hi = mid;
      }
      return hi;
    }
    a = b;
    da = db;
  }
  return null;
}
