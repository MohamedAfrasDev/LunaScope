"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { describeError, getJson, postJson } from "@/lib/api/client";
import type { SearchAdmission, SearchStrip } from "@/lib/api/types";
import { DateStrip } from "./time-machine/DateStrip";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const MAX_DATES = 15;

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

  return (
    <section aria-labelledby={`${uid}-h`} className="surface-card p-4">
      <p className="eyebrow mb-1">Step 2 of 3</p>
      <h2 id={`${uid}-h`} className="type-section">Which dates pass?</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Test a range of start dates against the same sites, requirements and terrain. Each date is a separate run
        computed a couple at a time, so a wide range takes a while.
      </p>
      <form onSubmit={submit} noValidate className="mt-3 flex flex-wrap items-end gap-4">
        {([["From (days)", from, setFrom], ["To (days)", to, setTo], ["Step (days)", step, setStep]] as const).map(([label, val, set]) => (
          <label key={label} className="text-sm font-medium">
            {label}
            <Input className="mt-1 w-24 tabular-nums" inputMode="numeric" value={val} onChange={(e) => set(e.target.value)}
              aria-invalid={formErr ? true : undefined} aria-describedby={formErr ? `${uid}-err` : undefined} />
          </label>
        ))}
        <Button type="submit" disabled={busy || !!formErr}>
          {busy ? "Starting…" : count > 0 ? `Test ${count} date${count === 1 ? "" : "s"}` : "Test dates"}
        </Button>
      </form>
      {formErr && <p id={`${uid}-err`} className="mt-2 text-sm font-medium text-fail"><span aria-hidden="true">✗ </span>{formErr}</p>}
      {err && <p role="alert" className="mt-2 text-sm text-fail">{err}</p>}
      {strip && <DateStrip strip={strip} onOpenDate={onOpenDate} />}
    </section>
  );
}
