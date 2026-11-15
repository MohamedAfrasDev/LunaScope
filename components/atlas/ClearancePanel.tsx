"use client";

import { useId, useState } from "react";
import { Panel } from "@/components/atlas/Panel";
import type { HorizonLoad } from "@/components/atlas/useHorizon";
import type { Target } from "@/lib/api/types";
import { utcLabel, type RunWindow } from "@/lib/atlas/clock";
import type { Track } from "@/lib/atlas/run";
import { TARGET_WORDS, thin } from "@/lib/atlas/views";
import { degrees } from "@/lib/format";
import { classAt, skylineAt } from "@/lib/sky";
import { INTERVAL } from "@/lib/status";

const W = 640;
const H = 220;
const L = 46;
const R = 10;
const T = 10;
const B = 22;
const HUE: Record<Target, string> = { sun_center: "var(--sun)", earth_center: "var(--earth)" };
const MAX_POINTS = 240;

type Pt = { t: number; el: number; sky: number | null };

function points(track: Track, profile: HorizonLoad): Pt[] {
  const s = track.series;
  const prof = profile.status === "ready" ? profile.profile : null;
  return thin(s.el_deg, MAX_POINTS).map(({ v, i }) => ({ t: i * s.step_s, el: v, sky: prof ? skylineAt(prof, s.az_deg[i]) : null }));
}

/**
 * Clearance (spec 6.6): each target's elevation over the window (the service's series, solid) against the terrain skyline in the
 * target's direction (the service's skyline, dashed), with a cursor on the clock. It draws two service curves and never subtracts
 * them: the clearance numbers and the visible or hidden state are the service's, printed beside the chart and on the Timeline.
 */
