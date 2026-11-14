import type { ResultState } from "@/lib/api/types";
import { RESULT_STATE } from "@/lib/status";
import { TONE_BOX } from "./tone";

/**
 * Compact result-state label (icon + word + tone). The full explanation stays available through
 * the title; surfaces that show computed values still wrap them in ResultStateFrame.
 */
export function ResultBadge({ state }: { state: ResultState }) {
  const s = RESULT_STATE[state];
  return (
    <span
      title={s.detail}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_BOX[s.tone]}`}
    >
      <span aria-hidden="true">{s.icon}</span>
      {s.label}
    </span>
  );
}
