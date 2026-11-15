"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { openCommandPalette } from "@/components/shell/CommandPalette";
import { VIEWS, type ViewName } from "@/lib/explore/geometry";

export type Scale = "moon" | "system" | "sky";
export type PanelId = "sites" | "timeline" | "metrics" | "clearance" | "sky-path" | "compare" | "learn";

/** Panels that share the right-hand column: opening one closes the others. */
export const RIGHT_PANELS: PanelId[] = ["metrics", "clearance", "sky-path", "compare", "learn"];

const SCALES: { id: Scale; label: string; ready: boolean; note: string }[] = [
  { id: "moon", label: "Moon", ready: true, note: "" },
  { id: "system", label: "System", ready: false, note: "Arrives in a later phase" },
  { id: "sky", label: "Site sky", ready: true, note: "" },
];

const PANELS: { id: PanelId; label: string }[] = [
  { id: "sites", label: "Sites" },
  { id: "timeline", label: "Timeline" },
  { id: "metrics", label: "Metrics" },
  { id: "clearance", label: "Clearance" },
  { id: "sky-path", label: "Sky path" },
  { id: "compare", label: "Compare" },
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
  runLabel,
  skyReady = false,
}: {
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
}) {
  return (
    <nav aria-label="Atlas" className="atlas-panel flex flex-wrap items-center gap-x-1 gap-y-1 px-2 py-1.5">
      <Link href="/" className="atlas-label-lg mr-2 flex items-center gap-2 px-2 text-[var(--ink)]" aria-label="LunaScope home">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--select)]" />
        LunaScope
      </Link>

      <div role="group" aria-label="Scale" className="flex items-center gap-0.5 border-l border-[var(--panel-edge)] pl-2">
        {SCALES.map((s) => (
          <button
            key={s.id}
            type="button"
            className="atlas-key atlas-label"
            aria-pressed={scale === s.id}
            disabled={s.id === "sky" ? !skyReady && scale !== "sky" : !s.ready}
            title={s.id === "sky" ? (skyReady || scale === "sky" ? undefined : "Select a site that is in the loaded run") : s.ready ? undefined : s.note}
            onClick={() => onScale(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Panels" className="flex items-center gap-0.5 border-l border-[var(--panel-edge)] pl-2">
        {PANELS.map((p) => (
          <button key={p.id} type="button" className="atlas-key atlas-label" aria-pressed={open.includes(p.id)} onClick={() => onTogglePanel(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="View" className="flex items-center gap-0.5 border-l border-[var(--panel-edge)] pl-2">
        {(Object.keys(VIEWS) as ViewName[]).map((v) => (
          <button key={v} type="button" className="atlas-key atlas-label" onClick={() => onView(v)}>
            {VIEWS[v].label}
          </button>
        ))}
        <button type="button" className="atlas-key atlas-label" aria-pressed={placing} onClick={onTogglePlacing}>
          Place a point
        </button>
      </div>

      {runLabel && (
        <span className="atlas-label ml-auto border-l border-[var(--panel-edge)] pl-3 text-[var(--ink-dim)]" data-testid="run-chip">
          {runLabel}
        </span>
      )}
      <button
        type="button"
        className={`atlas-key atlas-label ${runLabel ? "" : "ml-auto"} flex items-center gap-2`}
        onClick={openCommandPalette}
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search aria-hidden="true" className="size-3.5" />
        Search
      </button>
    </nav>
  );
}
