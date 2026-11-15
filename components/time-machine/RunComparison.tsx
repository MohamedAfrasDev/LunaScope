"use client";

import type { Alignment } from "@/lib/api/types";
import { ResultStateFrame } from "../ResultStateFrame";
import { Alert } from "../ui/alert";
import { ComparisonSummary } from "./ComparisonSummary";
import { DeltaTable } from "./DeltaTable";
import { RunPanels } from "./RunPanels";
import { useComparison } from "./useComparison";
import { Progress } from "../ui/progress";

/**
 * The shifted run against its baseline. Shows the loading, failed and running states of the shifted
 * run before any comparison, so nothing is compared until both runs are complete.
 */
export function RunComparison({ baseId, childId, alignment }: { baseId: string; childId: string; alignment: Alignment }) {
  const { child, childErr, ready, results, cmp, cmpErr, siteId, setSiteId, panels } = useComparison(
    baseId,
    childId,
    alignment,
  );

  if (childErr) return <Alert variant="warning">{childErr} Retrying…</Alert>;
  if (!child) return <p className="text-muted-foreground">Loading the shifted run…</p>;
  if (child.status === "failed")
    return (
      <Alert variant="destructive" className="p-4">
        The shifted run did not complete ({child.error?.code}: {child.error?.message}). Nothing is compared.
      </Alert>
    );
  if (!ready)
    return (
      <div className="surface-card p-4" aria-live="polite">
        <p className="font-medium">
          Shifted run {child.status}
          {child.stage && child.status === "running" ? `: ${child.stage}` : ""}
        </p>
        <Progress className="mt-2 h-2" value={Math.round((child.progress ?? 0) * 100)} aria-label="Shifted run progress" />
      </div>
    );

  return (
    <div className="grid gap-6" aria-live="polite">
      {cmpErr && <Alert variant="destructive">{cmpErr}</Alert>}
      {cmp && (
        <ResultStateFrame state={cmp.result_state === "mixed" ? "real_data_unverified" : cmp.result_state}>
          <div className="grid gap-6">
            <ComparisonSummary cmp={cmp} />
            <DeltaTable cmp={cmp} />
          </div>
        </ResultStateFrame>
      )}
      {panels && results && siteId && (
        <RunPanels panels={panels} sites={results.a.sites} siteId={siteId} onSite={setSiteId} cmp={cmp} />
      )}
    </div>
  );
}
