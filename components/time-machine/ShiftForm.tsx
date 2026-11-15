"use client";

import { useId, useState } from "react";
import { describeError, postJson } from "@/lib/api/client";
import type { VariantAdmission } from "@/lib/api/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export const MAX_DAYS = 30;

/**
 * Step 1: shift the start by a whole number of days. Validation happens here, before anything is
 * sent; the service decides everything else. A reply for a different baseline is dropped.
 */
export function ShiftForm({ runId, onShifted }: { runId: string; onShifted: (childRunId: string) => void }) {
  const uid = useId();
  const [days, setDays] = useState("5");
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

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
      onShifted(v.run_id);
    } catch (err) {
      setFormErr(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="surface-card grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:items-end">
      <div>
        <p className="eyebrow mb-1">Step 1 of 3</p>
        <Label htmlFor={`${uid}-days`} className="font-semibold">
          Shift the start by (days)
        </Label>
        <Input
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
          className="mt-1 w-32 tabular-nums"
        />
        <p id={`${uid}-days-help`} className="mt-1 text-xs text-muted-foreground">
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
        <Button type="submit" disabled={submitting || !!daysErr}>
          {submitting ? "Starting…" : "Shift and recompute"}
        </Button>
        {formErr && (
          <p role="alert" className="text-sm text-fail">
            {formErr}
          </p>
        )}
      </div>
    </form>
  );
}
