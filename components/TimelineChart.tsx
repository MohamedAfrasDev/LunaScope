import { useId } from "react";
import type { EventRow, HorizonKind, IntervalClass, IntervalRow, Target } from "@/lib/api/types";
import { duration, targetLabel, utc } from "@/lib/format";
import { INTERVAL } from "@/lib/status";

export interface Band {
  target: Target;
  horizon: HorizonKind;
  intervals: IntervalRow[];
  events: EventRow[];
  summary: string; // text alternative, built from server-decided values
  label?: string; // row label when rows are not target/horizon (e.g. one row per site)
  sub?: string;
  /** Marks one span (the longest known outage) with a bracket above the band. */
  mark?: { start_s: number; end_s: number; text: string };
}

const W = 1000;
const LABEL = 170;
const PLOT = W - LABEL - 10;
const BAND = 26;
const GAP = 14;
const TOP = 8;

const ORDER: IntervalClass[] = ["V", "H", "U", "X", "G"];

/** One pattern per state, so no state depends on colour alone. */
function Patterns({ p }: { p: string }) {
  return (
    <defs>
      <pattern id={`${p}-V`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" style={{ fill: "var(--ok)" }} />
      </pattern>
      <pattern id={`${p}-H`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" style={{ fill: "var(--surface-2)" }} />
        <line x1="0" y1="0" x2="0" y2="8" strokeWidth="3" style={{ stroke: "var(--muted)" }} />
      </pattern>
      <pattern id={`${p}-U`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" style={{ fill: "var(--warn-soft)" }} />
        <circle cx="3" cy="3" r="1.4" style={{ fill: "var(--warn)" }} />
      </pattern>
      <pattern id={`${p}-X`} width="7" height="7" patternUnits="userSpaceOnUse">
        <rect width="7" height="7" style={{ fill: "var(--fail-soft)" }} />
        <path d="M0 0L7 7M7 0L0 7" strokeWidth="1.2" style={{ stroke: "var(--fail)" }} />
      </pattern>
      <pattern id={`${p}-G`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" style={{ fill: "var(--surface)" }} />
        <path d="M0 3H6" strokeWidth="1" strokeDasharray="2 2" style={{ stroke: "var(--muted)" }} />
      </pattern>
    </defs>
  );
}

export function Legend() {
  const p = useId().replaceAll(":", "");
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
      {ORDER.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <svg width="22" height="12" aria-hidden="true">
            <Patterns p={`${p}l`} />
            <rect width="22" height="12" fill={`url(#${p}l-${k})`} stroke="currentColor" strokeWidth="0.6" />
          </svg>
          {INTERVAL[k].label}
        </li>
      ))}
    </ul>
  );
}

export function TimelineChart({ bands, title }: { bands: Band[]; title: string }) {
  const p = useId().replaceAll(":", "");
  const total = Math.max(...bands.flatMap((b) => b.intervals.map((i) => i.end_s)), 1);
  const x = (s: number) => LABEL + (s / total) * PLOT;
  const height = TOP + bands.length * (BAND + GAP) + 26;
  const days = Math.floor(total / 86400);
  const step = days > 14 ? 5 : days > 7 ? 2 : 1;
  const ticks = Array.from({ length: Math.floor(days / step) + 1 }, (_, i) => i * step * 86400);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-labelledby={`${p}-t`} aria-describedby={`${p}-d`}
      className="h-auto w-full">
      <title id={`${p}-t`}>{title}</title>
      <desc id={`${p}-d`}>{bands.map((b) => b.summary).join(" ")}</desc>
      <Patterns p={p} />
      {bands.map((b, row) => {
        const y = TOP + row * (BAND + GAP);
        return (
          <g key={`${b.label ?? ""}-${b.target}-${b.horizon}`}>
            <text x={0} y={y + BAND / 2 + 4} fontSize="13" style={{ fill: "var(--foreground)" }}>
              {b.label ?? targetLabel(b.target)}
              <tspan x={0} dy="14" fontSize="11" style={{ fill: "var(--muted)" }}>
                {b.sub ?? (b.horizon === "terrain" ? "terrain-aware" : "flat horizon")}
              </tspan>
            </text>
            {b.intervals.map((i) => (
              <rect key={`${i.start_s}-${i.class}`} x={x(i.start_s)} y={y} width={Math.max(x(i.end_s) - x(i.start_s), 0.5)}
                height={BAND} fill={`url(#${p}-${i.class})`}>
                <title>{`${INTERVAL[i.class].label}: ${utc(i.start_utc)} to ${utc(i.end_utc)} (${duration(i.end_s - i.start_s)})`}</title>
              </rect>
            ))}
            <rect x={LABEL} y={y} width={PLOT} height={BAND} fill="none" strokeWidth="0.8"
              style={{ stroke: "var(--border)" }} />
            {b.mark && b.mark.end_s > b.mark.start_s && (
              <g>
                <path d={`M${x(b.mark.start_s)} ${y - 1}V${y - 6}H${x(b.mark.end_s)}V${y - 1}`} fill="none" strokeWidth="1.6"
                  style={{ stroke: "var(--fail)" }} />
                <title>{b.mark.text}</title>
              </g>
            )}
            {b.events.map((e) => (
              <g key={e.t_s}>
                <line x1={x(e.t_s)} x2={x(e.t_s)} y1={y - 3} y2={y + BAND + 3} strokeWidth="2"
                  style={{ stroke: "var(--foreground)" }} />
                <title>{`Predicted ${e.type}: ${utc(e.t_utc)} (solver bracket ${e.solver_bracket_s} s)`}</title>
              </g>
            ))}
          </g>
        );
      })}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={TOP} y2={height - 24} strokeWidth="0.5" strokeDasharray="2 4"
            style={{ stroke: "var(--border)" }} />
          <text x={x(t)} y={height - 8} fontSize="11" textAnchor={t === ticks[ticks.length - 1] && x(t) > W - 30 ? "end" : "middle"}
            style={{ fill: "var(--muted)" }}>
            day {t / 86400}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function IntervalTable({ band }: { band: Band }) {
  return (
    <details className="rounded border border-border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        {band.label ?? targetLabel(band.target)}, {band.sub ?? (band.horizon === "terrain" ? "terrain-aware" : "flat horizon")}: view as table ({band.intervals.length} intervals)
      </summary>
      <div className="overflow-x-auto px-3 pb-3">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-1 pr-3">State</th>
              <th scope="col" className="py-1 pr-3">Start (UTC)</th>
              <th scope="col" className="py-1 pr-3">End (UTC)</th>
              <th scope="col" className="py-1 pr-3">Duration</th>
            </tr>
          </thead>
          <tbody>
            {band.intervals.map((i) => (
              <tr key={`${i.start_s}-${i.class}`} className="border-b border-border/50">
                <th scope="row" className="py-1 pr-3 font-medium">{INTERVAL[i.class].label}</th>
                <td className="py-1 pr-3 tabular-nums">{utc(i.start_utc)}</td>
                <td className="py-1 pr-3 tabular-nums">{utc(i.end_utc)}</td>
                <td className="py-1 pr-3 tabular-nums">{duration(i.end_s - i.start_s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Availability against the requirement: the bound from lower to upper (unresolved time stays
 * visible as the lighter part), with the threshold drawn as a line. Values are the service's.
 */
export function AvailabilityBar({ lower, upper, threshold, label }: { lower: number; upper: number; threshold: number; label: string }) {
  const p = useId().replaceAll(":", "");
  const W2 = 300;
  const x = (f: number) => 4 + f * (W2 - 8);
  const pctS = (f: number) => `${(f * 100).toFixed(1)}%`;
  return (
    <svg viewBox={`0 0 ${W2} 34`} role="img" aria-labelledby={`${p}-t`} className="h-auto w-full max-w-sm">
      <title id={`${p}-t`}>
        {`${label}: availability ${pctS(lower)}${upper > lower ? ` to ${pctS(upper)}` : ""}, requirement at least ${pctS(threshold)}`}
      </title>
      <rect x={x(0)} y={6} width={x(1) - x(0)} height={12} strokeWidth="0.8" style={{ fill: "var(--surface-2)", stroke: "var(--border)" }} />
      <rect x={x(0)} y={6} width={Math.max(x(lower) - x(0), 0)} height={12} style={{ fill: "var(--ok)" }} />
      {upper > lower && (
        <rect x={x(lower)} y={6} width={Math.max(x(upper) - x(lower), 0.5)} height={12} style={{ fill: "var(--warn)" }} opacity={0.6} />
      )}
      <line x1={x(threshold)} x2={x(threshold)} y1={2} y2={22} strokeWidth="2" style={{ stroke: "var(--foreground)" }} />
      <text x={x(threshold)} y={32} fontSize="9" textAnchor={threshold > 0.85 ? "end" : threshold < 0.15 ? "start" : "middle"}
        style={{ fill: "var(--muted)" }}>
        needs {pctS(threshold)}
      </text>
    </svg>
  );
}
