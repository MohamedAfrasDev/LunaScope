"use client";

import { Navigation2 } from "lucide-react";
import { useId, useState } from "react";
import type { SkyLook } from "@/components/atlas/SiteSky";
import { facingWords, headingLabel } from "@/lib/atlas/sky";
import type { Target } from "@/lib/api/types";

const DIRS = [
  { label: "N", az: 0, name: "north" },
  { label: "E", az: 90, name: "east" },
  { label: "S", az: 180, name: "south" },
  { label: "W", az: 270, name: "west" },
] as const;

/**
 * The Site sky controls (spec 6.8): which way to look, which paths to show, and the way back to the Moon. The compass says where
 * the view is pointing. Exaggeration applies to elevation angles only and is stated on screen and in the scale readout whenever it
 * is on.
 */
export function SkyControls({
  look,
  onLook,
  exaggeration,
  onExaggeration,
  paths,
  onPaths,
  onFaceTarget,
  onFace,
  onReturn,
  yaw,
  has,
  lander = true,
  onLander,
  compact = false,
}: {
  /** The generic lander model is drawn (an illustration, not a real spacecraft). */
  lander?: boolean;
  onLander?: (on: boolean) => void;
  /** Phone width: Return to Moon and the heading stay; the rest folds behind Controls. */
  compact?: boolean;
  look: SkyLook;
  /** Offer Look around and From outside. The Atlas leaves it out: seen from outside, the skyline is a ring around a disc, a diagram. */
  onLook?: (l: SkyLook) => void;
  exaggeration: number;
  onExaggeration: (k: number) => void;
  paths: Record<Target, boolean>;
  onPaths: (p: Record<Target, boolean>) => void;
  onFaceTarget: (t: Target) => void;
  onFace: (az: number) => void;
  onReturn: () => void;
  yaw: number;
  has: Record<Target, boolean>;
}) {
  const both = paths.sun_center && paths.earth_center;
  const id = useId();
  const [more, setMore] = useState(false);
  return (
    <div role="group" aria-label="Site sky controls" className="atlas-panel flex flex-wrap items-center gap-x-1 gap-y-1 px-2 py-1.5" data-testid="sky-controls">
      <button type="button" className="atlas-key atlas-label border-[var(--panel-edge)]" onClick={onReturn}>
        ← Return to Moon
      </button>
      {compact && (
        <button type="button" className="atlas-key atlas-label" aria-expanded={more} aria-controls={`${id}-more`} onClick={() => setMore((m) => !m)}>
          {more ? "Fewer controls" : "Controls"}
        </button>
      )}
      <div id={`${id}-more`} hidden={compact && !more} className={compact ? "flex w-full flex-wrap items-center gap-x-1 gap-y-1" : "contents"}>
      <div role="group" aria-label="Where to look" className="flex flex-wrap items-center gap-0.5 border-l border-[var(--panel-edge)] pl-2">
        {has.sun_center && (
          <button type="button" className="atlas-key atlas-label" onClick={() => onFaceTarget("sun_center")}>
            Face the Sun
          </button>
        )}
        {has.earth_center && (
          <button type="button" className="atlas-key atlas-label" onClick={() => onFaceTarget("earth_center")}>
            Face the Earth
          </button>
        )}
        {DIRS.map((d) => (
          <button key={d.label} type="button" className="atlas-key atlas-label" aria-label={`Face ${d.name}`} onClick={() => onFace(d.az)}>
            {d.label}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Paths" className="flex flex-wrap items-center gap-0.5 border-l border-[var(--panel-edge)] pl-2">
        {onLander && (
          <button type="button" className="atlas-key atlas-label" aria-pressed={lander} onClick={() => onLander(!lander)}>
            Lander
          </button>
        )}
        {has.sun_center && (
          <button type="button" className="atlas-key atlas-label" aria-pressed={paths.sun_center} onClick={() => onPaths({ ...paths, sun_center: !paths.sun_center })}>
            Sun path
          </button>
        )}
        {has.earth_center && (
          <button type="button" className="atlas-key atlas-label" aria-pressed={paths.earth_center} onClick={() => onPaths({ ...paths, earth_center: !paths.earth_center })}>
            Earth path
          </button>
        )}
        <button type="button" className="atlas-key atlas-label" aria-pressed={both} onClick={() => onPaths({ sun_center: true, earth_center: true })}>
          All paths
        </button>
      </div>
      <div role="group" aria-label="View" className="flex flex-wrap items-center gap-0.5 border-l border-[var(--panel-edge)] pl-2">
        {onLook && (
          <>
            <button type="button" className="atlas-key atlas-label" aria-pressed={look === "look"} onClick={() => onLook("look")}>
              Look around
            </button>
            <button type="button" className="atlas-key atlas-label" aria-pressed={look === "orbit"} onClick={() => onLook("orbit")}>
              From outside
            </button>
          </>
        )}
        <button type="button" className="atlas-key atlas-label" aria-pressed={exaggeration === 3} onClick={() => onExaggeration(exaggeration === 3 ? 1 : 3)}>
          Exaggerate heights ×3
        </button>
      </div>
      </div>
      <p className="atlas-label ml-auto flex items-center gap-2 pr-1 text-[var(--ink)]" data-testid="sky-heading" aria-live="off">
        <Navigation2 aria-hidden="true" className="size-4 text-[var(--select)]" style={{ transform: `rotate(${Math.round(yaw)}deg)` }} />
        <span className="atlas-number">{headingLabel(yaw)}</span>
        <span className="text-[var(--ink-dim)]">Facing {facingWords(yaw)}</span>
      </p>
      {exaggeration !== 1 && (
        <p role="status" className="atlas-prose basis-full px-1 text-xs text-[var(--warn)]">
          Elevation angles are exaggerated ×{exaggeration} for legibility. Azimuths and the data are unchanged.
        </p>
      )}
    </div>
  );
}
