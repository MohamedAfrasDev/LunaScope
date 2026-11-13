import type { Presentation } from "@/lib/status";

const TONE: Record<Presentation["tone"], string> = {
  ok: "border-ok/40 bg-ok-soft text-ok",
  fail: "border-fail/40 bg-fail-soft text-fail",
  warn: "border-warn/40 bg-warn-soft text-warn",
  info: "border-info/40 bg-info-soft text-info",
  muted: "border-border bg-surface-2 text-muted",
};

/** Icon + word + tone. The icon is decorative (the word carries the meaning). */
export function StatusChip({ p, title }: { p: Pick<Presentation, "label" | "icon" | "tone">; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium whitespace-nowrap ${TONE[p.tone]}`}
    >
      <span aria-hidden="true">{p.icon}</span>
      {p.label}
    </span>
  );
}
