"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { describeError, getJson } from "@/lib/api/client";
import type { HorizonKind, ResultsResponse, SiteResults, Target } from "@/lib/api/types";
import { degrees, duration, pctRange, siteLabel, targetLabel, utc } from "@/lib/format";
import { OUTCOME, SITE_STATUS, WARNING_TEXT } from "@/lib/status";
import { ResultStateFrame } from "./ResultStateFrame";
import { StatusChip } from "./StatusChip";
import { plainFact } from "@/lib/guided";
import { SensitivityPanel } from "./SensitivityPanel";
import { useViewMode } from "./ViewMode";
import { AvailabilityBar, IntervalTable, Legend, TimelineChart, type Band } from "./TimelineChart";

const TARGETS: Target[] = ["sun_center", "earth_center"];
const HORIZONS: HorizonKind[] = ["terrain", "flat"];

function buildBands(site: SiteResults): Band[] {
  const bands: Band[] = [];
  for (const t of TARGETS)
    for (const h of HORIZONS) {
      const r = site.target_metrics[t]?.[h];
      if (!r?.intervals) continue;
      const m = r.metrics;
      const longest = m.longest_known_hidden_start != null && m.longest_known_hidden_end != null && m.longest_known_hidden_s > 0
        ? { start_s: m.longest_known_hidden_start, end_s: m.longest_known_hidden_end,
            text: `Longest known outage: ${duration(m.longest_known_hidden_s)}` }
        : undefined;
      bands.push({
        target: t,
        horizon: h,
        mark: h === "terrain" ? longest : undefined,
        intervals: r.intervals,
        events: r.events ?? [],
        summary:
          `${targetLabel(t)}, ${h === "terrain" ? "terrain-aware" : "flat horizon"}: availability ` +
          `${pctRange(m.availability_lower, m.availability_upper)}, outcome ${OUTCOME[m.outcome].label}, ` +
          `longest known hidden period ${duration(m.longest_known_hidden_s)}, ${r.events?.length ?? 0} predicted event(s).`,
      });
    }
  return bands;
}

function csv(bands: Band[]): string {
  const rows = ["target,horizon,state,start_utc,end_utc,duration_s"];
  for (const b of bands)
    for (const i of b.intervals)
      rows.push(`${b.target},${b.horizon},${i.class},${i.start_utc},${i.end_utc},${i.end_s - i.start_s}`);
  return rows.join("\n");
}

