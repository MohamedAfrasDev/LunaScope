import type { ResultState } from "@/lib/api/types";
import { RESULT_STATE } from "@/lib/status";
import { Badge } from "./badge";

/**
 * Compact result-state label (icon + word + tone). The full explanation stays available through
 * the title; surfaces that show computed values still wrap them in ResultStateFrame.
 */
export function ResultBadge({ state }: { state: ResultState }) {
  const s = RESULT_STATE[state];
  return (
    <Badge variant={s.tone} title={s.detail} className="text-xs">
      <span aria-hidden="true">{s.icon}</span>
      {s.label}
    </Badge>
  );
}
