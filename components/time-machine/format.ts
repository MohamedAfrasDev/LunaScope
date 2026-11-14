import { utc } from "@/lib/format";

/** Display only: a UTC instant `seconds` after an ISO start. The service decided every interval. */
export function at(startIso: string, seconds: number): string {
  return utc(new Date(Date.parse(startIso) + seconds * 1000).toISOString());
}

export function signedDays(s: number): string {
  const d = s / 86400;
  return `${d > 0 ? "+" : "−"}${Math.abs(d) % 1 === 0 ? Math.abs(d) : Math.abs(d).toFixed(2)} d`;
}

/** Availability change in percentage points; a change below 0.05 points is "no change". */
export function pp(x: number): string {
  const v = x * 100;
  if (Math.abs(v) < 0.05) return "no change";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} percentage points`;
}
