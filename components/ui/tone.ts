/** One place for the status tone classes, so alerts, badges and chips can never drift apart. */
export type Tone = "ok" | "fail" | "warn" | "info" | "muted";

export const TONE_BOX: Record<Tone, string> = {
  ok: "border-ok/40 bg-ok-soft text-ok",
  fail: "border-fail/40 bg-fail-soft text-fail",
  warn: "border-warn/50 bg-warn-soft text-warn",
  info: "border-info/40 bg-info-soft text-info",
  muted: "border-border bg-muted text-muted-foreground",
};
