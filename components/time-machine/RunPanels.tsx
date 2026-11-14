import { useId } from "react";
import type { ResultsResponse, RunComparisonResponse, SiteResults, Target } from "@/lib/api/types";
import { duration, pctRange, shortId, siteLabel, targetLabel, utc } from "@/lib/format";
import { OUTCOME, SITE_STATUS, WARNING_TEXT } from "@/lib/status";
import { StatusChip } from "../StatusChip";
import { IntervalTable, Legend, TimelineChart, type Band } from "../TimelineChart";
import { SunEarthKey } from "../ui/SunEarthKey";
import { WarningItem } from "../ui/WarningItem";
import { ChangedSpans } from "./ChangedSpans";
import { at } from "./format";

const TARGETS: Target[] = ["sun_center", "earth_center"];

export interface Panel {
  key: "a" | "b";
  title: string;
  run: ResultsResponse;
  site: SiteResults | undefined;
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

/**
 * Each run on its own clock: the baseline and the shifted run side by side for one site, with their
 * own UTC start, countdowns and timeline. The panels stay visible; only the interval tables fold.
 */
export function RunPanels({
  panels,
  sites,
  siteId,
  onSite,
  cmp,
}: {
  panels: Panel[];
  sites: SiteResults[];
  siteId: string;
  onSite: (id: string) => void;
  cmp: RunComparisonResponse | null;
}) {
  const uid = useId();
  return (
    <section aria-labelledby={`${uid}-panels`} className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={`${uid}-panels`} className="type-section">Each run on its own clock</h2>
        {sites.length > 1 && (
          <label className="text-sm">
            <span className="mr-2 font-medium">Site</span>
            <select value={siteId} onChange={(e) => onSite(e.target.value)}
              className="rounded-md border border-border-strong bg-background px-2 py-1">
              {sites.map((s) => <option key={s.site_id} value={s.site_id}>{siteLabel(s.site_id)}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {panels.map((p) => {
          const bands = bandsFor(p.site, p.title);
          const start = bands[0]?.intervals[0]?.start_utc;
          return (
            <article key={p.key} aria-label={`${p.title} run`} className="surface-card p-4">
              <h3 className="font-semibold">
                {p.title} <span className="readout text-xs text-muted">{shortId(p.run.run_id)}</span>
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
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Legend />
        <SunEarthKey />
      </div>
      {cmp && <ChangedSpans cmp={cmp} siteId={siteId} />}
      {cmp && cmp.warnings.length > 0 && (
        <ul className="space-y-1 text-sm">
          {cmp.warnings.map((w) => (
            <WarningItem key={w} code={w} text={WARNING_TEXT[w]} />
          ))}
        </ul>
      )}
    </section>
  );
}
