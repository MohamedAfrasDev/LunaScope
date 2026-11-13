"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, describeError, getJson } from "@/lib/api/client";
import type { RunStatusResponse } from "@/lib/api/types";
import { shortId } from "@/lib/format";
import { WARNING_TEXT } from "@/lib/status";
import { EvidenceLink } from "./EvidencePanel";
import { ResultStateFrame } from "./ResultStateFrame";
import { StatusMatrix } from "./StatusMatrix";

const TERMINAL = new Set(["complete", "complete_with_warnings", "failed"]);

/**
 * Poll one run. Every response is bound to the run id it was requested for, so a late reply for
 * an earlier selection can never overwrite what the user is now looking at.
 */
export function useRun(runId: string) {
  // State starts empty on mount; callers remount with key={runId} when the run changes.
  const [run, setRun] = useState<RunStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let delay = 1000;

    const tick = async () => {
      try {
        const r = await getJson<RunStatusResponse>(`analyses/${runId}`, ctl.signal);
        if (!alive || r.run_id !== runId) return; // result binding
        setRun(r);
        setError(null);
        if (TERMINAL.has(r.status)) return;
        delay = Math.min(delay * 1.25, 5000);
      } catch (e) {
        if (!alive || (e instanceof DOMException && e.name === "AbortError")) return;
        if (e instanceof ApiError && e.code === "NOT_FOUND") {
          setNotFound(true);
          return;
        }
        setError(describeError(e));
        delay = Math.min(delay * 2, 10_000);
      }
      timer = setTimeout(tick, delay);
    };
    tick();
    return () => {
      alive = false;
      ctl.abort();
      clearTimeout(timer);
    };
  }, [runId]);

  return { run, error, notFound };
}

export function RunView({ runId }: { runId: string }) {
  const { run, error, notFound } = useRun(runId);

  if (notFound)
    return (
      <div role="alert" className="rounded border border-border bg-surface p-4">
        <h1 className="text-xl font-semibold">Run not found</h1>
        <p className="mt-2 text-sm text-muted">
          No run with this id exists on this service. <Link className="text-accent underline" href="/analyze">Start a new analysis</Link>.
        </p>
      </div>
    );

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analysis {shortId(runId)}</h1>
        <p className="mt-1 text-sm text-muted">
          This run is an immutable snapshot identified by its inputs; submitting the same inputs again returns it.
        </p>
      </div>

      <div aria-live="polite" className="text-sm">
        {!run && !error && <p className="text-muted">Loading…</p>}
        {error && (
          <p role="alert" className="rounded border border-warn/50 bg-warn-soft px-3 py-2 text-warn">
            {error} Retrying…
          </p>
        )}
        {run && (run.status === "queued" || run.status === "running") && (
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="font-medium">
              {run.status === "queued" ? "Queued" : "Running"}
              {run.stage && run.status === "running" ? `: ${run.stage}` : ""}
            </p>
            <progress className="mt-2 w-full" max={1} value={run.progress ?? 0}
              aria-label="Analysis progress" />
            <p className="mt-1 text-xs text-muted">
              Seven-day runs on real data take roughly 20–60 seconds per site. You can leave and come back to this
              address.
            </p>
          </div>
        )}
        {run?.status === "failed" && (
          <div role="alert" className="rounded-lg border border-fail/50 bg-fail-soft p-4 text-fail">
            <p className="font-semibold">The analysis did not complete.</p>
            <p className="mt-1">
              {run.error?.code}: {run.error?.message}
            </p>
            <p className="mt-2 text-sm">
              No result was produced, so nothing is shown as passed or failed.{" "}
              <Link className="underline" href="/analyze">Adjust and try again</Link>.
            </p>
          </div>
        )}
      </div>

      {run?.matrix && (run.status === "complete" || run.status === "complete_with_warnings") && (
        <>
          <p className="text-sm">
            <Link href={`/runs/${runId}/time-machine`} className="font-medium text-accent underline underline-offset-4">
              What if the date slips? Open the Time Machine
            </Link>
          </p>
          <ResultStateFrame state={run.result_state}>
            <StatusMatrix runId={runId} rows={run.matrix} />
            {run.warnings && run.warnings.length > 0 && (
              <div className="mt-4">
                <h2 className="text-sm font-semibold">Warnings carried with these results</h2>
                <ul className="mt-1 space-y-1 text-sm">
                  {run.warnings.map((w) => (
                    <li key={w}>
                      <code className="rounded bg-surface-2 px-1 text-xs">{w}</code>{" "}
                      <span className="text-muted">{WARNING_TEXT[w] ?? ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ResultStateFrame>
          <EvidenceLink runId={runId} />
        </>
      )}
    </div>
  );
}
