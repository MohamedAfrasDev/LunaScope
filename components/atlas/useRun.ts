"use client";

import { useEffect, useState } from "react";
import { ApiError, describeError, getJson, postJson } from "@/lib/api/client";
import type { ReferenceDefinition, ResultsResponse, RunStatusResponse, RunSummary } from "@/lib/api/types";
import { buildRunData, type RunData } from "@/lib/atlas/run";
import { targetKey, type RunTarget } from "@/lib/atlas/run-target";

export type RunLoad =
  | { status: "loading"; stage: string; progress: number | null }
  | { status: "ready"; run: RunData; reference: string | null }
  | {
      status: "error";
      message: string;
      /** Starts the load again (for example after the service was restarted). */
      retry: () => void;
      /** The service does not hold this run (it was restarted, or another stack is behind it): trying again cannot help. */
      missing?: boolean;
    };

const POLL_MS = 1500;
const LOADING: RunLoad = { status: "loading", stage: "Starting", progress: null };

/**
 * The run the Atlas shows. A reference mission is submitted exactly as the service holds it (the same inputs always attach to
 * the same run), a run id is used as given; either is polled until it finishes and its series are fetched once. Nothing is shown
 * if any step fails, and the reason is said in words. Changing the target starts a new load; an answer for an old target is dropped.
 */
export function useRun(target: RunTarget): RunLoad {
  const [attempt, setAttempt] = useState(0);
  const key = `${targetKey(target)}#${attempt}`;
  const [state, setState] = useState<{ key: string; load: RunLoad }>({ key, load: LOADING });

  useEffect(() => {
    const ctl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const set = (load: RunLoad) => !ctl.signal.aborted && setState({ key, load });
    const retry = () => setAttempt((a) => a + 1);
    const fail = (e: unknown) => {
      if (ctl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
      set({ status: "error", message: describeError(e), retry });
    };
    // a reference whose run the service no longer has (it was restarted, or another stack is behind it) is submitted again once
    let healed = false;

    async function load(runId: string, reference: string | null) {
      const results = await getJson<ResultsResponse>(`analyses/${runId}/results?include=intervals,events,series`, ctl.signal);
      if (ctl.signal.aborted) return;
      const run = buildRunData(results);
      if (!run) return set({ status: "error", message: "The run finished but returned no time series to play.", retry });
      set({ status: "ready", run, reference });
    }

    async function poll(runId: string, reference: string | null) {
      try {
        const s = await getJson<RunStatusResponse>(`analyses/${runId}`, ctl.signal);
        if (ctl.signal.aborted) return;
        if (s.status === "failed") return set({ status: "error", message: s.error?.message ?? "The run failed, so no result is shown.", retry });
        if (s.status === "complete" || s.status === "complete_with_warnings") return await load(runId, reference);
        set({ status: "loading", stage: s.stage ?? (s.status === "queued" ? "Queued" : "Running"), progress: s.progress });
        timer = setTimeout(() => void poll(runId, reference), POLL_MS);
      } catch (e) {
        if (target.kind === "reference" && !healed && e instanceof ApiError && e.status === 404) {
          healed = true;
          return void (await startReference());
        }
        if (target.kind === "run" && e instanceof ApiError && e.status === 404 && !ctl.signal.aborted) {
          return set({ status: "error", message: "This service does not hold that run.", retry, missing: true });
        }
        fail(e);
      }
    }

    async function startReference() {
      try {
        if (target.kind !== "reference") return;
        const ref = await getJson<ReferenceDefinition>(`references/${target.id}`, ctl.signal);
        if (ctl.signal.aborted) return;
        const run = await postJson<RunSummary>("analyses", ref.request);
        if (ctl.signal.aborted) return;
        await poll(run.run_id, ref.reference_id);
      } catch (e) {
        fail(e);
      }
    }

    (async () => {
      try {
        if (target.kind === "run") return void (await poll(target.id, null));
        await startReference();
      } catch (e) {
        fail(e);
      }
    })();

    return () => {
      ctl.abort();
      if (timer) clearTimeout(timer);
    };
    // the key stands for the target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state.key === key ? state.load : LOADING;
}
