import type { SearchStrip, StripDate } from "@/lib/api/types";
import { pct, siteLabel, utc } from "@/lib/format";
import type { Presentation } from "@/lib/status";
import { StatusChip } from "../StatusChip";
import { Disclosure } from "../ui/disclosure";
import { Button } from "../ui/button";

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
 * The result of a date search: one tile per tested date, the same data as a table, and the objective
 * stated in words. A date still waiting or failed is never shown as a pass or a fail.
 */
export function DateStrip({ strip, onOpenDate }: { strip: SearchStrip; onOpenDate: (offsetDays: number, runId: string) => void }) {
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
              <div className="flex min-w-[6.5rem] flex-col items-start gap-1 rounded-md border border-border p-2 text-xs">
                <span className="readout font-medium">{dayLabel(d)}</span>
                <StatusChip p={p} title={p.help} />
                <span className="readout text-muted-foreground">{utc(d.start_utc).slice(5, 10)}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <Disclosure summary="View the tested dates as a table">
        <div className="overflow-x-auto">
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
                          {c ? <>{c.site_status.replace("_", ": ").toLowerCase()}<span className="block text-xs text-muted-foreground">margin {c.objective_margin >= 0 ? "+" : "−"}{pct(Math.abs(c.objective_margin))}</span></> : "—"}
                        </td>
                      );
                    })}
                    <td className="py-1 pr-3">
                      {d.run_id && d.state !== "baseline" && (d.verdict !== null) && (
                        <Button type="button" variant="link" size="sm" onClick={() => onOpenDate(d.offset_days, d.run_id as string)} className="h-6 px-0 underline">
                          Compare
                        </Button>
                      )}
                      {d.state === "baseline" && <span className="text-muted-foreground">baseline</span>}
                      {d.state === "failed" && d.error && <span className="text-xs text-fail">{d.error.code}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Disclosure>
      <div className="text-xs text-muted-foreground">
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
