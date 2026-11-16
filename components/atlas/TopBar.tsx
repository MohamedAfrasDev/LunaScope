"use client";

import { Menu, Search, X } from "lucide-react";
import { useId, useState } from "react";
import Link from "next/link";
import { openCommandPalette } from "@/components/shell/CommandPalette";
import { VIEWS, type ViewName } from "@/lib/explore/geometry";

export type Scale = "moon" | "system" | "sky";
export type PanelId = "sites" | "timeline" | "metrics" | "clearance" | "sky-path" | "compare" | "dates" | "evidence" | "analyse" | "runs" | "learn";

/** Panels that share the right-hand column: opening one closes the others. */
export const RIGHT_PANELS: PanelId[] = ["metrics", "clearance", "sky-path", "compare", "dates", "evidence", "analyse", "runs", "learn"];

/** Panels that need more room than the narrow right column. */
export const WIDE_PANELS: PanelId[] = ["dates", "evidence", "analyse"];

/** Why Place a point is off on an offline copy. */
const PLACE_OFFLINE_NOTE = "Needs the live science service. This copy is offline, so a new point cannot be computed. Run LunaScope on your computer to add your own points.";

const SCALES: { id: Scale; label: string; ready: boolean; note: string }[] = [
  { id: "moon", label: "Moon", ready: true, note: "" },
  { id: "system", label: "System", ready: true, note: "" },
  { id: "sky", label: "Site sky", ready: true, note: "" },
];

const PANELS: { id: PanelId; label: string }[] = [
  { id: "sites", label: "Sites" },
  { id: "timeline", label: "Timeline" },
  { id: "metrics", label: "Metrics" },
  { id: "clearance", label: "Clearance" },
  { id: "sky-path", label: "Sky path" },
  { id: "compare", label: "Compare" },
  { id: "dates", label: "Dates" },
  { id: "evidence", label: "Evidence" },
  { id: "analyse", label: "Analyse" },
  { id: "learn", label: "Learn" },
];

/** The Atlas top bar (spec 4): brand, scale, panels, view shortcuts and search. Scales that are not built yet are disabled and say so. */
export function TopBar({
  scale,
  onScale,
  open,
  onTogglePanel,
  onView,
  placing,
  onTogglePlacing,
  canPlace = true,
  runLabel,
  skyReady = false,
  compact = false,
}: {
  /** Phone width: the groups fold behind a Menu button and the run chip moves up beside the name. */
  compact?: boolean;
  /** The open run, as the chip says it. Without one the chip reads "Runs". */
  runLabel?: string;
  /** Site sky needs a run and a selected site that the run holds. */
  skyReady?: boolean;
  scale: Scale;
  onScale: (s: Scale) => void;
  open: PanelId[];
  onTogglePanel: (p: PanelId) => void;
  onView: (v: ViewName) => void;
  placing: boolean;
  onTogglePlacing: () => void;
  /** False on an offline copy, which cannot compute a new point. */
  canPlace?: boolean;
}) {
  const menuId = useId();
  const [menu, setMenu] = useState(false);
  const chip = (
    <button
      type="button"
      className={`atlas-key atlas-label ${compact ? "ml-auto" : "ml-auto border-l border-[var(--panel-edge)]"}`}
      data-testid="run-chip"
      aria-pressed={open.includes("runs")}
      aria-label={runLabel ? `${runLabel}: choose another run` : "Runs: choose a run"}
      onClick={() => onTogglePanel("runs")}
    >
      {runLabel ?? "Runs"}
    </button>
  );
  // choosing something in the folded menu closes it, so the globe is visible again
  const closing = <T extends unknown[]>(fn: (...a: T) => void) => (...a: T) => {
    fn(...a);
    if (compact) setMenu(false);
  };
  return (
    <nav aria-label="Atlas" className="atlas-panel flex flex-wrap items-center gap-x-1 gap-y-1 px-2 py-1.5" data-compact={compact}>
      <Link href="/" className="atlas-label-lg mr-2 flex items-center gap-2 px-2 text-[var(--ink)]" aria-label="LunaScope home">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--select)]" />
        LunaScope
      </Link>
      {compact && chip}
      {compact && (
        <button type="button" className="atlas-key atlas-label flex items-center gap-1.5" aria-expanded={menu} aria-controls={menuId} onClick={() => setMenu((m) => !m)}>
          {menu ? <X aria-hidden="true" className="size-3.5" /> : <Menu aria-hidden="true" className="size-3.5" />}
          Menu
        </button>
      )}

      <div id={menuId} hidden={compact && !menu} className={compact ? "flex w-full flex-wrap items-center gap-x-1 gap-y-1 border-t border-[var(--panel-edge)] pt-1.5" : "contents"}>

      <div role="group" aria-label="Scale" className="flex flex-wrap items-center gap-0.5 border-l border-[var(--panel-edge)] pl-2">
        {SCALES.map((s) => (
          <button
            key={s.id}
            type="button"
            className="atlas-key atlas-label"
            aria-pressed={scale === s.id}
            disabled={s.id === "sky" ? !skyReady && scale !== "sky" : !s.ready}
            title={s.id === "sky" ? (skyReady || scale === "sky" ? undefined : "Select a site that is in the loaded run") : s.ready ? undefined : s.note}
            onClick={() => closing(onScale)(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Panels" className="flex flex-wrap items-center gap-0.5 border-l border-[var(--panel-edge)] pl-2">
        {PANELS.map((p) => (
          <button key={p.id} type="button" className="atlas-key atlas-label" aria-pressed={open.includes(p.id)} onClick={() => closing(onTogglePanel)(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="View" className="flex flex-wrap items-center gap-0.5 border-l border-[var(--panel-edge)] pl-2">
        {(Object.keys(VIEWS) as ViewName[]).map((v) => (
          <button key={v} type="button" className="atlas-key atlas-label" onClick={() => closing(onView)(v)}>
            {VIEWS[v].label}
          </button>
        ))}
        {/* a disabled button swallows the pointer, so the tooltip sits on the wrapper that does not */}
        <span className="inline-flex" title={canPlace ? undefined : PLACE_OFFLINE_NOTE} data-testid="place-wrap">
          <button
            type="button"
            className="atlas-key atlas-label disabled:pointer-events-none"
            aria-pressed={placing}
            disabled={!canPlace}
            aria-label={canPlace ? undefined : `Place a point. ${PLACE_OFFLINE_NOTE}`}
            onClick={() => closing(onTogglePlacing)()}
          >
            Place a point
          </button>
        </span>
      </div>

      {!compact && chip}
      <button
        type="button"
        className="atlas-key atlas-label flex items-center gap-2"
        onClick={() => closing(openCommandPalette)()}
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search aria-hidden="true" className="size-3.5" />
        Search
      </button>
      </div>
    </nav>
  );
}
