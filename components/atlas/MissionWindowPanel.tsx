"use client";

import { Panel } from "@/components/atlas/Panel";
import type { RunWindow } from "@/lib/atlas/clock";
import type { CursorReading, Track } from "@/lib/atlas/run";
import { missionDay, timeLeft } from "@/lib/atlas/sky";
import { metricsView, TARGET_SUBJECT } from "@/lib/atlas/views";
import type { Target } from "@/lib/api/types";
import { INTERVAL } from "@/lib/status";

/**
 * Mission window (spec 6.8): where the clock is in the window, and for each target the service's state at this moment and its
 * availability over the whole window. The window length and the requirements are scenario values of the run, not mission rules.
 */
export function MissionWindowPanel({
  window: win,
  t,
  tracks,
  readings,
  onClose,
}: {
  window: RunWindow;
  t: number;
  tracks: Partial<Record<Target, Track>>;
  readings: CursorReading[] | null;
  onClose: () => void;
}) {
  const { day, days } = missionDay(t, win.totalS);
  const targets = (Object.keys(tracks) as Target[]).filter((k) => !!tracks[k]);
  return (
    <Panel title="Mission window" tag="derived" onClose={onClose} className="max-h-full" bodyClassName="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="atlas-number text-lg text-[var(--ink)]" data-testid="mission-day">
          Day {day} of {days}
        </span>
        <span className="atlas-number text-sm text-[var(--ink-dim)]">{timeLeft(t, win.totalS)}</span>
      </div>
      <div className="h-1 w-full bg-[var(--panel-raised)]" role="presentation">
        <div className="h-full bg-[var(--select)]" style={{ width: `${win.totalS > 0 ? Math.min(100, (t / win.totalS) * 100) : 0}%` }} />
      </div>
      <dl className="divide-y divide-[var(--panel-edge)] border-y border-[var(--panel-edge)]">
        {targets.map((k) => {
          const r = readings?.find((x) => x.target === k);
          const v = metricsView(k, tracks[k]!);
          return (
            <div key={k} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 py-1.5">
              <dt className="atlas-prose text-sm text-[var(--ink)]">
                <span aria-hidden="true" className={k === "sun_center" ? "text-[var(--sun)]" : "text-[var(--earth)]"}>
                  {k === "sun_center" ? "● " : "◆ "}
                </span>
                {TARGET_SUBJECT[k]}
              </dt>
              <dd className="atlas-prose text-right text-sm text-[var(--ink)]">{r?.state ? INTERVAL[r.state].label : "—"}</dd>
              <dd className="atlas-number col-span-2 text-xs text-[var(--ink-dim)]">
                Whole window: {v.availability} ({v.needs}) · {v.outcome.icon} {v.outcome.label}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="atlas-prose text-xs text-[var(--ink-dim)]">
        States are the service&apos;s classification at the clock time (terrain-aware). Sunlight and Earth visibility are judged separately.
      </p>
    </Panel>
  );
}
