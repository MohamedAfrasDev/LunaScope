"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Sky3DHandle, Track3D } from "@/components/Sky3D";
import type { HorizonLoad } from "@/components/atlas/useHorizon";
import type { TerrainLoad } from "@/components/atlas/useTerrainPatch";
import { utcLabel, type RunWindow } from "@/lib/atlas/clock";
import type { Track } from "@/lib/atlas/run";
import type { Target } from "@/lib/api/types";

/** three.js loads here, on the first visit to Site sky, and nowhere else. */
const Sky3D = dynamic(() => import("@/components/Sky3D").then((m) => m.Sky3D), { ssr: false });

export type SkyLook = "look" | "orbit";

/**
 * The Site sky scale (spec 6.8): the run pages' 3D sky, full-bleed, with the Atlas supplying every control and readout. The
 * terrain skyline is the service's, the Sun and Earth positions are its series at the clock time, and the wall hides a target only
 * because the data put the target behind it. Nothing is drawn if the skyline is missing: the reason is said instead.
 */
export function SiteSky({
  siteName,
  tracks,
  horizon,
  terrain = { status: "idle" },
  window: win,
  t,
  look,
  exaggeration,
  paths,
  lander = true,
  onReady,
  onView,
}: {
  siteName: string;
  tracks: Partial<Record<Target, Track>>;
  horizon: HorizonLoad;
  /** Real ground around the site; when it is not available the skyline wall stands alone. */
  terrain?: TerrainLoad;
  window: RunWindow;
  t: number;
  look: SkyLook;
  exaggeration: number;
  paths: Partial<Record<Target, boolean>>;
  /** The generic lander model (an illustration). */
  lander?: boolean;
  onReady: (h: Sky3DHandle) => void;
  onView: (yaw: number, pitch: number) => void;
}) {
  // the scene is rebuilt when this array changes, so it only changes with the data
  const tracks3d: Track3D[] = useMemo(
    () => (["sun_center", "earth_center"] as Target[]).flatMap((target) => (tracks[target] ? [{ target, series: tracks[target]!.series, intervals: tracks[target]!.intervals }] : [])),
    [tracks],
  );

  if (horizon.status === "ready" && terrain.status === "loading") {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[var(--void)]" data-testid="site-sky-wait">
        <p role="status" className="atlas-panel atlas-prose max-w-md px-4 py-3 text-sm text-[var(--ink)]">Loading the ground around this site…</p>
      </div>
    );
  }
  if (horizon.status !== "ready") {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[var(--void)]" data-testid="site-sky-wait">
        <p role={horizon.status === "error" ? "alert" : "status"} className="atlas-panel atlas-prose max-w-md px-4 py-3 text-sm text-[var(--ink)]">
          {horizon.status === "error"
            ? `The terrain skyline could not be loaded, so no sky is drawn. ${horizon.message}`
            : "Loading the terrain skyline for this site…"}
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0" data-testid="site-sky">
      <Sky3D
        bleed
        profile={horizon.profile}
        terrain={terrain.status === "ready" ? terrain.patch : null}
        tracks={tracks3d}
        t={t}
        siteName={siteName}
        clock={utcLabel(win, t)}
        mode={look}
        exaggeration={exaggeration}
        showPaths={paths}
        showLander={lander}
        utcMs={win.startMs + t * 1000}
        onReady={onReady}
        onView={onView}
      />
    </div>
  );
}
