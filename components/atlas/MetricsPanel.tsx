"use client";

import { Panel } from "@/components/atlas/Panel";
import { Tag } from "@/components/atlas/Tag";
import { StatusChip } from "@/components/StatusChip";
import { AvailabilityBar } from "@/components/TimelineChart";
import type { Target } from "@/lib/api/types";
import type { CursorReading, Track } from "@/lib/atlas/run";
import { metricsView, TARGET_SUBJECT, TARGET_WORDS } from "@/lib/atlas/views";
import { degrees } from "@/lib/format";
import { INTERVAL } from "@/lib/status";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-x-3 py-1">
      <dt className="atlas-label pt-0.5 text-[var(--ink-dim)]">{label}</dt>
      <dd className="atlas-number min-w-0 break-words text-sm text-[var(--ink)]">{children}</dd>
    </div>
  );
}

/**
 * Metrics (spec 6.5): for the selected site, each target's outcome, its availability as a range against the requirement, the
 * flat-horizon comparison, the longest outage and the best clearance, and where the target is at the clock time. Every figure
 * is the service's and is worded by the same formatters as the Timeline page.
 */
export function MetricsPanel({
  siteLabel,
  tracks,
  cursor,
  timeLabel,
  onClose,
}: {
  siteLabel: string;
  tracks: Partial<Record<Target, Track>>;
  cursor: CursorReading[] | null;
  timeLabel: string;
  onClose: () => void;
}) {
  const targets = (Object.keys(tracks) as Target[]).filter((k) => !!tracks[k]);
  return (
    <Panel title="Metrics" tag="derived" onClose={onClose} focused className="max-h-full" bodyClassName="space-y-4">
      <p className="atlas-label text-[var(--ink-dim)]">{siteLabel}</p>
      {targets.map((k) => {
        const v = metricsView(k, tracks[k]!);
        const at = cursor?.find((r) => r.target === k);
        const sun = k === "sun_center";
        return (
          <section key={k} aria-label={`${TARGET_WORDS[k]} metrics`} className="border border-[var(--panel-edge)] p-3" style={{ borderLeft: `3px solid ${sun ? "var(--sun)" : "var(--earth)"}` }}>
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--ink)]" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
              <span aria-hidden="true" className={sun ? "text-[var(--sun)]" : "text-[var(--earth)]"}>
                {sun ? "●" : "◆"}
              </span>
              {TARGET_SUBJECT[k]}
              <StatusChip p={v.outcome} title={v.outcome.help} />
            </h3>

            <p className="mt-2">
              <span className="atlas-number text-2xl text-[var(--ink)]" data-testid={`availability-${k}`}>
                {v.availability}
              </span>{" "}
              <span className="atlas-prose text-xs text-[var(--ink-dim)]">
                of the window, {v.needs} <Tag kind="assumption" />
              </span>
            </p>
            <div className="mt-2">
              <AvailabilityBar lower={v.lower} upper={v.upper} threshold={v.threshold} label={`${TARGET_WORDS[k]}, terrain-aware`} />
            </div>

            <dl className="mt-2 divide-y divide-[var(--panel-edge)]">
              {v.flatAvailability && <Row label="Flat horizon">{v.flatAvailability}</Row>}
              <Row label="Longest hidden">{v.longestHidden}</Row>
              <Row label="Total hidden">{v.totalHidden}</Row>
              <Row label="Best clearance">{v.bestClearance}</Row>
              <Row label="At the start">
                <span className="atlas-prose">{v.atStart}</span>
              </Row>
              {at && (
                <Row label="At the cursor">
                  AZ {at.azDeg.toFixed(1)}° · EL {degrees(at.elDeg)}
                  <span className="atlas-prose block text-xs text-[var(--ink-dim)]">
                    {at.state ? INTERVAL[at.state].label : "No classified state"} · {timeLabel}
                  </span>
                </Row>
              )}
            </dl>
            {v.exclusion && <p className="atlas-prose mt-2 text-xs text-[var(--ink-dim)]">{v.exclusion}</p>}
          </section>
        );
      })}
      <p className="atlas-prose text-xs text-[var(--ink-dim)]">
        Sunlight and Earth visibility are judged separately and are never combined into a score. Availability is a range: the lower
        bound is certified time, the upper bound adds time still inside the decision band.
      </p>
    </Panel>
  );
}
