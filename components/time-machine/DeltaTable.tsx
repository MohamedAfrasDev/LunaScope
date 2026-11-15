import type { RunComparisonResponse, Target } from "@/lib/api/types";
import { duration, pctRange, siteLabel, targetLabel } from "@/lib/format";
import { OUTCOME } from "@/lib/status";
import { StatusChip } from "../StatusChip";
import { Disclosure } from "../ui/Disclosure";
import { pp } from "./format";

const TARGETS: Target[] = ["sun_center", "earth_center"];

/** The full numbers behind the summary above it: one row per site and target, terrain-aware only. */
export function DeltaTable({ cmp }: { cmp: RunComparisonResponse }) {
  return (
    <Disclosure summary="Deltas from the baseline (terrain-aware): the full table">
      <div className="overflow-x-auto">
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
                      <div className="readout mt-1">{pctRange(d.a.availability_lower, d.a.availability_upper, 2)}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <StatusChip p={OUTCOME[d.b.outcome]} />
                      <div className="readout mt-1">{pctRange(d.b.availability_lower, d.b.availability_upper, 2)}</div>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {pp(d.delta.availability_lower)}
                      {d.outcome_change && (
                        <div className="mt-1 font-medium">
                          <span aria-hidden="true">⚑ </span>Outcome changes:{" "}
                          {d.outcome_change.split(" to ").map((o) => OUTCOME[o as keyof typeof OUTCOME]?.label ?? o).join(" → ")}
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
      <p className="mt-2 text-xs text-muted-foreground">
        No date is ranked or scored; each requirement is judged on its own. The flat horizon is not shown here: the
        terrain-aware result decides.
      </p>
    </Disclosure>
  );
}
