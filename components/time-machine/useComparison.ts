"use client";

import { useEffect, useMemo, useState } from "react";
import { describeError, getJson, postJson } from "@/lib/api/client";
import type { Alignment, ResultsResponse, RunComparisonResponse } from "@/lib/api/types";
import { useRun } from "../RunView";

export const DONE = new Set(["complete", "complete_with_warnings"]);

/**
 * Everything the comparison needs, with every reply bound to the run ids and the alignment it was
 * asked for: a late reply for an earlier choice can never replace what the user is looking at.
 */
export function useComparison(baseId: string, childId: string, alignment: Alignment) {
  const { run: child, error: childErr } = useRun(childId);
  const ready = !!child && DONE.has(child.status);
  const [results, setResults] = useState<{ a: ResultsResponse; b: ResultsResponse } | null>(null);
  const [cmp, setCmp] = useState<RunComparisonResponse | null>(null);
  const [cmpErr, setCmpErr] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const ctl = new AbortController();
    const q = "results?include=intervals,events";
    Promise.all([
      getJson<ResultsResponse>(`analyses/${baseId}/${q}`, ctl.signal),
      getJson<ResultsResponse>(`analyses/${childId}/${q}`, ctl.signal),
    ])
      .then(([a, b]) => {
        if (a.run_id !== baseId || b.run_id !== childId) return; // result binding
        setResults({ a, b });
        setSiteId((s) => s ?? a.sites[0]?.site_id ?? null);
      })
      .catch((e) => !(e instanceof DOMException) && setCmpErr(describeError(e)));
    return () => ctl.abort();
  }, [ready, baseId, childId]);

  // The comparison is computed by the service. A late reply for another alignment or run is dropped.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    postJson<RunComparisonResponse>("comparisons", { runs: [baseId, childId], alignment })
      .then((c) => {
        if (!alive || c.runs.a.run_id !== baseId || c.runs.b.run_id !== childId || c.alignment !== alignment) return;
        setCmp(c);
        setCmpErr(null);
      })
      .catch((e) => {
        if (!alive) return;
        setCmp(null);
        setCmpErr(describeError(e));
      });
    return () => {
      alive = false;
    };
  }, [ready, baseId, childId, alignment]);

  const panels = useMemo(() => {
    if (!results || !siteId) return null;
    return (["a", "b"] as const).map((k) => ({
      key: k,
      title: k === "a" ? "Baseline" : "Shifted",
      run: results[k],
      site: results[k].sites.find((s) => s.site_id === siteId),
    }));
  }, [results, siteId]);

  return { child, childErr, ready, results, cmp, cmpErr, siteId, setSiteId, panels };
}
