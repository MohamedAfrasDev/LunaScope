"use client";

import { useEffect, useState } from "react";
import { describeError, getJson } from "@/lib/api/client";
import type { ProvenanceResponse } from "@/lib/api/types";
import { shortId, siteLabel, targetLabel } from "@/lib/format";

/** Provenance beside the numbers: what was used, what was checked, and what was not. */
export function EvidencePanel({ runId }: { runId: string }) {
  const [p, setP] = useState<ProvenanceResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    getJson<ProvenanceResponse>(`analyses/${runId}/provenance`, ctl.signal)
      .then(setP)
      .catch((e) => !(e instanceof DOMException) && setErr(describeError(e)));
    return () => ctl.abort();
  }, [runId]);

  return (
    <section aria-labelledby="evidence" className="rounded-lg border border-border bg-surface p-4">
      <h2 id="evidence" className="text-lg font-semibold">
        Evidence
      </h2>
      {err && <p role="alert" className="mt-2 text-sm text-fail">{err}</p>}
      {!p && !err && <p className="mt-2 text-sm text-muted">Loading provenance…</p>}
      {p && (
        <div className="mt-3 grid gap-5 text-sm">
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[max-content_1fr]">
            <dt className="text-muted">Run</dt>
            <dd className="font-mono text-xs" title={p.run_id}>{shortId(p.run_id)}…</dd>
            <dt className="text-muted">Result</dt>
            <dd className="font-mono text-xs" title={p.result_id}>{shortId(p.result_id)}…</dd>
            <dt className="text-muted">Algorithm</dt>
            <dd>{p.algorithm_id}</dd>
            <dt className="text-muted">Validated scopes</dt>
            <dd>{p.validated_scopes.length ? p.validated_scopes.join(", ") : "none: no validation gate has closed"}</dd>
          </dl>

          <div>
            <h3 className="font-semibold">Pinned resources</h3>
            <ul className="mt-1 space-y-1">
              {p.resources.map((r) => (
                <li key={r.role}>
                  <span className="text-muted">{r.role}: </span>
                  <span className="font-mono text-xs" title={r.sha256}>SHA-256 {r.sha256.slice(0, 16)}…</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold">Geometry checks, per site</h3>
            <ul className="mt-1 space-y-2">
              {p.sites.map((s) => (
                <li key={s.site_id}>
                  <strong>{siteLabel(s.site_id)}</strong>
                  <span className="text-muted"> · ground {s.observer.ground_height_m.toFixed(0)} m</span>
                  <ul className="ml-4 list-disc">
                    {Object.entries(s.geometry).map(([t, g]) => (
                      <li key={t}>
                        {targetLabel(t)}: {g.provider}
                        {g.reference_agreement
                          ? `; independent SPICE check max ${g.reference_agreement.max_total_arcsec.toFixed(4)}″ ` +
                            `(tolerance ${g.reference_agreement.tolerance_arcsec}″, ` +
                            `${g.reference_agreement.within_tolerance ? "within" : "EXCEEDED"})`
                          : "; no independent check on this stack"}
                        {g.holdout ? `; interpolation holdout ${g.holdout.max_deg.toExponential(1)}°` : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Geometry agreement checks the Sun and Earth directions only. It does not validate the terrain
              horizon.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">Limits that apply to every number here</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {Array.from(new Set(p.sites.flatMap((s) => s.caveats))).map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href={`/api/v1/analyses/${runId}/export`}
              download={`lunascope-${shortId(runId)}.json`}
              className="rounded border border-border px-3 py-2 font-medium"
            >
              Download investigative bundle (JSON)
            </a>
            <span className="text-xs text-muted">
              A verified export is not offered: no validation scope has closed for this run.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
