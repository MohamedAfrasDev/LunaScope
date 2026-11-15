import type { RunComparisonResponse, Target } from "@/lib/api/types";
import { duration, siteLabel, targetLabel } from "@/lib/format";
import { INTERVAL } from "@/lib/status";
import { at } from "./format";
import { Disclosure } from "../ui/disclosure";

const TARGETS: Target[] = ["sun_center", "earth_center"];

/** The time spans where the baseline and the shifted run differ, for one site and each target. */
export function ChangedSpans({ cmp, siteId }: { cmp: RunComparisonResponse; siteId: string }) {
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
          <Disclosure
            key={t}
            summary={
              <>
                {targetLabel(t)} at {siteLabel(siteId)}: {spans.length} span(s) where the state differs
              </>
            }
          >
            {spans.length > 0 && (
              <div className="overflow-x-auto">
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
          </Disclosure>
        );
      })}
    </div>
  );
}
