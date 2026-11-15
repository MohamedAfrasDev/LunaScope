"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { describeError, getJson, postJson } from "@/lib/api/client";
import type { ProvenanceResponse, ResultsResponse, RunStatusResponse, RunSummary } from "@/lib/api/types";
import type { RunWindow } from "@/lib/atlas/clock";
import { buildRunData } from "@/lib/atlas/run";
import { baseRequestFromProvenance, buildSiteRequest, sameWindow, type BaseRequest, type SiteExtra } from "@/lib/atlas/site-run";
import type { AtlasSite } from "@/lib/atlas/sites";

const POLL_MS = 1500;

/** The inputs of the loaded run (window, requirements, terrain), read from its provenance. */
export function useRunRequest(runId: string | null): BaseRequest | null {
  const [got, setGot] = useState<{ id: string; request: BaseRequest | null } | null>(null);
  useEffect(() => {
    if (!runId) return;
    const ctl = new AbortController();
    getJson<ProvenanceResponse>(`analyses/${runId}/provenance`, ctl.signal)
      .then((p) => !ctl.signal.aborted && setGot({ id: runId, request: baseRequestFromProvenance(p) }))
      .catch(() => !ctl.signal.aborted && setGot({ id: runId, request: null }));
    return () => ctl.abort();
  }, [runId]);
  return runId && got?.id === runId ? got.request : null;
}

export type SiteRunState =
  | { status: "loading"; stage: string; progress: number | null }
  | { status: "error"; message: string }
  | { status: "ready" };

type Store = { key: string; states: Record<string, SiteRunState>; extras: Record<string, SiteExtra> };
const EMPTY = (key: string): Store => ({ key, states: {}, extras: {} });

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), reject(new DOMException("aborted", "AbortError"))), { once: true });
  });

/**
 * Sun and Earth paths for sites the loaded run does not hold. `compute(site)` submits a one-site run with the same window and
 * settings, follows it until it finishes, and keeps its series, so the site works everywhere a site of the run does. Choosing
 * another run drops everything computed for the old one. Replay mode and failures are said in words; nothing is invented.
 */
export function useSiteRuns(baseRunId: string | null, window_: RunWindow | null, request: BaseRequest | null) {
  const key = baseRunId ?? "";
  const [store, setStore] = useState<Store>(EMPTY(key));
  const ctls = useRef(new Map<string, AbortController>());
  const cur = store.key === key ? store : EMPTY(key);

  useEffect(() => {
    const map = ctls.current;
    return () => {
      map.forEach((c) => c.abort());
      map.clear();
    };
  }, [key]);

  const patch = useCallback(
    (siteId: string, state: SiteRunState, extra?: SiteExtra) =>
      setStore((prev) => {
        const base = prev.key === key ? prev : EMPTY(key);
        return { key, states: { ...base.states, [siteId]: state }, extras: extra ? { ...base.extras, [siteId]: extra } : base.extras };
      }),
    [key],
  );

  const compute = useCallback(
    (site: AtlasSite) => {
      if (!key || !request || !window_) return;
      ctls.current.get(site.id)?.abort();
      const ctl = new AbortController();
      ctls.current.set(site.id, ctl);
      patch(site.id, { status: "loading", stage: "Starting", progress: null });
      (async () => {
        try {
          const run = await postJson<RunSummary>("analyses", buildSiteRequest(request, site));
          for (;;) {
            const s = await getJson<RunStatusResponse>(`analyses/${run.run_id}`, ctl.signal);
            if (s.status === "failed") return patch(site.id, { status: "error", message: s.error?.message ?? "The run failed, so no paths are shown." });
            if (s.status === "complete" || s.status === "complete_with_warnings") break;
            patch(site.id, { status: "loading", stage: s.stage ?? (s.status === "queued" ? "Queued" : "Running"), progress: s.progress });
            await sleep(POLL_MS, ctl.signal);
          }
          const results = await getJson<ResultsResponse>(`analyses/${run.run_id}/results?include=intervals,events,series`, ctl.signal);
          const data = buildRunData(results);
          const id = data ? Object.keys(data.sites)[0] : undefined;
          if (!data || !id) return patch(site.id, { status: "error", message: "The run finished but returned no time series for this site." });
          if (!sameWindow(data.window, window_)) return patch(site.id, { status: "error", message: "The computed window does not match the loaded run, so it is not shown." });
          patch(site.id, { status: "ready" }, { runId: run.run_id, serviceId: id, tracks: data.sites[id] });
        } catch (e) {
          if (ctl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
          patch(site.id, { status: "error", message: describeError(e) });
        }
      })();
    },
    [key, request, window_, patch],
  );

  const extras = useMemo(() => cur.extras, [cur.extras]);
  return { states: cur.states, extras, compute, canCompute: !!key && !!request && !!window_ };
}
