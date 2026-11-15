"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LearnPanel } from "@/components/atlas/LearnPanel";
import { Readout } from "@/components/atlas/Readout";
import { TimeDock } from "@/components/atlas/TimeDock";
import { TopBar, type PanelId, type Scale } from "@/components/atlas/TopBar";
import { ExploreLoader } from "@/components/explore/ExploreLoader";
import type { SceneHandle } from "@/components/explore/ExploreViewer";
import type { ViewName } from "@/lib/explore/geometry";

function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

const SCALE_LABEL: Record<Scale, string> = { moon: "MOON SCALE", system: "SYSTEM SCALE", sky: "SITE SKY" };

/**
 * The Atlas frame (spec 3 and 4): one full-screen scene, floating instruments on top, one time dock underneath.
 * Phase A: the frame, the tokens and the real Moon. Sites, the clock and the result panels arrive in later phases.
 * H hides the interface (for screenshots) and shows it again.
 */
export function AtlasShell() {
  const [scale, setScale] = useState<Scale>("moon");
  const [open, setOpen] = useState<PanelId[]>([]);
  const [hidden, setHidden] = useState(false);
  const scene = useRef<SceneHandle | null>(null);

  const onReady = useCallback((h: SceneHandle) => {
    scene.current = h;
  }, []);
  const onView = useCallback((v: ViewName) => scene.current?.fly(v), []);
  const toggle = useCallback((p: PanelId) => setOpen((o) => (o.includes(p) ? o.filter((x) => x !== p) : [...o, p])), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      if (e.key === "h" || e.key === "H") setHidden((h) => !h);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="atlas absolute inset-0 overflow-hidden" data-testid="atlas" data-scale={scale} data-hidden={hidden}>
      <ExploreLoader bleed onReady={onReady} />

      <p role="status" className="sr-only">
        {hidden ? "Interface hidden. Press H to show it." : ""}
      </p>
      {hidden && (
        <p aria-hidden="true" className="atlas-label pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[var(--ink-dim)]">
          Press H to show the interface
        </p>
      )}

      {!hidden && (
        <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-3 [&>*]:pointer-events-auto">
          <TopBar scale={scale} onScale={setScale} open={open} onTogglePanel={toggle} onView={onView} />

          <div className="flex min-h-0 flex-1 items-start justify-between gap-3">
            <div className="min-w-0" />
            <div className="pointer-events-none flex h-full min-h-0 w-[min(26rem,100%)] flex-col items-end gap-3">
              <Readout scaleLabel={SCALE_LABEL[scale]} timeLabel="NO RUN LOADED" />
              {open.includes("learn") && (
                <div className="pointer-events-auto flex min-h-0 w-full flex-1 flex-col">
                  <LearnPanel onClose={() => toggle("learn")} />
                </div>
              )}
            </div>
          </div>

          <TimeDock />
        </div>
      )}
    </div>
  );
}
