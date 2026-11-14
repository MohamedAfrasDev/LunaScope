"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { describeError, getJson, postJson } from "@/lib/api/client";
import type { SearchAdmission, SearchStrip, StripDate } from "@/lib/api/types";
import { pct, siteLabel, utc } from "@/lib/format";
import type { Presentation } from "@/lib/status";
import { StatusChip } from "./StatusChip";

const MAX_DATES = 15;

const VERDICT: Record<"pass" | "fail" | "unknown", Presentation> = {
  pass: { label: "Passes", icon: "✓", tone: "ok", help: "At least one site passes both requirements on this date." },
  fail: { label: "Fails", icon: "✗", tone: "fail", help: "No site passes on this date." },
  unknown: { label: "Unknown", icon: "?", tone: "warn", help: "No site passes and at least one cannot be decided." },
};
const PENDING: Presentation = { label: "Not run yet", icon: "…", tone: "muted", help: "Waiting for its turn; not counted as a pass or a fail." };
const QUEUED: Presentation = { label: "Queued", icon: "…", tone: "muted", help: "Admitted and waiting for a worker; not counted yet." };
const RUNNING: Presentation = { label: "Running", icon: "…", tone: "info", help: "Being computed; not counted yet." };
const BROKEN: Presentation = { label: "Run failed", icon: "!", tone: "fail", help: "The run did not complete; not counted as a pass or a fail." };

function present(d: StripDate): Presentation {
  if (d.verdict) return VERDICT[d.verdict];
  if (d.state === "failed") return BROKEN;
  return d.state === "pending" ? PENDING : d.state === "queued" ? QUEUED : RUNNING;
}

function dayLabel(d: StripDate): string {
  return d.offset_days === 0 ? "baseline" : `${d.offset_days > 0 ? "+" : "−"}${Math.abs(d.offset_days)} d`;
}

/**
 * Alternatives search (FR-11): which dates pass? The dates are tested as ordinary runs in bounded
 * batches; the strip shows every date, and a date still waiting or failed is never a pass or a fail.
 * The objective is stated, and it is not a score: it only names, per site, the passing date with
 * the largest margin.
 */
export function AlternativesStrip({ runId, onOpenDate }: { runId: string; onOpenDate: (offsetDays: number, runId: string) => void }) {
  const uid = useId();
  const [from, setFrom] = useState("-7");
  const [to, setTo] = useState("7");
  const [step, setStep] = useState("1");
  const [strip, setStrip] = useState<SearchStrip | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nums = [from, to, step].map((v) => (v.trim() === "" ? NaN : Number(v)));
  const [f, t, st] = nums;
  const count = Number.isInteger(f) && Number.isInteger(t) && Number.isInteger(st) && st >= 1 && f <= t
    ? Math.floor((t - f) / st) + 1 : 0;
  const formErr = nums.some((x) => !Number.isInteger(x)) ? "Enter whole numbers of days."
    : Math.abs(f) > 30 || Math.abs(t) > 30 ? "Dates are limited to 30 days either way."
    : st < 1 ? "The step must be at least 1 day."
    : f > t ? "The first date must not be after the last."
    : count > MAX_DATES ? `That is ${count} dates; at most ${MAX_DATES}. Widen the step or narrow the range.`
    : f === t && f === 0 ? "That range holds only the baseline."
    : null;

  // keep an unfinished search's strip fresh; stop when it completes
  const poll = useCallback((url: string, signal: AbortSignal) => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const s = await getJson<SearchStrip>(url.replace(/^\/api\/v1\//, ""), signal);
        if (s.parent_run_id !== runId) return; // result binding
        setStrip(s);
        if (s.complete) return;
      } catch (e) {
        if (e instanceof DOMException) return;
      }
      timer = setTimeout(tick, 2000);
    };
    tick();
    return () => clearTimeout(timer);
  }, [runId]);

  const [watch, setWatch] = useState<string | null>(null);
  useEffect(() => {
    if (!watch) return;
    const ctl = new AbortController();
    const stop = poll(watch, ctl.signal);
    return () => { ctl.abort(); stop(); };
  }, [watch, poll]);

  // show the latest search already made for this baseline, if any
  useEffect(() => {
    const ctl = new AbortController();
    getJson<{ run_id: string; searches: SearchStrip[] }>(`analyses/${runId}/searches`, ctl.signal)
      .then((r) => {
        const last = r.searches.at(-1);
        if (r.run_id === runId && last) { setStrip(last); if (!last.complete) setWatch(`/api/v1/analyses/${runId}/searches/${last.search_id}`); }
      })
      .catch(() => undefined);
    return () => ctl.abort();
  }, [runId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (formErr) return;
    setBusy(true);
    setErr(null);
    try {
      const a = await postJson<SearchAdmission>(`analyses/${runId}/variants`, {
        variant_type: "alternatives_search", changes: { from_days: f, to_days: t, step_days: st },
      });
      if (a.parent_run_id !== runId) return;
      setStrip(null);
      setWatch(a.status_url);
    } catch (e2) {
      setErr(describeError(e2));
    } finally {
      setBusy(false);
    }
  }

  const input = "mt-1 w-24 rounded border border-border bg-background px-2 py-1.5 tabular-nums";
  return (
    <section aria-labelledby={`${uid}-h`} className="rounded-lg border border-border bg-surface p-4">
      <h2 id={`${uid}-h`} className="text-lg font-semibold">Which dates pass?</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Test a range of start dates against the same sites, requirements and terrain. Each date is a separate run
        computed a couple at a time, so a wide range takes a while.
      </p>
      <form onSubmit={submit} noValidate className="mt-3 flex flex-wrap items-end gap-4">
        {([["From (days)", from, setFrom], ["To (days)", to, setTo], ["Step (days)", step, setStep]] as const).map(([label, val, set]) => (
          <label key={label} className="text-sm font-medium">
            {label}
            <input className={input} inputMode="numeric" value={val} onChange={(e) => set(e.target.value)}
              aria-invalid={formErr ? true : undefined} aria-describedby={formErr ? `${uid}-err` : undefined} />
          </label>
        ))}
        <button type="submit" disabled={busy || !!formErr} className="rounded bg-accent px-4 py-2 font-medium text-background disabled:opacity-50">
          {busy ? "Starting…" : count > 0 ? `Test ${count} date${count === 1 ? "" : "s"}` : "Test dates"}
        </button>
      </form>
      {formErr && <p id={`${uid}-err`} className="mt-2 text-sm font-medium text-fail"><span aria-hidden="true">✗ </span>{formErr}</p>}
      {err && <p role="alert" className="mt-2 text-sm text-fail">{err}</p>}
      {strip && <Strip strip={strip} onOpenDate={onOpenDate} />}
    </section>
  );
}

