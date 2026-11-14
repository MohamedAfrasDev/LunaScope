import { duration, pct } from "./format";
import { OUTCOME } from "./status";
import type { Outcome, Target } from "./api/types";

/**
 * Guided mode (FR-14): plain-language wording for the service's explanation facts.
 *
 * Fixed templates only. Each one is keyed on the fact's stable `code` and filled from its `params`
 * (numbers the service already computed); nothing is parsed out of the service's own sentence, and
 * nothing is generated. A fact with a code this file does not know falls back to the service's
 * wording, so guided mode can never say something the service did not establish. Unknown time is
 * never described as "not visible", and no sentence asserts a cause beyond the arithmetic.
 */
export interface Fact {
  code: string;
  text: string;
  params: Record<string, unknown>;
}

const NOUN: Record<Target, { thing: string; none: string; subject: string }> = {
  sun_center: { thing: "sunlight", none: "no sunlight", subject: "The Sun" },
  earth_center: { thing: "a direct line of sight to Earth", none: "no direct line of sight to Earth", subject: "Earth" },
};

const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const word = (o: unknown): string => OUTCOME[o as Outcome]?.label.toLowerCase() ?? String(o);

/** "about 3 days" / "about 5 hours": coarse on purpose, the exact figure is in the technical view. */
function roughly(seconds: number): string {
  if (seconds >= 2 * 86400) return `about ${Math.round(seconds / 86400)} days`;
  if (seconds >= 3600) return `about ${Math.round(seconds / 3600)} hours`;
  return duration(seconds);
}

export function plainFact(f: Fact, target: Target): string {
  const { thing, none, subject } = NOUN[target];
  const p = f.params;
  switch (f.code) {
    case "HIDDEN_WHOLE_WINDOW":
      return `${subject} stays below the ridges and crater walls on the horizon for every moment computed, so there is ${none} here on these dates.`;
    case "CLOSEST_APPROACH_BELOW": {
      const d = num(p.max_clearance_deg);
      return d === null
        ? `${subject} never clears the terrain skyline.`
        : `At its highest sampled moment, ${subject === "The Sun" ? "the Sun" : "Earth"} is still ${Math.abs(d).toFixed(1)}° below the skyline.`;
    }
    case "VISIBLE_WHOLE_WINDOW":
      return `${subject} stays clearly above the terrain skyline for the whole window, so ${thing} is available throughout.`;
    case "AVAILABILITY_RANGE": {
      const lo = num(p.lower);
      const hi = num(p.upper);
      if (lo === null || hi === null) return f.text;
      return lo === hi
        ? `${thing[0].toUpperCase()}${thing.slice(1)} is available about ${pct(lo, 0)} of the time.`
        : `${thing[0].toUpperCase()}${thing.slice(1)} is available between ${pct(lo, 1)} and ${pct(hi, 1)} of the time. The gap is time the computation could not settle.`;
    }
    case "UNRESOLVED_TIME": {
      const s = num(p.unresolved_s);
      return s === null
        ? f.text
        : `For ${roughly(s)} the computation could not say for sure whether ${subject === "The Sun" ? "the Sun" : "Earth"} was above or below the skyline. That time is left as unknown, never counted as hidden, so the answer is a range rather than one number.`;
    }
    case "LONGEST_HIDDEN": {
      const s = num(p.seconds);
      return s === null ? f.text : `The longest stretch without ${thing} is ${roughly(s)}.`;
    }
    case "TERRAIN_CHANGES_OUTCOME":
      return `A flat-horizon estimate would call this a ${word(p.flat_outcome)}; once the real terrain is included it is a ${word(p.terrain_outcome)}. The terrain is what changes the answer.`;
    case "TERRAIN_REDUCES_AVAILABILITY": {
      const flat = num(p.flat);
      const terrain = num(p.terrain);
      return flat === null || terrain === null
        ? f.text
        : `On a flat horizon ${thing} would be available ${pct(flat, 0)} of the time; the terrain brings that down to ${pct(terrain, 0)}.`;
    }
    case "EXCLUDED":
      return `This case is left out rather than failed, because the data needed to decide it is missing or could not be certified.`;
    default:
      return f.text; // never invent wording for a fact this file does not know
  }
}

export const KNOWN_CODES = [
  "HIDDEN_WHOLE_WINDOW", "CLOSEST_APPROACH_BELOW", "VISIBLE_WHOLE_WINDOW", "AVAILABILITY_RANGE",
  "UNRESOLVED_TIME", "LONGEST_HIDDEN", "TERRAIN_CHANGES_OUTCOME", "TERRAIN_REDUCES_AVAILABILITY", "EXCLUDED",
] as const;
