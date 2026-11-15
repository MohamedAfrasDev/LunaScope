/**
 * Which run the Atlas shows (redesign phase G): a saved reference mission (GR-001 and its siblings, submitted exactly as the
 * service holds them) or any run by its 64-character id. Pure helpers for reading it from the address and writing it back.
 */
export type RunTarget = { kind: "reference"; id: string } | { kind: "run"; id: string };

export const DEFAULT_REFERENCE = "GR-001";
export const DEFAULT_TARGET: RunTarget = { kind: "reference", id: DEFAULT_REFERENCE };

const RUN_ID = /^[0-9a-f]{64}$/;
const REF_ID = /^GR-\d{3}$/;

export const isRunId = (s: string): boolean => RUN_ID.test(s);
export const isReferenceId = (s: string): boolean => REF_ID.test(s);

/** `?run=<64 hex>` opens that run, `?ref=GR-002` that reference; anything else is the default reference mission. */
export function targetFromSearch(search: string): RunTarget {
  const q = new URLSearchParams(search);
  const run = q.get("run");
  if (run && RUN_ID.test(run)) return { kind: "run", id: run };
  const ref = q.get("ref");
  if (ref && REF_ID.test(ref)) return { kind: "reference", id: ref };
  return DEFAULT_TARGET;
}

export const targetKey = (t: RunTarget): string => `${t.kind}:${t.id}`;

export const sameTarget = (a: RunTarget, b: RunTarget): boolean => targetKey(a) === targetKey(b);

/** The query string (without "?") for a target, keeping unrelated parameters and dropping the old run choice. */
export function searchFor(t: RunTarget, current: string): string {
  const q = new URLSearchParams(current);
  q.delete("run");
  q.delete("ref");
  if (t.kind === "run") q.set("run", t.id);
  else if (t.id !== DEFAULT_REFERENCE) q.set("ref", t.id);
  return q.toString();
}
