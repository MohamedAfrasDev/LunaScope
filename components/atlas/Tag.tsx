import { cn } from "@/lib/utils";

/** The trust layer (spec 5.3): what kind of value a block of numbers is. The word is always shown; the border style repeats it. */
export const TAGS = {
  "nasa-data": { label: "NASA DATA", help: "A value taken from a NASA source as published." },
  derived: { label: "DERIVED", help: "Computed by the science service from NASA data." },
  assumption: { label: "ASSUMPTION", help: "A value chosen for this analysis, not a mission rule." },
  illustration: { label: "ILLUSTRATION", help: "Decorative picture. Not data and not an analysis result." },
  synthetic: { label: "SYNTHETIC", help: "Invented test data. Not lunar results." },
  replay: { label: "REPLAY", help: "A saved copy: it shows saved runs only and cannot compute new ones." },
} as const;

export type TagKind = keyof typeof TAGS;

export function Tag({ kind, className }: { kind: TagKind; className?: string }) {
  const t = TAGS[kind];
  return (
    <span className={cn("atlas-tag atlas-label", className)} data-kind={kind} title={t.help}>
      {t.label}
    </span>
  );
}
