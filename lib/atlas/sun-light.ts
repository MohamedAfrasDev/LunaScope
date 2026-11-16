/**
 * Where the Sun is over the Moon at a given UTC time, for lighting the Moon globe (redesign: Moon scale). Low-precision astronomy
 * (a degree or so), a DISPLAY estimate that decides which half of the picture is lit; it is not a service result and never says
 * whether anything is visible from a site (that is the service's skyline).
 *
 * Sub-solar longitude: the Moon turns once per sidereal month while the Sun's apparent longitude drifts, so the longitude under the
 * Sun is 180 degrees minus (the Moon's mean longitude minus the Sun's). New Moon: the far side is lit (180 E). Full Moon: 0.
 * Sub-solar latitude: the Sun's selenographic latitude, up to 1.54 degrees either side of the equator over an eclipse year.
 */

const RAD = Math.PI / 180;
const norm360 = (d: number): number => ((d % 360) + 360) % 360;

export type SubSolar = { latDeg: number; lonEastDeg: number };

export function subSolarPoint(utcMs: number): SubSolar {
  const d = utcMs / 86400000 + 2440587.5 - 2451545.0; // days since J2000
  const moonMean = norm360(218.316 + 13.176396 * d);
  const sunMeanAnomaly = norm360(357.528 + 0.9856003 * d);
  const sunLon = norm360(280.46 + 0.9856474 * d + 1.915 * Math.sin(sunMeanAnomaly * RAD) + 0.02 * Math.sin(2 * sunMeanAnomaly * RAD));
  const node = norm360(125.04 - 0.0529539 * d); // longitude of the Moon's ascending node
  const lon = norm360(180 - (moonMean - sunLon) + 180) - 180; // -180..180
  return { latDeg: 1.54 * Math.sin((sunLon - node) * RAD), lonEastDeg: lon };
}

/** Unit vector from the Moon's centre toward the Sun in the body-fixed frame (x through 0 N 0 E, z north). */
export function sunDirection({ latDeg, lonEastDeg }: SubSolar): [number, number, number] {
  const la = latDeg * RAD;
  const lo = lonEastDeg * RAD;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

/**
 * Where the Earth sits in the Moon's sky, as the point of the Moon it is overhead (the sub-Earth point), in the same body-fixed frame.
 * The Moon always shows one face to the Earth, so this stays near 0 N 0 E; it wobbles a few degrees each month (libration) because
 * the Moon's orbit is not a circle and is tilted. Low-precision (a degree or so), a DISPLAY estimate.
 */
export function subEarthPoint(utcMs: number): SubSolar {
  const T = (utcMs / 86400000 + 2440587.5 - 2451545.0) / 36525;
  const anomaly = (134.963 + 477198.867 * T) * RAD; // the Moon's mean anomaly
  const latArg = (93.272 + 483202.018 * T) * RAD; // the Moon's argument of latitude
  return { latDeg: -6.7 * Math.sin(latArg), lonEastDeg: 6.29 * Math.sin(anomaly) };
}