export function ClearancePanel({
  siteLabel,
  tracks,
  window: win,
  t,
  horizon,
  onSeek,
  onClose,
}: {
  siteLabel: string;
  tracks: Partial<Record<Target, Track>>;
  window: RunWindow;
  t: number;
  horizon: HorizonLoad;
  onSeek: (t: number) => void;
  onClose: () => void;
}) {
  const uid = useId().replaceAll(":", "");
  const [table, setTable] = useState(false);
  const targets = (Object.keys(tracks) as Target[]).filter((k) => !!tracks[k]);
  const data = targets.map((k) => ({ k, pts: points(tracks[k]!, horizon) }));
  const ys = data.flatMap((d) => d.pts.flatMap((p) => [p.el, ...(p.sky == null ? [] : [p.sky])]));
  const lo = Math.floor(Math.min(0, ...ys) / 5) * 5 - 5;
  const hi = Math.ceil(Math.max(0, ...ys) / 5) * 5 + 5;
  const X = (sec: number) => L + (win.totalS > 0 ? sec / win.totalS : 0) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += 5 * Math.max(1, Math.ceil((hi - lo) / 40))) ticks.push(v);

  const path = (pts: { x: number; y: number | null }[]) => {
    let d = "";
    let pen = false;
    for (const p of pts) {
      if (p.y == null) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  const summary = data
    .map(({ k }) => {
      const c = tracks[k]!.terrain.clearance_at_nodes;
      return c ? `${TARGET_WORDS[k]}: from ${degrees(c.min_deg)} to ${degrees(c.max_deg)} above the terrain skyline (median ${degrees(c.median_deg)})` : `${TARGET_WORDS[k]}: clearance unknown`;
    })
    .join("; ");

  const first = data[0]?.pts ?? [];
  const rows = first.filter((_, i) => i % Math.max(1, Math.round(first.length / 28)) === 0);

  return (
    <Panel title="Clearance" tag="derived" onClose={onClose} focused className="max-h-full" bodyClassName="space-y-3">
      <p className="atlas-label text-[var(--ink-dim)]">{siteLabel}</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${uid}-t`}
        aria-describedby={`${uid}-d`}
        className="h-auto w-full cursor-col-resize touch-none select-none"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const u = ((e.clientX - r.left) / r.width) * W;
          onSeek(Math.min(Math.max((u - L) / (W - L - R), 0), 1) * win.totalS);
        }}
        data-testid="clearance-svg"
      >
        <title id={`${uid}-t`}>Elevation of the Sun and Earth over the window at {siteLabel}, against the terrain skyline</title>
        <desc id={`${uid}-d`}>{summary}. Solid lines are the target elevations; dashed lines are the terrain skyline in each target&apos;s direction.</desc>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} strokeWidth={v === 0 ? 1.5 : 0.6} style={{ stroke: v === 0 ? "var(--ink)" : "var(--panel-edge)" }} />
            <text x={L - 6} y={Y(v) + 3} textAnchor="end" fontSize="10" style={{ fill: "var(--ink-dim)", fontFamily: "var(--font-geist-mono), monospace" }}>
              {v > 0 ? "+" : ""}
              {v}°
            </text>
          </g>
        ))}
        {data.map(({ k, pts }) => (
          <g key={k}>
            <path d={path(pts.map((p) => ({ x: X(p.t), y: p.sky == null ? null : Y(p.sky) })))} fill="none" strokeWidth="1.6" strokeDasharray="5 4" style={{ stroke: HUE[k], opacity: 0.7 }} />
            <path d={path(pts.map((p) => ({ x: X(p.t), y: Y(p.el) })))} fill="none" strokeWidth="2.4" style={{ stroke: HUE[k] }} />
          </g>
        ))}
        <line x1={X(t)} x2={X(t)} y1={T} y2={H - B} strokeWidth="2" style={{ stroke: "var(--select)" }} data-testid="clearance-cursor" />
        <text x={L} y={H - 6} fontSize="10" style={{ fill: "var(--ink-dim)", fontFamily: "var(--font-geist-mono), monospace" }}>
          {utcLabel(win, 0)}
        </text>
        <text x={W - R} y={H - 6} textAnchor="end" fontSize="10" style={{ fill: "var(--ink-dim)", fontFamily: "var(--font-geist-mono), monospace" }}>
          {utcLabel(win, win.totalS)}
        </text>
      </svg>

      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-[var(--ink-dim)]">
        {targets.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <svg width="34" height="10" aria-hidden="true">
              <line x1="2" x2="32" y1="5" y2="5" strokeWidth="2.4" style={{ stroke: HUE[k] }} />
            </svg>
            {TARGET_WORDS[k]} elevation
          </li>
        ))}
        {targets.map((k) => (
          <li key={`${k}-sky`} className="flex items-center gap-1.5">
            <svg width="34" height="10" aria-hidden="true">
              <line x1="2" x2="32" y1="5" y2="5" strokeWidth="1.6" strokeDasharray="5 4" style={{ stroke: HUE[k], opacity: 0.7 }} />
            </svg>
            Terrain skyline toward the {TARGET_WORDS[k]}
          </li>
        ))}
      </ul>

      {horizon.status === "loading" && (
        <p role="status" className="atlas-prose text-xs text-[var(--ink-dim)]">
          Loading the terrain skyline…
        </p>
      )}
      {horizon.status === "error" && (
        <p role="alert" className="atlas-prose text-xs text-[var(--fail)]">
          The terrain skyline could not be loaded, so only the target elevations are drawn. {horizon.message}
        </p>
      )}

      <p className="atlas-prose text-sm text-[var(--ink)]" data-testid="clearance-summary">
        Clearance above the terrain skyline over the window: {summary}.
      </p>
      <p className="atlas-prose text-xs text-[var(--ink-dim)]">
        Whether a target is visible is the service&apos;s classification, shown on the Timeline. A gap in a dashed line means the skyline
        is unknown in that direction, never flat ground.
      </p>

      <button type="button" className="atlas-key atlas-label border-[var(--panel-edge)]" aria-expanded={table} onClick={() => setTable((v) => !v)}>
        {table ? "Hide table" : "Show as table"}
      </button>
      {table && (
        <div className="atlas-scroll max-h-52 border border-[var(--panel-edge)]" tabIndex={0} role="region" aria-label="Elevation samples">
          <table className="w-full border-collapse text-left text-xs">
            <caption className="sr-only">Target elevation, terrain skyline and the service&apos;s state, sampled across the window</caption>
            <thead>
              <tr className="text-[var(--ink-dim)]">
                <th scope="col" className="px-2 py-1 font-normal">Time (UTC)</th>
                {targets.map((k) => (
                  <th key={k} scope="col" className="px-2 py-1 font-normal">
                    {TARGET_WORDS[k]}: elevation, skyline, state
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.t} className="border-t border-[var(--panel-edge)]">
                  <th scope="row" className="atlas-number px-2 py-1 text-left font-normal">{utcLabel(win, r.t)}</th>
                  {data.map(({ k, pts }) => {
                    const p = pts.find((q) => q.t === r.t);
                    const st = classAt(tracks[k]!.intervals, r.t);
                    return (
                      <td key={k} className="atlas-number px-2 py-1">
                        {p ? degrees(p.el) : "—"}, {p?.sky == null ? "unknown" : degrees(p.sky)}, {st ? INTERVAL[st].short : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
