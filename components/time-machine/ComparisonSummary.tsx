import { useId } from "react";
import type { RunComparisonResponse, Target } from "@/lib/api/types";
import { fieldLabel, fieldValue } from "@/lib/facts";
import { duration, siteLabel, targetLabel, utc } from "@/lib/format";
import { OUTCOME } from "@/lib/status";
import { Card } from "../ui/card";
import { Disclosure } from "../ui/disclosure";
import { signedDays } from "./format";

const TARGETS: Target[] = ["sun_center", "earth_center"];

const outcomeWords = (change: string) =>
  change.split(" to ").map((o) => OUTCOME[o as keyof typeof OUTCOME]?.label ?? o).join(" → ");

/** The sites and targets whose outcome the service says changed, in table order. Counted, never scored. */
export function outcomeChanges(cmp: RunComparisonResponse) {
  const all = cmp.sites.flatMap((s) =>
    TARGETS.map((t) => ({ site: s.site_id, target: t, change: s.targets[t].outcome_change })),
  );
  const changed = all.filter((x): x is typeof x & { change: string } => Boolean(x.change));
  return { total: all.length, changed };
}

/**
 * What this comparison is, in order of importance: how long the shift is and how the runs line up,
 * whether any outcome changed, then what was changed and what was held constant.
 */
export function ComparisonSummary({ cmp }: { cmp: RunComparisonResponse }) {
  const uid = useId();
  const { total, changed } = outcomeChanges(cmp);
  return (
    <section aria-labelledby={`${uid}-what`}>
      <h2 id={`${uid}-what`} className="type-section">
        Shifted by {signedDays(cmp.shift_s)}, compared in {cmp.alignment} time
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{cmp.note}.</p>
      {cmp.overlap && (
        <p className="mt-1 text-sm">
          Shared window: {utc(cmp.overlap.start_utc)} for {duration(cmp.overlap.duration_s)}.
        </p>
      )}
      {cmp.result_state === "mixed" && (
        <p className="mt-1 text-sm font-medium text-warn">The two runs carry different result states.</p>
      )}

      <div className="mt-3 rounded-md border border-border bg-muted p-3 text-sm" role="group" aria-label="Outcome changes">
        {changed.length === 0 ? (
          <p>No site or target changes outcome with this shift.</p>
        ) : (
          <>
            <p className="font-medium">
              {changed.length} of {total} site and target results change outcome
            </p>
            <ul className="mt-1 space-y-0.5">
              {changed.map((c) => (
                <li key={`${c.site}-${c.target}`}>
                  <span aria-hidden="true">⚑ </span>
                  {siteLabel(c.site)}, {targetLabel(c.target)}: {outcomeWords(c.change)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <Card className="block gap-0 rounded-lg p-3 text-sm">
          <h3 className="font-semibold">Changed</h3>
          <ul className="mt-1 space-y-1">
            {cmp.changed.map((c) => (
              <li key={c.field}>
                {fieldLabel(c.field)}: {fieldValue(c.field, c.from)} → <strong>{fieldValue(c.field, c.to)}</strong>
              </li>
            ))}
          </ul>
        </Card>
        <Disclosure summary={`Held constant (${cmp.held_constant.length} inputs)`} className="text-sm">
          <dl className="kv">
            {cmp.held_constant.map((h) => (
              <div key={h.field} className="contents">
                <dt className="text-muted-foreground">{fieldLabel(h.field)}</dt>
                <dd className="readout break-all">{fieldValue(h.field, h.value)}</dd>
              </div>
            ))}
          </dl>
        </Disclosure>
      </div>
    </section>
  );
}
