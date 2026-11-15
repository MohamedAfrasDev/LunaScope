"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";
import type { Alignment, VariantsResponse } from "@/lib/api/types";
import { shortId } from "@/lib/format";
import { AlternativesStrip } from "./AlternativesStrip";
import { useRun } from "./RunView";
import { AlignmentChoice } from "./time-machine/AlignmentChoice";
import { RunComparison } from "./time-machine/RunComparison";
import { ShiftForm } from "./time-machine/ShiftForm";
import { ShiftedRuns } from "./time-machine/ShiftedRuns";
import { DONE } from "./time-machine/useComparison";
import { Alert } from "./ui/alert";
import { SectionHeader } from "./ui/section-header";
import { LoadingState } from "@/components/ui/loading-state";

/**
 * Mission Time Machine: what changes if the date slips? Three steps, one question each:
 * 1 shift the start, 2 test a range of dates, 3 compare a shifted run with the baseline.
 * The service computes everything; this component only asks, binds each reply to the run it was
 * asked for, and lays the answers out.
 */
export function TimeMachineView({ runId, embedded = false }: { runId: string; embedded?: boolean }) {
  const { run: base, error: baseErr, notFound } = useRun(runId);
  const [links, setLinks] = useState<VariantsResponse | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [alignment, setAlignment] = useState<Alignment>("elapsed");

  const loadLinks = useCallback(
    (signal?: AbortSignal) =>
      getJson<VariantsResponse>(`analyses/${runId}/variants`, signal)
        .then((v) => {
          if (v.run_id !== runId) return;
          setLinks(v);
          setChildId((cur) => cur ?? v.children.at(-1)?.child_run_id ?? null);
        })
        .catch(() => undefined), // the list is a convenience; the form works without it
    [runId],
  );

  useEffect(() => {
    const ctl = new AbortController();
    loadLinks(ctl.signal);
    return () => ctl.abort();
  }, [loadLinks]);

  if (notFound)
    return (
      <p role="alert" className="surface-card p-4">
        No run with this id exists. <Link className="text-primary underline" href="/analyze">Start a new analysis</Link>.
      </p>
    );

  const baseReady = base && DONE.has(base.status);
  const hasRuns = !!links && links.children.length > 0;

  return (
    <div className="grid gap-6">
      <div>
        {embedded ? <h2 className="text-base font-medium">Mission Time Machine</h2> : <h1 className="type-title">Mission Time Machine</h1>}
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          What changes if the date slips? Shift the start and LunaScope recomputes the same sites with the same
          requirements and terrain. Only the start date changes; the baseline{" "}
          <span className="readout text-xs">{shortId(runId)}</span> stays frozen.
        </p>
      </div>

      {baseErr && <Alert variant="warning">{baseErr}</Alert>}
      {!base && !baseErr && <LoadingState label="Loading the baseline…" />}
      {base && !baseReady && (
        <p className="surface-card p-4 text-sm" aria-live="polite">
          {base.status === "failed"
            ? "The baseline did not complete, so there is nothing to compare against."
            : `The baseline is ${base.status}. The Time Machine opens when it has finished.`}
        </p>
      )}

      {baseReady && (
        <ShiftForm
          runId={runId}
          onShifted={(id) => {
            setChildId(id);
            loadLinks();
          }}
        />
      )}

      {baseReady && (
        <AlternativesStrip
          runId={runId}
          onOpenDate={(_days, id) => {
            setChildId(id);
            loadLinks();
            const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
            document.getElementById("time-alignment")?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
          }}
        />
      )}

      {baseReady && (hasRuns || childId) && (
        <SectionHeader eyebrow="Step 3 of 3" title="Compare a shifted run" as="h2" />
      )}
      {baseReady && links && hasRuns && <ShiftedRuns links={links} selected={childId} onSelect={setChildId} />}
      {baseReady && childId && <AlignmentChoice value={alignment} onChange={setAlignment} />}
      {baseReady && childId && <RunComparison key={childId} baseId={runId} childId={childId} alignment={alignment} />}
    </div>
  );
}