export function TimelineView({ runId, siteId }: { runId: string; siteId: string }) {
  const mode = useViewMode();
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    getJson<ResultsResponse>(
      `analyses/${runId}/results?site=${encodeURIComponent(siteId)}&include=intervals,events`,
      ctl.signal,
    )
      .then((r) => r.run_id === runId && setData(r))
      .catch((e) => !(e instanceof DOMException) && setErr(describeError(e)));
    return () => ctl.abort();
  }, [runId, siteId]);

  const site = data?.sites[0];
  const bands = useMemo(() => (site ? buildBands(site) : []), [site]);

  const back = (
    <Link href={`/runs/${runId}`} className="text-sm text-accent underline underline-offset-4">
      ← Back to the status matrix
    </Link>
  );

  if (err)
    return (
      <div className="grid gap-3">
        {back}
        <p role="alert" className="rounded border border-fail/40 bg-fail-soft px-3 py-2 text-fail">{err}</p>
      </div>
    );
  if (!data || !site) return <div className="grid gap-3">{back}<p className="text-muted">Loading the timeline…</p></div>;

  const sp = SITE_STATUS[site.site_status];
  const download = () => {
    const url = URL.createObjectURL(new Blob([csv(bands)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lunascope-${siteId}-intervals.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6">
      {back}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Timeline: {siteLabel(siteId)}</h1>
        <StatusChip p={sp} title={sp.help} />
        <Link href={`/runs/${runId}/sky/${encodeURIComponent(siteId)}`} className="text-sm text-accent underline underline-offset-4">
          Local sky
        </Link>
      </div>

      <ResultStateFrame state={site.result_state}>
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {TARGETS.map((t) => {
              const r = site.target_metrics[t]?.terrain;
              const f = site.target_metrics[t]?.flat;
              if (!r || !f) return null;
              const m = r.metrics;
              const o = OUTCOME[m.outcome];
              const facts = site.target_metrics[t]?.explanations ?? [];
              return (
                <section key={t} aria-label={`${targetLabel(t)} summary`} className="rounded border border-border p-3 text-sm">
                  <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
                    {targetLabel(t)} <StatusChip p={o} title={o.help} />
                  </h2>
                  {facts.length > 0 && (
                    <div className="mt-2">
                      <h3 className="text-sm font-semibold">{mode === "guided" ? "In plain words" : "Facts from the service"}</h3>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {facts.map((f) => <li key={f.code}>{mode === "guided" ? plainFact(f, t) : f.text}</li>)}
                      </ul>
                    </div>
                  )}
                  <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
                    <dt className="text-muted">Availability, terrain</dt>
                    <dd className="tabular-nums">{pctRange(m.availability_lower, m.availability_upper, 2)} (needs at least {Math.round(m.threshold * 100)}%)</dd>
                    <dt className="text-muted">Availability, flat horizon</dt>
                    <dd className="tabular-nums">{pctRange(f.metrics.availability_lower, f.metrics.availability_upper, 2)}</dd>
                    <dt className="text-muted">Longest known hidden</dt>
                    <dd>{duration(m.longest_known_hidden_s)}</dd>
                    <dt className="text-muted">Total known hidden</dt>
                    <dd>{duration(m.hidden_s)}{m.unknown_s > 0 ? ` (plus ${duration(m.unknown_s)} unresolved or unknown)` : ""}</dd>
                    <dt className="text-muted">Best clearance over the skyline</dt>
                    <dd>{r.clearance_at_nodes ? degrees(r.clearance_at_nodes.max_deg) : "unknown"}</dd>
                    <dt className="text-muted">At the start</dt>
                    <dd>{r.countdown_at_start.text}{r.countdown_at_start.remaining_s != null ? `, in ${duration(r.countdown_at_start.remaining_s)}` : ""}</dd>
                  </dl>
                  <div className="mt-2">
                    <AvailabilityBar lower={m.availability_lower} upper={m.availability_upper} threshold={m.threshold}
                      label={`${targetLabel(t)}, terrain-aware`} />
                  </div>
                  {m.exclusion_reasons.length > 0 && (
                    <p className="mt-2 text-xs text-muted">Excluded because: {m.exclusion_reasons.join(", ")}.</p>
                  )}
                </section>
              );
            })}
          </div>

          <div>
            <TimelineChart bands={bands} title={`Visibility timeline for ${siteLabel(siteId)}`} />
            <div className="mt-2"><Legend /></div>
            <p className="mt-2 text-xs text-muted">
              Black ticks are predicted rise or set times under this terrain model. The bracket above a
              terrain-aware band marks its longest known outage. Times are UTC. The
              unresolved band around each crossing is the numerical decision band, not an outage.
            </p>
          </div>

          <div className="grid gap-2">
            {bands.map((b) => <IntervalTable key={`${b.target}-${b.horizon}`} band={b} />)}
            <div>
              <button type="button" onClick={download} className="rounded border border-border px-3 py-2 text-sm font-medium">
                Download intervals (CSV)
              </button>
            </div>
          </div>

          {bands.some((b) => b.events.length > 0) && (
            <div>
              <h2 className="text-base font-semibold">Predicted events</h2>
              <ul className="mt-1 space-y-1 text-sm">
                {bands.filter((b) => b.horizon === "terrain").flatMap((b) =>
                  b.events.map((e) => (
                    <li key={`${b.target}-${e.t_s}`}>
                      {targetLabel(b.target)} {e.type}: <span className="tabular-nums">{utc(e.t_utc)}</span>{" "}
                      <span className="text-muted">
                        (solver bracket {e.solver_bracket_s} s
                        {e.geometry_timing_bound_s != null ? `, geometry timing bound ${e.geometry_timing_bound_s.toExponential(1)} s` : ", no timing bound claimed"})
                      </span>
                    </li>
                  )),
                )}
              </ul>
            </div>
          )}

          <SensitivityPanel variants={site.sensitivity ?? []} />

          {site.warnings.length > 0 && (
            <ul className="space-y-1 text-sm">
              {site.warnings.map((w) => (
                <li key={w}><code className="rounded bg-surface-2 px-1 text-xs">{w}</code> <span className="text-muted">{WARNING_TEXT[w] ?? ""}</span></li>
              ))}
            </ul>
          )}
        </div>
      </ResultStateFrame>
    </div>
  );
}
