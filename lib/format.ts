/** Display formatting only. Values arrive already decided by the service. */

export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/** "74.5%" for a point, "74.5–74.7%" for a bound, so unresolved time is never hidden. */
export function pctRange(lo: number, hi: number, digits = 1): string {
  const a = (lo * 100).toFixed(digits);
  const b = (hi * 100).toFixed(digits);
  return a === b ? `${a}%` : `${a}–${b}%`;
}

export function duration(seconds: number): string {
  const s = Math.round(seconds);
  if (s <= 0) return "0 s";
  if (s < 3600) {
    // short spans keep their seconds: a 59 s bracket must not read as "0 min"
    const m = Math.floor(s / 60);
    const r = s % 60;
    return [m ? `${m} min` : "", r || !m ? `${r} s` : ""].filter(Boolean).join(" ");
  }
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d} d`);
  if (h) parts.push(`${h} h`);
  if (m || parts.length === 0) parts.push(`${m} min`);
  return parts.join(" ");
}

export function degrees(x: number, digits = 2): string {
  return `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(digits)}°`;
}

export function utc(iso: string): string {
  return iso.replace("T", " ").replace(/\.\d+Z$/, "Z").replace(/Z$/, " UTC");
}

export function shortId(id: string): string {
  return id.slice(0, 12);
}

export function siteLabel(id: string): string {
  const m = id.match(/^rule-(\d+(?:\.\d+)?)S-E(\d+)$/);
  return m ? `${m[1]}°S, ${m[2]}°E` : id;
}

export function targetLabel(t: string): string {
  return t === "sun_center" ? "Sun" : t === "earth_center" ? "Earth" : t;
}
