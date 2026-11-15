/**
 * Words for the Atlas Site sky scale (redesign phase F): compass names, heading wording and the mission-window text. Pure
 * functions. The geometry itself comes from lib/sky3d.ts and the service's series; nothing here decides visibility.
 */
import { duration } from "@/lib/format";

const EIGHT = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const EIGHT_WORDS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"] as const;

export const wrap360 = (a: number): number => ((a % 360) + 360) % 360;

/** "SE" for 151 degrees: the nearest of the eight compass points. */
export function cardinal(yawDeg: number): string {
  return EIGHT[Math.round(wrap360(yawDeg) / 45) % 8];
}

/** "south-east" for 151 degrees: the nearest of eight directions, in words. */
export function facingWords(yawDeg: number): string {
  return EIGHT_WORDS[Math.round(wrap360(yawDeg) / 45) % 8];
}

/** "151° SE" */
export function headingLabel(yawDeg: number): string {
  return `${Math.round(wrap360(yawDeg)) % 360}° ${cardinal(yawDeg)}`;
}

/** The exaggeration the scene is drawn with, in the words the scale readout uses. */
export function skyScaleLabel(k: number): string {
  return k === 1 ? "SITE SKY (1× TRUE)" : `SITE SKY (${k}× HEIGHTS)`;
}

const DAY = 86400;

/** "Day 7 of 30" for the clock time, counting whole days from the start of the window. */
export function missionDay(t: number, totalS: number): { day: number; days: number } {
  const days = Math.max(1, Math.ceil(totalS / DAY));
  return { day: Math.min(days, Math.floor(Math.max(0, t) / DAY) + 1), days };
}

/** "23 d 4 h left" */
export function timeLeft(t: number, totalS: number): string {
  const rest = Math.max(0, totalS - t);
  return rest <= 0 ? "ended" : `${duration(rest)} left`;
}
