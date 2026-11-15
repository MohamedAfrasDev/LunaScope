"use client";

import { useEffect, useRef } from "react";
import type { SceneHandle } from "@/components/explore/ExploreViewer";
import { declutter, formatEastLon, formatLat, labelSize, type AtlasSite, type LabelBox } from "@/lib/atlas/sites";

const coverageKind = (s: AtlasSite) => (!s.coverage ? "unknown" : s.coverage.fullyCovered ? "full" : "partial");

/**
 * The site pins, laid over the globe (spec 6.2). Each pin is a real, focusable button. Positions are written straight to the
 * elements on every globe frame (no React render per frame), a pin the Moon itself hides is hidden, and labels are
 * decluttered so none sits on another one: the selected site always keeps its label, the rest appear as you zoom in.
 */
export function PinLayer({
  scene,
  sites,
  selectedId,
  onSelect,
}: {
  scene: SceneHandle | null;
  sites: AtlasSite[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const pins = useRef(new Map<string, HTMLButtonElement>());
  const labels = useRef(new Map<string, HTMLElement>());
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scene) return;
    const update = () => {
      const area = box.current?.getBoundingClientRect();
      const boxes: LabelBox[] = [];
      for (const s of sites) {
        const el = pins.current.get(s.id);
        if (!el) continue;
        const p = scene.project(s.latDeg, s.lonEastDeg);
        const inside = !!p && p.visible && !!area && p.x >= -20 && p.y >= -20 && p.x <= area.width + 20 && p.y <= area.height + 20;
        if (!inside || !p) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "";
        el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        const { w, h } = labelSize(s.label.length);
        boxes.push({ id: s.id, x: p.x + 14, y: p.y - 11, w, h, priority: s.id === selectedId ? 3 : s.kind === "custom" ? 2 : s.kind === "named" ? 1 : 0 });
      }
      const shown = declutter(boxes);
      for (const [id, l] of labels.current) l.hidden = !shown.has(id);
    };
    update();
    return scene.onFrame(update);
  }, [scene, sites, selectedId]);

  return (
    <div ref={box} className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="pin-layer">
      {sites.map((s) => (
        <button
          key={s.id}
          type="button"
          ref={(el) => {
            if (el) pins.current.set(s.id, el);
            else pins.current.delete(s.id);
          }}
          className="atlas-pin"
          style={{ display: "none" }}
          data-kind={s.kind}
          data-coverage={coverageKind(s)}
          data-site={s.id}
          aria-pressed={s.id === selectedId}
          aria-label={`${s.label}, ${formatLat(s.latDeg)}, ${formatEastLon(s.lonEastDeg)}`}
          onClick={() => onSelect(s.id)}
        >
          <span aria-hidden="true" className="atlas-pin-mark" />
          <span
            aria-hidden="true"
            className="atlas-pin-label atlas-label"
            ref={(el) => {
              if (el) labels.current.set(s.id, el);
              else labels.current.delete(s.id);
            }}
          >
            {s.label}
          </span>
        </button>
      ))}
    </div>
  );
}
