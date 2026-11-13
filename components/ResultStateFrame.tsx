import type { ReactNode } from "react";
import type { ResultState } from "@/lib/api/types";
import { RESULT_STATE } from "@/lib/status";

const BORDER = {
  ok: "border-ok/50",
  fail: "border-fail/50",
  warn: "border-warn/60",
  info: "border-info/50",
  muted: "border-border",
} as const;

/**
 * Wraps every surface that shows computed values, so a synthetic or unverified value can never
 * appear without its label (NFR-01, rule 1: no placeholder is shown as science).
 */
export function ResultStateFrame({ state, children }: { state: ResultState; children: ReactNode }) {
  const s = RESULT_STATE[state];
  return (
    <section aria-label={`Result state: ${s.label}`} className={`rounded-lg border-2 ${BORDER[s.tone]} bg-surface`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-4 py-2 text-sm">
        <strong>
          <span aria-hidden="true">{s.icon} </span>
          {s.label}
        </strong>
        <span className="text-muted">{s.detail}</span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
