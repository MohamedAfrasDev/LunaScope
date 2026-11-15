/**
 * Which side of the Earth faces the Moon at a given UTC time (redesign: Site sky). Low-precision astronomy, enough to turn a picture
 * of the Earth so the right continents face the Moon and so they move as the clock runs. It is a DISPLAY estimate (about half a degree),
 * not a service result: the Earth in Site sky is a picture, and the scene says so.
 *
 * Sub-lunar point: the point on the Earth where the Moon is overhead. Seen from the Moon it is the middle of the Earth's disc.
 */

const RAD = Math.PI / 180;
const norm360 = (d: number): number => ((d % 360) + 360) % 360;

/** Julian date of a UTC time in milliseconds. */
export const julianDate = (utcMs: number): number => utcMs / 86400000 + 2440587.5;

/** Greenwich mean sidereal time in degrees. */
export function gmstDeg(utcMs: number): number {
  const d = julianDate(utcMs) - 2451545.0;
  const T = d / 36525;
  return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T);
}

/** The Moon's geocentric right ascension and declination, in degrees (the low-precision series of the Astronomical Almanac). */
export function moonRaDec(utcMs: number): { raDeg: number; decDeg: number } {
  const T = (julianDate(utcMs) - 2451545.0) / 36525;
  const s = (a: number, b: number) => Math.sin((a + b * T) * RAD);
  const lon =
    218.32 + 481267.881 * T + 6.29 * s(135.0, 477198.87) - 1.27 * s(259.3, -413335.36) + 0.66 * s(235.7, 890534.22) + 0.21 * s(269.9, 954397.74) - 0.19 * s(357.5, 35999.05) - 0.11 * s(186.5, 966404.03);
  const lat = 5.13 * s(93.3, 483202.02) + 0.28 * s(228.2, 960400.89) - 0.28 * s(318.3, 6003.15) - 0.17 * s(217.6, -407332.21);
  const l = Math.cos(lat * RAD) * Math.cos(lon * RAD);
  const m = 0.9175 * Math.cos(lat * RAD) * Math.sin(lon * RAD) - 0.3978 * Math.sin(lat * RAD);
  const n = 0.3978 * Math.cos(lat * RAD) * Math.sin(lon * RAD) + 0.9175 * Math.sin(lat * RAD);
  return { raDeg: norm360(Math.atan2(m, l) / RAD), decDeg: Math.asin(n) / RAD };
}

/** The sub-lunar point on the Earth: latitude, and east longitude from -180 to 180. */
export function subLunarPoint(utcMs: number): { latDeg: number; lonDeg: number } {
  const { raDeg, decDeg } = moonRaDec(utcMs);
  const lon = norm360(raDeg - gmstDeg(utcMs) + 180) - 180;
  return { latDeg: decDeg, lonDeg: lon };
}

/**
 * Where a point of an equirectangular Earth picture (longitude -180 to 180 across, latitude 90 to -90 down) sits on a three.js
 * SphereGeometry, in the sphere's own axes: x = cos(lat) cos(lon), y = sin(lat), z = -cos(lat) sin(lon).
 */
export function sphereDirection(latDeg: number, lonDeg: number): [number, number, number] {
  const la = latDeg * RAD;
  const lo = lonDeg * RAD;
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)];
}
