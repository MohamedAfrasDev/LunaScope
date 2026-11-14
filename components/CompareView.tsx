"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { describeError, getJson, postJson } from "@/lib/api/client";
import type { ComparisonResponse, ResultsResponse, Target } from "@/lib/api/types";
import { fieldLabel, fieldValue, factText } from "@/lib/facts";
import { duration, pctRange, siteLabel, targetLabel } from "@/lib/format";
import { OUTCOME, SITE_STATUS, WARNING_TEXT } from "@/lib/status";
import { ResultStateFrame } from "./ResultStateFrame";
import { StatusChip } from "./StatusChip";
import { IntervalTable, Legend, TimelineChart, type Band } from "./TimelineChart";

const TARGETS: Target[] = ["sun_center", "earth_center"];

export function CompareView({ runId }: { runId: string }) {
  const uid = useId();
  const [allSites, setAllSites] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [cmp, setCmp] = useState<ComparisonResponse | null>(null);
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cmpErr, setCmpErr] = useState<string | null>(null);

  // Everything the page draws comes from the service: the run's sites and intervals once...
  useEffect(() => {
    const ctl = new AbortController();
    getJson<ResultsResponse>(`analyses/${runId}/results?include=intervals,events`, ctl.signal)
      .then((r) => {
        if (r.run_id !== runId) return;
        const ids = r.sites.map((s) => s.site_id);
        setResults(r);
        setAllSites(ids);
        setSelected(ids);
      })
      .catch((e) => !(e instanceof DOMException) && setErr(describeError(e)));
    return () => ctl.abort();
  }, [runId]);

  // ...and the comparison itself is computed by the service for the chosen sites.
  useEffect(() => {
    if (!selected || selected.length < 2) return;
    let alive = true;
    postJson<ComparisonResponse>("comparisons", { runs: [runId], sites: selected })
      .then((c) => {
        if (alive && c.run_id === runId) {
          setCmp(c);
          setCmpErr(null);
        }
      })
      .catch((e) => alive && setCmpErr(describeError(e)));
    return () => {
      alive = false;
    };
  }, [runId, selected]);

  const bands = useMemo(() => {
    const out: Record<Target, Band[]> = { sun_center: [], earth_center: [] };
    if (!results || !selected) return out;
    for (const s of results.sites) {
      if (!selected.includes(s.site_id)) continue;
      for (const t of TARGETS) {
        const r = s.target_metrics[t]?.terrain;
        if (!r?.intervals) continue;
        out[t].push({
          target: t, horizon: "terrain", intervals: r.intervals, events: r.events ?? [],
          label: siteLabel(s.site_id), sub: "terrain-aware",
          summary: `${targetLabel(t)} at ${siteLabel(s.site_id)}: availability ${pctRange(r.metrics.availability_lower, r.metrics.availability_upper)}, ` +
            `outcome ${OUTCOME[r.metrics.outcome].label}, longest known hidden ${duration(r.metrics.longest_known_hidden_s)}.`,
        });
      }
    }
    return out;
  }, [results, selected]);

  if (err)
    return (
      <div className="grid gap-3">
        <Link href={`/runs/${runId}`} className="text-sm text-accent underline underline-offset-4">← Back to the status matrix</Link>
        <p role="alert" className="rounded-md border border-fail/40 bg-fail-soft px-3 py-2 text-fail">{err}</p>
      </div>
    );
  if (!results || !allSites || !selected) return <p className="text-muted">Loading the comparison…</p>;

  const toggle = (id: string, on: boolean) => setSelected(on ? allSites.filter((s) => s === id || selected.includes(s)) : selected.filter((s) => s !== id));

  return (
    <div className="grid gap-6">
      <Link href={`/runs/${runId}`} className="text-sm text-accent underline underline-offset-4">← Back to the status matrix</Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compare sites</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Every site below was computed from identical inputs. Sunlight and Earth visibility are judged separately and
          LunaScope does not rank the sites: it shows the trade-offs.
        </p>
      </div>

      <fieldset className="surface-card p-4" aria-describedby={selected.length < 2 ? `${uid}-n` : undefined}>
        <legend className="px-1 text-base font-semibold">Sites to compare</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {allSites.map((id) => (
            <label key={id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.includes(id)} onChange={(e) => toggle(id, e.target.checked)} />
              {siteLabel(id)}
            </label>
          ))}
        </div>
        {selected.length < 2 && (
          <p id={`${uid}-n`} role="alert" className="mt-2 text-sm font-medium text-fail">
            <span aria-hidden="true">✗ </span>Choose at least two sites.
          </p>
        )}
      </fieldset>

      {cmpErr && <p role="alert" className="rounded-md border border-fail/40 bg-fail-soft px-3 py-2 text-fail">{cmpErr}</p>}

      {cmp && selected.length >= 2 && (
        <ResultStateFrame state={cmp.result_state}>
          <div className="grid gap-8">
            <section aria-labelledby={`${uid}-held`}>
              <h2 id={`${uid}-held`} className="text-lg font-semibold">Held constant and changed</h2>
              <div className="mt-2 grid gap-4 lg:grid-cols-2">
                <div className="rounded border border-border p-3">
                  <h3 className="text-sm font-semibold">Held constant (identical for every site)</h3>
                  <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                    {cmp.held_constant.map((h) => (
                      <div key={h.field} className="contents">
                        <dt className="text-muted">{fieldLabel(h.field)}</dt>
                        <dd className="break-all tabular-nums">{fieldValue(h.field, h.value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="rounded border border-border p-3">
                  <h3 className="text-sm font-semibold">Changed: the site</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {cmp.changed[0].values.map((v) => (
                      <li key={v.site_id}>
                        <strong>{siteLabel(v.site_id)}</strong>{" "}
                        <StatusChip p={SITE_STATUS[cmp.site_status[v.site_id]]} />
                        <span className="block text-xs text-muted">ground height {v.ground_height_m.toFixed(0)} m</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section aria-labelledby={`${uid}-facts`}>
              <h2 id={`${uid}-facts`} className="text-lg font-semibold">What differs</h2>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">
                {cmp.facts.map((f, i) => <li key={i}>{factText(f)}</li>)}
              </ul>
            </section>

            {TARGETS.map((t) => {
              const block = cmp.targets[t];
              return (
                <section key={t} aria-labelledby={`${uid}-${t}`}>
                  <h2 id={`${uid}-${t}`} className="text-lg font-semibold">{targetLabel(t)}</h2>
                  <p className="mt-1 text-sm text-muted">
                    Availability across the compared sites ranges from{" "}
                    <strong>{(block.spread.availability_lower_min * 100).toFixed(1)}%</strong> to{" "}
                    <strong>{(block.spread.availability_lower_max * 100).toFixed(1)}%</strong> (lower bounds).
                  </p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                      <caption className="sr-only">{targetLabel(t)} compared across sites</caption>
                      <thead>
                        <tr className="border-b border-border">
                          <th scope="col" className="py-2 pr-3">Site</th>
                          <th scope="col" className="py-2 pr-3">Terrain-aware (decides)</th>
                          <th scope="col" className="py-2 pr-3">Longest known hidden</th>
                          <th scope="col" className="py-2 pr-3">Predicted events</th>
                          <th scope="col" className="py-2 pr-3">Flat horizon (comparison)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {block.sites.map((r) => (
                          <tr key={r.site_id} className="border-b border-border align-top">
                            <th scope="row" className="py-2 pr-3 text-left font-medium">{siteLabel(r.site_id)}</th>
                            <td className="py-2 pr-3">
                              <StatusChip p={OUTCOME[r.terrain.outcome]} title={OUTCOME[r.terrain.outcome].help} />
                              <div className="mt-1 tabular-nums">{pctRange(r.terrain.availability_lower, r.terrain.availability_upper, 2)}</div>
                            </td>
                            <td className="py-2 pr-3 tabular-nums">{duration(r.terrain.longest_known_hidden_s)}</td>
                            <td className="py-2 pr-3 tabular-nums">{r.terrain.events}</td>
                            <td className="py-2 pr-3">
                              <StatusChip p={OUTCOME[r.flat.outcome]} />
                              <div className="mt-1 tabular-nums">{pctRange(r.flat.availability_lower, r.flat.availability_upper, 2)}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4">
                    <TimelineChart bands={bands[t]} title={`${targetLabel(t)} visibility timelines, one row per site, same time axis`} />
                    <div className="mt-2"><Legend /></div>
                    <div className="mt-3 grid gap-2">
                      {bands[t].map((b) => <IntervalTable key={b.label} band={b} />)}
                    </div>
                  </div>
                </section>
              );
            })}

            {cmp.warnings.length > 0 && (
              <ul className="space-y-1 text-sm">
                {cmp.warnings.map((w) => (
                  <li key={w}><code className="rounded bg-surface-2 px-1 text-xs">{w}</code> <span className="text-muted">{WARNING_TEXT[w] ?? ""}</span></li>
                ))}
              </ul>
            )}
            <div className="text-xs text-muted">
              <p className="font-medium">Limits that apply to every number here</p>
              <ul className="mt-1 list-disc pl-5">{cmp.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          </div>
        </ResultStateFrame>
      )}
    </div>
  );
}
