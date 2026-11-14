"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { describeError, getJson, postJson } from "@/lib/api/client";
import type {
  Alignment,
  ResultsResponse,
  RunComparisonResponse,
  SiteResults,
  Target,
  VariantAdmission,
  VariantLink,
  VariantsResponse,
} from "@/lib/api/types";
import { fieldLabel, fieldValue } from "@/lib/facts";
import { duration, pctRange, shortId, siteLabel, targetLabel, utc } from "@/lib/format";
import { INTERVAL, OUTCOME, SITE_STATUS, WARNING_TEXT } from "@/lib/status";
import { AlternativesStrip } from "./AlternativesStrip";
import { ResultStateFrame } from "./ResultStateFrame";
import { useRun } from "./RunView";
import { StatusChip } from "./StatusChip";
import { IntervalTable, Legend, TimelineChart, type Band } from "./TimelineChart";

const TARGETS: Target[] = ["sun_center", "earth_center"];
const DONE = new Set(["complete", "complete_with_warnings"]);
const MAX_DAYS = 30;

const ALIGNMENTS: { value: Alignment; label: string; help: string }[] = [
  {
    value: "elapsed",
    label: "Elapsed time",
    help: "Each run keeps its own UTC. Day 1 of the baseline is compared with day 1 of the shifted run.",
  },
  {
    value: "calendar",
    label: "Calendar time",
    help: "One shared UTC axis. Only the dates both runs cover are compared; time outside a run's own window is never counted.",
  },
];

/** Display only: a UTC instant `seconds` after an ISO start. The service decided every interval. */
function at(startIso: string, seconds: number): string {
  return utc(new Date(Date.parse(startIso) + seconds * 1000).toISOString());
}

function signedDays(s: number): string {
  const d = s / 86400;
  return `${d > 0 ? "+" : "−"}${Math.abs(d) % 1 === 0 ? Math.abs(d) : Math.abs(d).toFixed(2)} d`;
}

