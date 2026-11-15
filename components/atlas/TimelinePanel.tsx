"use client";

import { useId, useRef, useState } from "react";
import { Panel } from "@/components/atlas/Panel";
import type { RunWindow } from "@/lib/atlas/clock";
import { utcLabel } from "@/lib/atlas/clock";
import type { Track } from "@/lib/atlas/run";
import { frac, intervalsCsv, segments, TARGET_WORDS, timeAt, timelineSummary } from "@/lib/atlas/views";
import type { IntervalClass, Target } from "@/lib/api/types";
import { utc } from "@/lib/format";
import { INTERVAL } from "@/lib/status";

const W = 640;
const LABEL = 64;
const PAD = 6;
const PLOT = W - LABEL - PAD;
const BAR = 18;
const GAP = 10;
const TOP = 16;

const HUE: Record<Target, string> = { sun_center: "var(--sun)", earth_center: "var(--earth)" };
const ORDER: IntervalClass[] = ["V", "H", "U", "X", "G"];
const LEGEND: Record<IntervalClass, string> = { V: "Visible", H: "Hidden", U: "Unresolved", X: "Uncertified", G: "No data" };

type Row = { key: string; label: string; target: Target; track: Track; flat: boolean };

/** One pattern per state, in the target's own hue where it carries the state, so no state depends on colour alone. */
function Patterns({ p, target }: { p: string; target: Target }) {
  const hue = HUE[target];
  return (
    <>
      <pattern id={`${p}-${target}-V`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" style={{ fill: hue }} />
      </pattern>
      <pattern id={`${p}-${target}-U`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" style={{ fill: "var(--panel-raised)" }} />
        <line x1="0" y1="0" x2="0" y2="7" strokeWidth="3" style={{ stroke: hue }} />
      </pattern>
    </>
  );
}

function Swatch({ cls }: { cls: IntervalClass }) {
  const p = useId().replaceAll(":", "");
  return (
    <svg width="22" height="12" aria-hidden="true" className="shrink-0">
      <defs>
        <pattern id={`${p}-U`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" style={{ fill: "var(--panel-raised)" }} />
          <line x1="0" y1="0" x2="0" y2="6" strokeWidth="2.5" style={{ stroke: "var(--ink)" }} />
        </pattern>
        <pattern id={`${p}-G`} width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" style={{ fill: "var(--void)" }} />
          <circle cx="2.5" cy="2.5" r="1" style={{ fill: "var(--ink-dim)" }} />
        </pattern>
        <pattern id={`${p}-X`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" style={{ fill: "var(--fail-soft)" }} />
          <path d="M0 0L6 6M6 0L0 6" strokeWidth="1.1" style={{ stroke: "var(--fail)" }} />
        </pattern>
      </defs>
      <rect
        width="22"
        height="12"
        rx="1.5"
        strokeWidth="1"
        style={{
          fill: cls === "V" ? "var(--ink)" : cls === "H" ? "var(--panel-raised)" : `url(#${p}-${cls})`,
          stroke: "var(--ink-dim)",
        }}
      />
    </svg>
  );
}

/** What each state looks like, in the same order the bar uses. */
export function TimelineLegend() {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-[var(--ink-dim)]">
      {ORDER.map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <Swatch cls={c} />
          {LEGEND[c]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true">▲ ▼</span>Rise, set
      </li>
    </ul>
  );
}

/**
 * Timeline (spec 6.4): Sun and Earth over the whole window as bars of the service's classified intervals, with the service's
 * rise and set times, a cursor that follows the clock, and a flat-horizon comparison. Dragging on the bars moves the clock.
 * There is no combined "both" row: the product judges Sun and Earth separately (rule 3), so none is drawn.
 */
export function TimelinePanel({
  siteLabel,
  tracks,
  window: win,
  t,
  onSeek,
  onClose,
}: {
  siteLabel: string;
  tracks: Partial<Record<Target, Track>>;
  window: RunWindow;
  t: number;
  onSeek: (t: number) => void;
  onClose: () => void;
}) {
  const uid = useId().replaceAll(":", "");
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const [flat, setFlat] = useState(false);
  const [table, setTable] = useState(false);

  const targets = (Object.keys(tracks) as Target[]).filter((k): k is Target => !!tracks[k]);
  const rows: Row[] = [
    ...targets.map((k) => ({ key: k, label: TARGET_WORDS[k].toUpperCase(), target: k, track: tracks[k]!, flat: false })),
    ...(flat ? targets.filter((k) => tracks[k]!.flat).map((k) => ({ key: `${k}-flat`, label: `${TARGET_WORDS[k].toUpperCase()} FLAT`, target: k, track: tracks[k]!, flat: true })) : []),
  ];
  const H = TOP + rows.length * (BAR + GAP) + 4;
  const x = (sec: number) => LABEL + frac(sec, win.totalS) * PLOT;

  function seekFrom(e: React.PointerEvent) {
    const el = svg.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const u = ((e.clientX - r.left) / r.width) * W; // svg units
    onSeek(timeAt((u - LABEL) / PLOT, win.totalS));
  }

  const summary = timelineSummary(tracks);

  function download() {
    const url = URL.createObjectURL(new Blob([intervalsCsv(targets.map((k) => ({ target: k, intervals: tracks[k]!.intervals })))], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lunascope-${siteLabel.replace(/\W+/g, "-")}-intervals.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel title="Timeline" tag="derived" onClose={onClose} className="max-h-full" bodyClassName="space-y-3">
      <p className="atlas-label text-[var(--ink-dim)]">{siteLabel}</p>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${uid}-t`}
        aria-describedby={`${uid}-d`}
        className="h-auto w-full cursor-col-resize touch-none select-none"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFrom(e);
        }}
        onPointerMove={(e) => dragging.current && seekFrom(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        data-testid="timeline-svg"
      >
        <title id={`${uid}-t`}>Visibility timeline for {siteLabel}</title>
        <desc id={`${uid}-d`}>{summary} The cursor shows the clock time; drag to move it. The time dock has the same control by keyboard.</desc>
        <defs>
          {targets.map((k) => (
            <Patterns key={k} p={uid} target={k} />
          ))}
          <pattern id={`${uid}-X`} width="7" height="7" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" style={{ fill: "var(--fail-soft)" }} />
            <path d="M0 0L7 7M7 0L0 7" strokeWidth="1.2" style={{ stroke: "var(--fail)" }} />
          </pattern>
          <pattern id={`${uid}-G`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" style={{ fill: "var(--void)" }} />
            <circle cx="3" cy="3" r="1.1" style={{ fill: "var(--ink-dim)" }} />
          </pattern>
        </defs>
        {rows.map((r, i) => {
          const y = TOP + i * (BAR + GAP);
          const fillFor = (cls: IntervalClass) =>
            cls === "V" ? `url(#${uid}-${r.target}-V)` : cls === "H" ? "var(--panel-raised)" : cls === "U" ? `url(#${uid}-${r.target}-U)` : cls === "X" ? `url(#${uid}-X)` : `url(#${uid}-G)`;
          const iv = r.flat ? r.track.flat!.intervals ?? [] : r.track.intervals;
          return (
            <g key={r.key} opacity={r.flat ? 0.75 : 1}>
              <text x={0} y={y + BAR - 5} fontSize="11" style={{ fill: "var(--ink-dim)", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.12em" }}>
                {r.label}
              </text>
              <rect x={LABEL} y={y} width={PLOT} height={BAR} rx="1.5" style={{ fill: "var(--void)", stroke: "var(--panel-edge)" }} />
              {segments(iv, win.totalS).map((s, j) => (
                <rect key={j} x={LABEL + s.x * PLOT} y={y} width={Math.max(s.w * PLOT, 0.5)} height={BAR} style={{ fill: fillFor(s.cls) }} />
              ))}
              {!r.flat &&
                r.track.events.map((e) => (
                  <path
                    key={`${e.type}-${e.t_s}`}
                    d={e.type === "rise" ? `M${x(e.t_s) - 3.5} ${y - 2}L${x(e.t_s) + 3.5} ${y - 2}L${x(e.t_s)} ${y - 8}Z` : `M${x(e.t_s) - 3.5} ${y - 8}L${x(e.t_s) + 3.5} ${y - 8}L${x(e.t_s)} ${y - 2}Z`}
                    style={{ fill: "var(--ink)" }}
                  >
                    <title>{`${TARGET_WORDS[r.target]} ${e.type}: ${utc(e.t_utc)}`}</title>
                  </path>
                ))}
            </g>
          );
        })}
        <line x1={x(t)} x2={x(t)} y1={TOP - 12} y2={H - 2} strokeWidth="2" style={{ stroke: "var(--select)" }} data-testid="timeline-cursor" />
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[var(--ink-dim)]">
        <span className="atlas-number">{utcLabel(win, 0)}</span>
        <span className="atlas-number text-[var(--ink)]">{utcLabel(win, t)}</span>
        <span className="atlas-number">{utcLabel(win, win.totalS)}</span>
      </div>

      <TimelineLegend />
      <p className="atlas-prose text-sm text-[var(--ink)]" data-testid="timeline-summary">
        {summary}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="atlas-key atlas-label flex cursor-pointer items-center gap-2 border border-[var(--panel-edge)]">
          <input type="checkbox" checked={flat} onChange={(e) => setFlat(e.target.checked)} className="accent-[var(--select)]" />
          Compare to a flat horizon
        </label>
        <button type="button" className="atlas-key atlas-label border-[var(--panel-edge)]" aria-expanded={table} onClick={() => setTable((v) => !v)}>
          {table ? "Hide table" : "Show as table"}
        </button>
        <button type="button" className="atlas-key atlas-label border-[var(--panel-edge)]" onClick={download}>
          Download CSV
        </button>
      </div>

      {table &&
        targets.map((k) => (
          <div key={k}>
            <h3 className="atlas-label mb-1 text-[var(--ink-dim)]">Intervals in the window: {TARGET_WORDS[k]}</h3>
            <div className="atlas-scroll max-h-44 border border-[var(--panel-edge)]" tabIndex={0} role="region" aria-label={`${TARGET_WORDS[k]} intervals`}>
              <table className="w-full border-collapse text-left text-xs">
                <caption className="sr-only">{TARGET_WORDS[k]} intervals at {siteLabel}, terrain-aware</caption>
                <thead>
                  <tr className="text-[var(--ink-dim)]">
                    <th scope="col" className="px-2 py-1 font-normal">State</th>
                    <th scope="col" className="px-2 py-1 font-normal">Start (UTC)</th>
                    <th scope="col" className="px-2 py-1 font-normal">End (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {tracks[k]!.intervals.map((iv, i) => (
                    <tr key={i} className="border-t border-[var(--panel-edge)]">
                      <th scope="row" className="px-2 py-1 text-left font-normal">{INTERVAL[iv.class].label}</th>
                      <td className="atlas-number px-2 py-1">{utc(iv.start_utc)}</td>
                      <td className="atlas-number px-2 py-1">{utc(iv.end_utc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </Panel>
  );
}
