"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { describeError, getJson, postJson } from "@/lib/api/client";
import type { ReferenceDefinition, RunSummary } from "@/lib/api/types";
import { siteLabel } from "@/lib/format";

/**
 * One precomputed comparison of named places (a reference definition such as GR-002): shows what it holds and
 * starts it. The same inputs always attach to the same run, so on the hosted replay copy this opens the saved run.
 */
export function ReferenceRunCard({ refId, buttonLabel }: { refId: string; buttonLabel: string }) {
  const router = useRouter();
  const [ref, setRef] = useState<ReferenceDefinition | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    getJson<ReferenceDefinition>(`references/${refId}`, ctl.signal)
      .then(setRef)
      .catch((e) => !(e instanceof DOMException) && setErr(describeError(e)));
    return () => ctl.abort();
  }, [refId]);

  async function start() {
    if (!ref) return;
    setBusy(true);
    setErr(null);
    try {
      const run = await postJson<RunSummary>("analyses", ref.request);
      router.push(`/runs/${run.run_id}`);
    } catch (e) {
      setErr(describeError(e));
      setBusy(false);
    }
  }

  return (
    <div className="surface-card p-5">
      <h3 className="text-base font-semibold">{ref?.title ?? refId}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{ref?.purpose ?? "Loading the definition…"}</p>
      {ref && (
        <p className="mt-2 text-sm">
          {ref.request.sites.map((s) => ("site_id" in s ? siteLabel(s.site_id) : "custom")).join(", ")}
        </p>
      )}
      <button type="button" onClick={start} disabled={busy || !ref} className="btn-primary mt-3">
        {busy ? "Opening…" : buttonLabel}
      </button>
      {ref && (
        <p className="mt-2 text-xs text-muted-foreground">
          {ref.reference_id} is a {ref.status} definition: named places at the IAU&rsquo;s official centre points, not landing
          recommendations. A crater centre is its floor, not its rim.
        </p>
      )}
      {err && (
        <p role="alert" className="mt-3 rounded-md border border-fail/40 bg-fail-soft px-3 py-2 text-sm text-fail">
          {err}
        </p>
      )}
    </div>
  );
}