function pp(x: number): string {
  const v = x * 100;
  if (Math.abs(v) < 0.05) return "no change";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} percentage points`;
}

export function TimeMachineView({ runId }: { runId: string }) {
  const uid = useId();
  const { run: base, error: baseErr, notFound } = useRun(runId);
  const [links, setLinks] = useState<VariantsResponse | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [days, setDays] = useState("5");
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
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

  const n = Number(days);
  const daysErr =
    days.trim() === "" || !Number.isInteger(n)
      ? "Enter a whole number of days."
      : n === 0
        ? "A shift of zero days is the baseline itself."
        : Math.abs(n) > MAX_DAYS
          ? `Shift by at most ${MAX_DAYS} days either way.`
          : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (daysErr) return;
    setSubmitting(true);
    setFormErr(null);
    try {
      const v = await postJson<VariantAdmission>(`analyses/${runId}/variants`, {
        variant_type: "date_shift",
        changes: { start_offset_s: n * 86400 },
      });
      if (v.parent_run_id !== runId) return;
      setChildId(v.run_id);
      loadLinks();
    } catch (err) {
      setFormErr(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound)
    return (
      <p role="alert" className="rounded border border-border bg-surface p-4">
        No run with this id exists. <Link className="text-accent underline" href="/analyze">Start a new analysis</Link>.
      </p>
    );

  const baseReady = base && DONE.has(base.status);

  return (
    <div className="grid gap-6">
      <Link href={`/runs/${runId}`} className="text-sm text-accent underline underline-offset-4">
        ← Back to the status matrix
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mission Time Machine</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          What changes if the date slips? Shift the start and LunaScope recomputes the same sites with the same
          requirements and terrain. Only the start date changes; the baseline{" "}
          <span className="font-mono text-xs">{shortId(runId)}</span> stays frozen.
        </p>
      </div>

      {baseErr && <p role="alert" className="rounded border border-warn/50 bg-warn-soft px-3 py-2 text-warn">{baseErr}</p>}
      {!base && !baseErr && <p className="text-muted">Loading the baseline…</p>}
      {base && !baseReady && (
        <p className="rounded border border-border bg-surface p-4 text-sm" aria-live="polite">
          {base.status === "failed"
            ? "The baseline did not complete, so there is nothing to compare against."
            : `The baseline is ${base.status}. The Time Machine opens when it has finished.`}
        </p>
      )}

      {baseReady && (
        <form onSubmit={submit} noValidate className="grid gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[auto_1fr] sm:items-end">
          <div>
            <label htmlFor={`${uid}-days`} className="block text-sm font-semibold">
              Shift the start by (days)
            </label>
            <input
              id={`${uid}-days`}
              type="number"
              inputMode="numeric"
              step={1}
              min={-MAX_DAYS}
              max={MAX_DAYS}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              aria-invalid={daysErr ? true : undefined}
              aria-describedby={`${uid}-days-help${daysErr ? ` ${uid}-days-err` : ""}`}
              className="mt-1 w-32 rounded border border-border bg-background px-2 py-1.5 tabular-nums"
            />
            <p id={`${uid}-days-help`} className="mt-1 text-xs text-muted">
              Negative moves it earlier. Up to {MAX_DAYS} days.
            </p>
            {daysErr && (
              <p id={`${uid}-days-err`} className="mt-1 text-sm font-medium text-fail">
                <span aria-hidden="true">✗ </span>
                {daysErr}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting || !!daysErr}
              className="rounded bg-accent px-4 py-2 font-medium text-background disabled:opacity-50"
            >
              {submitting ? "Starting…" : "Shift and recompute"}
            </button>
            {formErr && (
              <p role="alert" className="text-sm text-fail">
                {formErr}
              </p>
            )}
          </div>
        </form>
      )}

      {baseReady && (
        <AlternativesStrip
          runId={runId}
          onOpenDate={(_days, id) => {
            setChildId(id);
            loadLinks();
            document.getElementById("time-alignment")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}

      {baseReady && links && links.children.length > 0 && (
        <TestedDates links={links} selected={childId} onSelect={setChildId} />
      )}

      {baseReady && childId && (
        <fieldset id="time-alignment" className="rounded-lg border border-border bg-surface p-4">
          <legend className="px-1 text-base font-semibold">Time alignment</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALIGNMENTS.map((a) => (
              <label key={a.value} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name={`${uid}-align`}
                  value={a.value}
                  checked={alignment === a.value}
                  onChange={() => setAlignment(a.value)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{a.label}</span>
                  <span className="block text-muted">{a.help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {baseReady && childId && <ShiftComparison key={childId} baseId={runId} childId={childId} alignment={alignment} />}
    </div>
  );
}

function TestedDates({ links, selected, onSelect }: { links: VariantsResponse; selected: string | null; onSelect: (id: string) => void }) {
  const base = Date.parse(links.start_utc);
  return (
    <section aria-label="Shifted runs of this baseline" className="text-sm">
      <h2 className="font-semibold">Shifted runs of this baseline</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {links.children.map((c: VariantLink) => {
          const off = (Date.parse(c.start_utc) - base) / 1000;
          const on = c.child_run_id === selected;
          return (
            <li key={c.child_run_id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(c.child_run_id)}
                className={`rounded border px-3 py-1.5 ${on ? "border-accent bg-surface-2 font-medium" : "border-border"}`}
              >
                {signedDays(off)} · starts {utc(c.start_utc)}
                <span className="sr-only">, {c.status}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function bandsFor(site: SiteResults | undefined, which: string): Band[] {
  if (!site) return [];
  return TARGETS.flatMap((t) => {
    const r = site.target_metrics[t]?.terrain;
    if (!r?.intervals) return [];
    return [{
      target: t, horizon: "terrain" as const, intervals: r.intervals, events: r.events ?? [], sub: "terrain-aware",
      summary: `${which}: ${targetLabel(t)} availability ${pctRange(r.metrics.availability_lower, r.metrics.availability_upper)}, ` +
        `outcome ${OUTCOME[r.metrics.outcome].label}, ${r.events?.length ?? 0} predicted event(s), from ${utc(r.intervals[0].start_utc)}.`,
    }];
  });
}

function ShiftComparison({ baseId, childId, alignment }: { baseId: string; childId: string; alignment: Alignment }) {
  const uid = useId();
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

  if (childErr) return <p role="alert" className="rounded border border-warn/50 bg-warn-soft px-3 py-2 text-warn">{childErr} Retrying…</p>;
  if (!child) return <p className="text-muted">Loading the shifted run…</p>;
  if (child.status === "failed")
    return (
      <p role="alert" className="rounded-lg border border-fail/50 bg-fail-soft p-4 text-fail">
        The shifted run did not complete ({child.error?.code}: {child.error?.message}). Nothing is compared.
      </p>
    );
  if (!ready)
    return (
      <div className="rounded-lg border border-border bg-surface p-4" aria-live="polite">
        <p className="font-medium">
          Shifted run {child.status}
          {child.stage && child.status === "running" ? `: ${child.stage}` : ""}
        </p>
        <progress className="mt-2 w-full" max={1} value={child.progress ?? 0} aria-label="Shifted run progress" />
      </div>
    );

  return (
    <div className="grid gap-6" aria-live="polite">
      {cmpErr && (
        <p role="alert" className="rounded border border-fail/40 bg-fail-soft px-3 py-2 text-fail">
          {cmpErr}
        </p>
      )}
      {cmp && (
        <ResultStateFrame state={cmp.result_state === "mixed" ? "real_data_unverified" : cmp.result_state}>
          <div className="grid gap-6">
            <section aria-labelledby={`${uid}-what`}>
              <h2 id={`${uid}-what`} className="text-lg font-semibold">
                Shifted by {signedDays(cmp.shift_s)}, compared in {cmp.alignment} time
              </h2>
              <p className="mt-1 text-sm text-muted">{cmp.note}.</p>
              {cmp.overlap && (
                <p className="mt-1 text-sm">
                  Shared window: {utc(cmp.overlap.start_utc)} for {duration(cmp.overlap.duration_s)}.
                </p>
              )}
              {cmp.result_state === "mixed" && (
                <p className="mt-1 text-sm font-medium text-warn">The two runs carry different result states.</p>
              )}
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div className="rounded border border-border p-3 text-sm">
                  <h3 className="font-semibold">Changed</h3>
                  <ul className="mt-1 space-y-1">
                    {cmp.changed.map((c) => (
                      <li key={c.field}>
                        {fieldLabel(c.field)}: {fieldValue(c.field, c.from)} → <strong>{fieldValue(c.field, c.to)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
                <details className="rounded border border-border p-3 text-sm">
                  <summary className="cursor-pointer font-semibold">Held constant ({cmp.held_constant.length} inputs)</summary>
                  <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
                    {cmp.held_constant.map((h) => (
                      <div key={h.field} className="contents">
                        <dt className="text-muted">{fieldLabel(h.field)}</dt>
                        <dd className="break-all tabular-nums">{fieldValue(h.field, h.value)}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </div>
            </section>

            <section aria-labelledby={`${uid}-deltas`}>
              <h2 id={`${uid}-deltas`} className="text-lg font-semibold">Deltas from the baseline (terrain-aware)</h2>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
                  <caption className="sr-only">Baseline and shifted results for each site and target</caption>
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className="py-2 pr-3">Site and target</th>
                      <th scope="col" className="py-2 pr-3">Baseline</th>
                      <th scope="col" className="py-2 pr-3">Shifted</th>
                      <th scope="col" className="py-2 pr-3">Availability change</th>
                      <th scope="col" className="py-2 pr-3">Longest known hidden</th>
                      <th scope="col" className="py-2 pr-3">Events</th>
                      <th scope="col" className="py-2 pr-3">Changed spans</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cmp.sites.flatMap((s) =>
                      TARGETS.map((t) => {
                        const d = s.targets[t];
                        return (
                          <tr key={`${s.site_id}-${t}`} className="border-b border-border align-top">
                            <th scope="row" className="py-2 pr-3 text-left font-medium">
                              {siteLabel(s.site_id)}, {targetLabel(t)}
                            </th>
                            <td className="py-2 pr-3">
                              <StatusChip p={OUTCOME[d.a.outcome]} />
                              <div className="mt-1 tabular-nums">{pctRange(d.a.availability_lower, d.a.availability_upper, 2)}</div>
                            </td>
                            <td className="py-2 pr-3">
                              <StatusChip p={OUTCOME[d.b.outcome]} />
                              <div className="mt-1 tabular-nums">{pctRange(d.b.availability_lower, d.b.availability_upper, 2)}</div>
                            </td>
                            <td className="py-2 pr-3 tabular-nums">
                              {pp(d.delta.availability_lower)}
                              {d.outcome_change && (
                                <div className="mt-1 font-medium">
                                  <span aria-hidden="true">⚑ </span>Outcome changes: {d.outcome_change.split(" to ").map((o) => OUTCOME[o as keyof typeof OUTCOME]?.label ?? o).join(" → ")}
                                </div>
                              )}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">
                              {duration(d.a.longest_known_hidden_s)} → {duration(d.b.longest_known_hidden_s)}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">
                              {d.event_count[0]} → {d.event_count[1]}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">{d.changed_intervals.length || "none"}</td>
                          </tr>
                        );
                      }),
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted">
                No date is ranked or scored; each requirement is judged on its own. The flat horizon is not shown here: the
                terrain-aware result decides.
              </p>
            </section>
          </div>
        </ResultStateFrame>
      )}

      {panels && results && (
        <section aria-labelledby={`${uid}-panels`} className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id={`${uid}-panels`} className="text-lg font-semibold">Each run on its own clock</h2>
            {results.a.sites.length > 1 && (
              <label className="text-sm">
                <span className="mr-2 font-medium">Site</span>
                <select value={siteId ?? ""} onChange={(e) => setSiteId(e.target.value)}
                  className="rounded border border-border bg-background px-2 py-1">
                  {results.a.sites.map((s) => <option key={s.site_id} value={s.site_id}>{siteLabel(s.site_id)}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {panels.map((p) => {
              const bands = bandsFor(p.site, p.title);
              const start = bands[0]?.intervals[0]?.start_utc;
              return (
                <article key={p.key} aria-label={`${p.title} run`} className="rounded-lg border border-border bg-surface p-4">
                  <h3 className="font-semibold">
                    {p.title} <span className="font-mono text-xs text-muted">{shortId(p.run.run_id)}</span>
                  </h3>
                  <p className="text-sm">Starts {start ? utc(start) : "—"}</p>
                  {p.site && (
                    <>
                      <p className="mt-1 text-sm">
                        Site status: <StatusChip p={SITE_STATUS[p.site.site_status]} />
                      </p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {TARGETS.map((t) => {
                          const c = p.site?.target_metrics[t]?.terrain?.countdown_at_start;
                          return c ? (
                            <li key={t}>
                              <span className="font-medium">{targetLabel(t)} at the start:</span> {c.text}
                              {typeof c.remaining_s === "number" && start ? ` in ${duration(c.remaining_s)} (${at(start, c.remaining_s)})` : ""}
                            </li>
                          ) : null;
                        })}
                      </ul>
                      <div className="mt-3">
                        <TimelineChart bands={bands} title={`${p.title} run, ${siteLabel(p.site.site_id)}, from ${start ? utc(start) : ""}`} />
                      </div>
                      <div className="mt-2 grid gap-2">
                        {bands.map((b) => <IntervalTable key={b.target} band={b} />)}
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
          <Legend />
          {cmp && siteId && <ChangedSpans cmp={cmp} siteId={siteId} />}
          {cmp && cmp.warnings.length > 0 && (
            <ul className="space-y-1 text-sm">
              {cmp.warnings.map((w) => (
                <li key={w}><code className="rounded bg-surface-2 px-1 text-xs">{w}</code> <span className="text-muted">{WARNING_TEXT[w] ?? ""}</span></li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function ChangedSpans({ cmp, siteId }: { cmp: RunComparisonResponse; siteId: string }) {
  const s = cmp.sites.find((x) => x.site_id === siteId);
  if (!s) return null;
  const a0 = cmp.runs.a.start_utc;
  // Spans are on the baseline's elapsed axis. Elapsed: the shifted run's own clock is its start plus the
  // same elapsed time. Calendar: both runs share one UTC, so the shifted clock equals the baseline's.
  const b0 = cmp.alignment === "calendar" ? a0 : cmp.runs.b.start_utc;
  const name = (c: string) => (c === "?" ? "Outside this run's window" : INTERVAL[c as keyof typeof INTERVAL].label);
  return (
    <div className="grid gap-2">
      {TARGETS.map((t) => {
        const spans = s.targets[t].changed_intervals;
        return (
          <details key={t} className="rounded border border-border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              {targetLabel(t)} at {siteLabel(siteId)}: {spans.length} span(s) where the state differs
            </summary>
            {spans.length > 0 && (
              <div className="overflow-x-auto px-3 pb-3">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className="py-1 pr-3">Baseline state</th>
                      <th scope="col" className="py-1 pr-3">Shifted state</th>
                      <th scope="col" className="py-1 pr-3">Baseline clock (UTC)</th>
                      <th scope="col" className="py-1 pr-3">Shifted clock (UTC)</th>
                      <th scope="col" className="py-1 pr-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spans.map((x) => (
                      <tr key={x.start_s} className="border-b border-border/50">
                        <td className="py-1 pr-3">{name(x.a)}</td>
                        <td className="py-1 pr-3">{name(x.b)}</td>
                        <td className="py-1 pr-3 tabular-nums">{at(a0, x.start_s)} to {at(a0, x.end_s)}</td>
                        <td className="py-1 pr-3 tabular-nums">{at(b0, x.start_s)} to {at(b0, x.end_s)}</td>
                        <td className="py-1 pr-3 tabular-nums">{duration(x.end_s - x.start_s)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
