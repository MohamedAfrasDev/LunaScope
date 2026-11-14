import Link from "next/link";
import type { SensitivityVariant } from "@/lib/api/types";
import { duration, targetLabel } from "@/lib/format";
import { OUTCOME } from "@/lib/status";

const NAMES: Record<string, { label: string; what: string }> = {
  azimuth_step_halved: {
    label: "Half the azimuth step",
    what: "The skyline is recomputed with twice as many directions, to see whether a ridge fell between two of them.",
  },
  alternate_dem_release: {
    label: "The other DEM release",
    what: "The skyline is recomputed from the other pinned elevation release. This measures how much the choice of release matters, not which release is right.",
  },
};

const pp = (x: number) => (Math.abs(x) < 0.0005 ? "no change" : `${x > 0 ? "+" : "−"}${(Math.abs(x) * 100).toFixed(1)} percentage points`);

/**
 * Sensitivity (FR-12): the same site re-run with one setting changed, and the differences quantified.
 * Every number and the high-sensitivity flag come from the service; nothing is decided here. A variant
 * that moved beyond the service's tolerance is flagged and shown in words as well as colour.
 */
export function SensitivityPanel({ variants }: { variants: SensitivityVariant[] }) {
  if (variants.length === 0)
    return (
      <section aria-label="Sensitivity" className="rounded border border-border p-3 text-sm">
        <h2 className="text-base font-semibold">Sensitivity</h2>
        <p className="mt-1 text-muted">
          No sensitivity check was run for this analysis. Start one from{" "}
          <Link href="/analyze" className="text-accent underline underline-offset-4">New analysis</Link> with the
          sensitivity option on: it re-runs the site with a finer azimuth step and with the other DEM release, and
          reports how much the result moves.
        </p>
      </section>
    );
  return (
    <section aria-label="Sensitivity" className="grid gap-3 rounded border border-border p-3 text-sm">
      <h2 className="text-base font-semibold">Sensitivity</h2>
      {variants.map((v) => {
        const meta = NAMES[v.variant] ?? { label: v.variant, what: "" };
        return (
          <div key={v.variant} className="rounded border border-border/60 p-2">
            <h3 className="flex flex-wrap items-center gap-2 font-medium">
              {meta.label}
              {v.sensitivity_high ? (
                <span className="rounded-full border border-fail/40 bg-fail-soft px-2.5 py-0.5 text-fail">
                  <span aria-hidden="true">✗ </span>Result changes beyond tolerance
                </span>
              ) : (
                <span className="rounded-full border border-ok/40 bg-ok-soft px-2.5 py-0.5 text-ok">
                  <span aria-hidden="true">✓ </span>Within tolerance
                </span>
              )}
            </h3>
            {meta.what && <p className="mt-1 text-muted">{meta.what}</p>}
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left">
                <caption className="sr-only">{meta.label}: differences from the base run</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-1 pr-3">Target</th>
                    <th scope="col" className="py-1 pr-3">Availability (lower bound)</th>
                    <th scope="col" className="py-1 pr-3">Outcome</th>
                    <th scope="col" className="py-1 pr-3">Events</th>
                    <th scope="col" className="py-1 pr-3">Largest event shift</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(v.targets).map(([t, d]) => (
                    <tr key={t} className="border-b border-border/50 align-top">
                      <th scope="row" className="py-1 pr-3 font-medium">{targetLabel(t)}</th>
                      <td className="py-1 pr-3 tabular-nums">{pp(d.delta_lower)}</td>
                      <td className="py-1 pr-3">
                        {d.outcome_changed
                          ? <strong>{OUTCOME[d.outcome_base].label} → {OUTCOME[d.outcome_variant].label}</strong>
                          : <>{OUTCOME[d.outcome_base].label}, unchanged</>}
                      </td>
                      <td className="py-1 pr-3 tabular-nums">
                        {d.event_count_base === d.event_count_variant ? `${d.event_count_base}, unchanged` : <strong>{d.event_count_base} → {d.event_count_variant}</strong>}
                      </td>
                      <td className="py-1 pr-3 tabular-nums">{duration(d.max_event_shift_s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-muted">
              Flagged if an outcome changes, the number of events changes, or availability moves by more than{" "}
              {(v.tolerance_availability * 100).toFixed(0)} percentage point.
            </p>
          </div>
        );
      })}
    </section>
  );
}
