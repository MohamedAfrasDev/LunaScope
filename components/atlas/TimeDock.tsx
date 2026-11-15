"use client";

import { Play } from "lucide-react";
import { DataStatusPill } from "@/components/DataStatusBanner";
import { CREDIT_TEXT } from "@/lib/explore/geometry";

const SPEEDS = ["1 min", "10 min", "1 hour", "6 hours", "1 day"];

/**
 * The time dock (spec 4). In phase A it is the real layout with every clock control switched off, and it says why: nothing
 * here moves until a run's service-computed series drives it (phase D). Nothing looks live that is not.
 */
export function TimeDock() {
  return (
    <section aria-label="Time dock" className="atlas-panel px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          disabled
          aria-label="Play (not available yet: no run is loaded)"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[var(--void)] disabled:opacity-40"
        >
          <Play aria-hidden="true" className="size-4 fill-current" />
        </button>
        <p role="status" className="atlas-label text-[var(--ink-dim)]">
          No run loaded <span aria-hidden="true">·</span> the clock arrives with run data
        </p>
        <div role="group" aria-label="Speed (not available yet)" className="flex flex-wrap items-center gap-0.5">
          {SPEEDS.map((s) => (
            <button key={s} type="button" disabled className="atlas-key atlas-label">
              {s}
            </button>
          ))}
        </div>
        <input
          type="range"
          disabled
          aria-label="Time (not available yet)"
          className="min-w-24 flex-1 accent-[var(--select)]"
          min={0}
          max={100}
          defaultValue={0}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--panel-edge)] pt-2">
        <DataStatusPill />
        <p className="atlas-prose min-w-0 flex-1 text-xs text-[var(--ink-dim)]">{CREDIT_TEXT}</p>
      </div>
    </section>
  );
}
