"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/atlas/Panel";
import type { HorizonLoad } from "@/components/atlas/useHorizon";
import { PolarSky, SkyLegend, UnrolledSky, type Track as SkyTrack } from "@/components/SkyPlots";
import type { Target } from "@/lib/api/types";
import type { Track } from "@/lib/atlas/run";
import { TARGET_WORDS } from "@/lib/atlas/views";
import { degrees } from "@/lib/format";
import { elevationBand, interpAzEl } from "@/lib/sky";

const TARGETS: Target[] = ["sun_center", "earth_center"];

/**
 * Sky path (spec 6.7): the Sun and Earth tracks over the terrain skyline as seen from the selected site, with a marker at the
 * clock time. It reuses the Local sky plots of the run pages, so the drawing and its numbers are the same as there: positions are
 * the service's series, the skyline is the service's, and the line style of each stretch is the service's classified state.
 */
export function SkyPathPanel({
  siteLabel,
  tracks,
  t,
  horizon,
  onClose,
}: {
  siteLabel: string;
  tracks: Partial<Record<Target, Track>>;
  t: number;
  horizon: HorizonLoad;
  onClose: () => void;
}) {
  const [view, setView] = useState<"unrolled" | "polar">("unrolled");

  const sky: SkyTrack[] = useMemo(
    () =>
      TARGETS.flatMap((target) => {
        const tr = tracks[target];
        return tr ? [{ target, series: tr.series, intervals: tr.intervals, cursor: interpAzEl(tr.series, t) }] : [];
      }),
    [tracks, t],
  );

  const profile = horizon.status === "ready" ? horizon.profile : null;
  const band = useMemo(() => (profile ? elevationBand(profile.horizon_el_deg, sky.map((s) => s.series.el_deg)) : { min: -5, max: 10 }), [profile, sky]);

  const where = sky.map((s) => `${TARGET_WORDS[s.target]} at azimuth ${s.cursor.az.toFixed(1)}°, elevation ${degrees(s.cursor.el)}`).join("; ");
  const title = `Sun and Earth over the terrain skyline at ${siteLabel}`;
  const desc = `The hatched ground is the terrain skyline from the elevation data and the dashed line is a flat 0 degree horizon. Now: ${where}.`;

  return (
    <Panel title="Sky path" tag="derived" onClose={onClose} focused className="max-h-full" bodyClassName="space-y-3">
      <p className="atlas-label text-[var(--ink-dim)]">{siteLabel}</p>
      {horizon.status === "loading" && (
        <p role="status" className="atlas-prose text-sm text-[var(--ink-dim)]">
          Loading the terrain skyline…
        </p>
      )}
      {horizon.status === "error" && (
        <p role="alert" className="atlas-prose text-sm text-[var(--fail)]">
          The terrain skyline could not be loaded, so no sky is drawn. {horizon.message}
        </p>
      )}
      {profile && (
        <>
          <div role="group" aria-label="View" className="flex gap-0.5">
            <button type="button" className="atlas-key atlas-label" aria-pressed={view === "unrolled"} onClick={() => setView("unrolled")}>
              Unrolled
            </button>
            <button type="button" className="atlas-key atlas-label" aria-pressed={view === "polar"} onClick={() => setView("polar")}>
              Polar (north up)
            </button>
          </div>
          <div data-testid="sky-path">
            {view === "unrolled" ? (
              <UnrolledSky profile={profile} tracks={sky} band={band} title={title} desc={desc} />
            ) : (
              <PolarSky profile={profile} tracks={sky} band={band} title={title} desc={desc} />
            )}
          </div>
          <SkyLegend />
          <p className="atlas-prose text-sm text-[var(--ink)]" data-testid="sky-path-now">
            Now: {where}.
          </p>
          <p className="atlas-prose text-xs text-[var(--ink-dim)]">
            Sun and Earth tracks and the skyline are the service&apos;s. Visible or hidden is its classification, shown by the line style.
            The flat horizon is drawn dashed for comparison only.
          </p>
        </>
      )}
    </Panel>
  );
}