function Strip({ strip, onOpenDate }: { strip: SearchStrip; onOpenDate: (offsetDays: number, runId: string) => void }) {
  const n = strip.counts;
  const siteIds = Array.from(new Set(strip.dates.flatMap((d) => d.sites.map((s) => s.site_id))));
  return (
    <div className="mt-4 grid gap-3" aria-live="polite">
      <p className="text-sm">
        <strong>{n.tested} of {n.planned}</strong> dates tested:{" "}
        {n.passing} pass, {n.failing} fail, {n.unknown} unknown
        {n.pending > 0 && <>, {n.pending} not finished yet</>}
        {n.failed_runs > 0 && <>, {n.failed_runs} run(s) failed</>}.
        {!strip.complete && " Updating…"}
      </p>
      <ol aria-label="Tested dates" className="flex flex-wrap gap-2">
        {strip.dates.map((d) => {
          const p = present(d);
          return (
            <li key={d.offset_s}>
              <div className="flex min-w-[6.5rem] flex-col items-start gap-1 rounded border border-border p-2 text-xs">
                <span className="font-medium tabular-nums">{dayLabel(d)}</span>
                <StatusChip p={p} title={p.help} />
                <span className="text-muted tabular-nums">{utc(d.start_utc).slice(5, 10)}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <details className="rounded border border-border">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">View the tested dates as a table</summary>
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Each tested start date and the result for every site</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-1 pr-3">Date</th>
                <th scope="col" className="py-1 pr-3">Starts (UTC)</th>
                <th scope="col" className="py-1 pr-3">Result</th>
                {siteIds.map((s) => <th key={s} scope="col" className="py-1 pr-3">{siteLabel(s)}</th>)}
                <th scope="col" className="py-1 pr-3"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {strip.dates.map((d) => {
                const p = present(d);
                return (
                  <tr key={d.offset_s} className="border-b border-border/50 align-top">
                    <th scope="row" className="py-1 pr-3 font-medium">{dayLabel(d)}</th>
                    <td className="py-1 pr-3 tabular-nums">{utc(d.start_utc)}</td>
                    <td className="py-1 pr-3"><StatusChip p={p} /></td>
                    {siteIds.map((id) => {
                      const c = d.sites.find((x) => x.site_id === id);
                      return (
                        <td key={id} className="py-1 pr-3 tabular-nums">
                          {c ? <>{c.site_status.replace("_", ": ").toLowerCase()}<span className="block text-xs text-muted">margin {c.objective_margin >= 0 ? "+" : "−"}{pct(Math.abs(c.objective_margin))}</span></> : "—"}
                        </td>
                      );
                    })}
                    <td className="py-1 pr-3">
                      {d.run_id && d.state !== "baseline" && (d.verdict !== null) && (
                        <button type="button" onClick={() => onOpenDate(d.offset_days, d.run_id as string)} className="text-accent underline underline-offset-4">
                          Compare
                        </button>
                      )}
                      {d.state === "baseline" && <span className="text-muted">baseline</span>}
                      {d.state === "failed" && d.error && <span className="text-xs text-fail">{d.error.code}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
      <div className="text-xs text-muted">
        <p><span className="font-medium">Objective, stated:</span> {strip.objective}</p>
        {Object.entries(strip.largest_margin_among_passing).map(([site, off]) => (
          <p key={site}>
            {siteLabel(site)}: {off === null ? "no passing date, so no date is named" : `largest margin among passing dates is ${off === 0 ? "the baseline" : `${off > 0 ? "+" : "−"}${Math.abs(off) / 86400} d`}`}.
          </p>
        ))}
        <p>{strip.note}</p>
      </div>
    </div>
  );
}
