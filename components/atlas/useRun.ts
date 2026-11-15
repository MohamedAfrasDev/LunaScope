"use client";

import { useEffect, useState } from "react";
import { describeError, getJson, postJson } from "@/lib/api/client";
import type { ReferenceDefinition, ResultsResponse, RunStatusResponse, RunSummary } from "@/lib/api/types";
import { buildRunData, type RunData } from "@/lib/atlas/run";

export const REFERENCE_ID = "GR-001";
const RUN_ID = /^[0-9a-f]{64}$/;
const POLL_MS = 1500;

export type RunLoad =
  | { status: "loading"; stage: string; progress: number | null }
  | { status: "ready"; run: RunData; reference: string | null }
  | { status: "error"; message: string };

/**
 * The run the Atlas shows. `?run=<64 hex>` opens that run; otherwise the reference mission GR-001 is submitted exactly as the
 * service holds it (the same inputs always attach to the same run), polled until it finishes, and its series are fetched once.
 * Nothing is shown if any step fails, and the reason is said in words.
 */
export function useRun(): RunLoad {
  const [state, setState] = useState<RunLoad>({ status: "loading", stage: "Starting", progress: null });

  useEffect(() => {
    const ctl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fail = (e: unknown) => {
      if (ctl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
      setState({ status: "error", message: describeError(e) });
    };

    async function load(runId: string, reference: string | null) {
      const results = await getJson<ResultsResponse>(`analyses/${runId}/results?include=intervals,events,series`, ctl.signal);
      if (ctl.signal.aborted) return;
      const run = buildRunData(results);
      if (!run) return setState({ status: "error", message: "The run finished but returned no time series to play." });
      setState({ status: "ready", run, reference });
    }

    async function poll(runId: string, reference: string | null) {
      try {
        const s = await getJson<RunStatusResponse>(`analyses/${runId}`, ctl.signal);
        if (ctl.signal.aborted) return;
        if (s.status === "failed") return setState({ status: "error", message: s.error?.message ?? "The run failed, so no result is shown." });
        if (s.status === "complete" || s.status === "complete_with_warnings") return await load(runId, reference);
        setState({ status: "loading", stage: s.stage ?? (s.status === "queued" ? "Queued" : "Running"), progress: s.progress });
        timer = setTimeout(() => void poll(runId, reference), POLL_MS);
      } catch (e) {
        fail(e);
      }
    }

    (async () => {
      try {
        const fromUrl = new URLSearchParams(window.location.search).get("run");
        if (fromUrl && RUN_ID.test(fromUrl)) return void (await poll(fromUrl, null));
        const ref = await getJson<ReferenceDefinition>(`references/${REFERENCE_ID}`, ctl.signal);
        if (ctl.signal.aborted) return;
        const run = await postJson<RunSummary>("analyses", ref.request);
        if (ctl.signal.aborted) return;
        await poll(run.run_id, ref.reference_id);
      } catch (e) {
        fail(e);
      }
    })();

    return () => {
      ctl.abort();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return state;
}
