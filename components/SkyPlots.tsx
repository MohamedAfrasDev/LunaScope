import { useId } from "react";
import type { HorizonProfileResponse, IntervalClass, IntervalRow, SkySeries, Target } from "@/lib/api/types";
import { targetLabel } from "@/lib/format";
import { INTERVAL } from "@/lib/status";
import { polar, runsByClass, wrap360 } from "@/lib/sky";

export interface Track {
  target: Target;
  series: SkySeries;
  intervals: IntervalRow[]; // terrain-aware classification, decided by the service
  cursor: { az: number; el: number };
}

export interface Band {
  min: number;
  max: number;
}

/** State is carried by the stroke pattern; Sun and Earth by hue AND marker shape AND a label. */
const DASH: Record<IntervalClass | "none", string | undefined> = {
  V: undefined,
  H: "1.5 4",
  U: "7 3",
  X: "7 3 1.5 3",
  G: "2 6",
  none: "1 1",
};
const WIDTH: Record<IntervalClass | "none", number> = { V: 2.6, H: 1.8, U: 2.2, X: 2.2, G: 1.6, none: 1 };
const HUE: Record<Target, string> = { sun_center: "var(--warn)", earth_center: "var(--info)" };

function Marker({ target, x, y }: { target: Target; x: number; y: number }) {
  return target === "sun_center" ? (
    <g>
      <circle cx={x} cy={y} r={6} style={{ fill: HUE[target], stroke: "var(--foreground)" }} strokeWidth={1.2} />
      <text x={x + 9} y={y - 7} fontSize="10" style={{ fill: "var(--foreground)" }}>Sun</text>
    </g>
  ) : (
    <g>
      <rect x={x - 5} y={y - 5} width={10} height={10} transform={`rotate(45 ${x} ${y})`}
        style={{ fill: "var(--surface)", stroke: HUE[target] }} strokeWidth={2.4} />
      <text x={x + 9} y={y + 14} fontSize="10" style={{ fill: "var(--foreground)" }}>Earth</text>
    </g>
  );
}

export function SkyLegend() {
  const items: [IntervalClass, string][] = [
    ["V", "visible"],
    ["H", "hidden"],
    ["U", "unresolved band"],
    ["X", "uncertified"],
    ["G", "no data"],
  ];
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
      {items.map(([k, label]) => (
        <li key={k} className="flex items-center gap-1.5">
          <svg width="34" height="10" aria-hidden="true">
            <line x1="2" x2="32" y1="5" y2="5" strokeWidth={WIDTH[k]} strokeDasharray={DASH[k]} strokeLinecap="round"
              style={{ stroke: "var(--foreground)" }} />
          </svg>
          {label} <span className="sr-only">({INTERVAL[k].label})</span>
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" style={{ fill: HUE.sun_center, stroke: "var(--foreground)" }} /></svg>
        Sun (orange)
      </li>
      <li className="flex items-center gap-1.5">
        <svg width="14" height="14" aria-hidden="true"><rect x="3" y="3" width="8" height="8" transform="rotate(45 7 7)" strokeWidth="2" style={{ fill: "var(--surface)", stroke: HUE.earth_center }} /></svg>
        Earth (blue)
      </li>
    </ul>
  );
}

function Patterns({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`${id}-terrain`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" style={{ fill: "var(--surface-2)" }} />
        <line x1="0" y1="0" x2="0" y2="7" strokeWidth="2.2" style={{ stroke: "var(--border)" }} />
      </pattern>
      <pattern id={`${id}-unknown`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" style={{ fill: "var(--surface)" }} />
        <circle cx="3" cy="3" r="1.1" style={{ fill: "var(--muted)" }} />
      </pattern>
    </defs>
  );
}

/** Contiguous runs of known skyline bins as [startIndex, endIndex] pairs (circular joins are split). */
function knownRuns(vals: (number | null)[]): [number, number][] {
  const runs: [number, number][] = [];
  let s = -1;
  for (let i = 0; i <= vals.length; i++) {
    const ok = i < vals.length && vals[i] != null;
    if (ok && s < 0) s = i;
    if (!ok && s >= 0) {
      runs.push([s, i - 1]);
      s = -1;
    }
  }
  return runs;
}

const f = (n: number) => n.toFixed(1);

export function PolarSky({ profile, tracks, band, title, desc }: {
  profile: HorizonProfileResponse;
  tracks: Track[];
  band: Band;
  title: string;
  desc: string;
}) {
  const id = useId().replaceAll(":", "");
  const R = 108;
  const P = (az: number, el: number) => polar(az, el, band, R);
  const n = profile.azimuth_deg.length;
  const allKnown = profile.horizon_el_deg.every((v) => v != null);
  const pt = (i: number) => P(profile.azimuth_deg[i], profile.horizon_el_deg[i] as number);
  const rings: number[] = [];
  for (let e = band.min; e <= band.max; e += 5) rings.push(e);
  const r0 = P(0, 0);
  const flatR = Math.hypot(r0.x, r0.y);
  const runs = knownRuns(profile.horizon_el_deg);

  return (
    <svg viewBox="-135 -135 270 270" role="img" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} className="h-auto w-full max-w-[34rem]">
      <title id={`${id}-t`}>{title}</title>
      <desc id={`${id}-d`}>{desc}</desc>
      <Patterns id={id} />
      <circle r={R} style={{ fill: "var(--surface)", stroke: "var(--border)" }} strokeWidth={1} />
      {rings.filter((e) => e !== 0).map((e) => {
        const r = Math.hypot(P(0, e).x, P(0, e).y);
        return (
          <g key={e}>
            <circle r={r} fill="none" strokeWidth={0.5} style={{ stroke: "var(--border)" }} />
            <text x={2} y={-r - 1} fontSize="6.5" style={{ fill: "var(--muted)" }}>{e}°</text>
          </g>
        );
      })}
      {/* terrain: everything below the skyline is blocked */}
      {allKnown ? (
        <path d={`M${Array.from({ length: n }, (_, i) => { const p = pt(i); return `${f(p.x)},${f(p.y)}`; }).join("L")}Z`}
          fill={`url(#${id}-terrain)`} strokeWidth={1.6} style={{ stroke: "var(--foreground)" }} />
      ) : (
        <>
          <circle r={R} fill={`url(#${id}-unknown)`} />
          {runs.map(([a, b]) => (
            <path key={a} d={`M0,0L${Array.from({ length: b - a + 1 }, (_, k) => { const p = pt(a + k); return `${f(p.x)},${f(p.y)}`; }).join("L")}Z`}
              fill={`url(#${id}-terrain)`} strokeWidth={1.6} style={{ stroke: "var(--foreground)" }} />
          ))}
        </>
      )}
      {/* flat 0 degree horizon for comparison */}
      <circle r={flatR} fill="none" strokeWidth={1.2} strokeDasharray="4 3" style={{ stroke: "var(--accent)" }} />
      <text x={flatR + 2} y={-2} fontSize="6.5" style={{ fill: "var(--accent)" }}>0° flat horizon</text>
      {/* compass */}
      {([["N", 0], ["E", 90], ["S", 180], ["W", 270]] as const).map(([l, a]) => {
        const p = polar(a, band.max, band, R + 11);
        return <text key={l} x={p.x} y={p.y + 3} textAnchor="middle" fontSize="9" fontWeight="600" style={{ fill: "var(--foreground)" }}>{l}</text>;
      })}
      {/* tracks, styled by the service's classification */}
      {tracks.map((tr) =>
        runsByClass(tr.series, tr.intervals).map((run, k) => {
          const c = run.cls ?? "none";
          return (
            <polyline key={`${tr.target}-${k}`} fill="none" strokeLinecap="round" strokeLinejoin="round"
              strokeWidth={WIDTH[c]} strokeDasharray={DASH[c]} style={{ stroke: HUE[tr.target] }}
              points={run.idx.map((i) => { const p = P(tr.series.az_deg[i], tr.series.el_deg[i]); return `${f(p.x)},${f(p.y)}`; }).join(" ")} />
          );
        }),
      )}
      {tracks.map((tr) => {
        const p = P(tr.cursor.az, tr.cursor.el);
        return <Marker key={tr.target} target={tr.target} x={p.x} y={p.y} />;
      })}
    </svg>
  );
}

export function UnrolledSky({ profile, tracks, band, title, desc }: {
  profile: HorizonProfileResponse;
  tracks: Track[];
  band: Band;
  title: string;
  desc: string;
}) {
  const id = useId().replaceAll(":", "");
  const W = 720, H = 300, L = 44, RGT = 12, T = 12, B = 30;
  const X = (az: number) => L + (wrap360(az) / 360) * (W - L - RGT);
  const Y = (el: number) => T + (1 - (el - band.min) / (band.max - band.min)) * (H - T - B);
  const n = profile.azimuth_deg.length;
  const runs = knownRuns(profile.horizon_el_deg);
  const ticks: number[] = [];
  for (let e = band.min; e <= band.max; e += 5) ticks.push(e);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} className="h-auto w-full">
      <title id={`${id}-t`}>{title}</title>
      <desc id={`${id}-d`}>{desc}</desc>
      <Patterns id={id} />
      <rect x={L} y={T} width={W - L - RGT} height={H - T - B} style={{ fill: "var(--surface)", stroke: "var(--border)" }} />
      {profile.horizon_el_deg.some((v) => v == null) && (
        <rect x={L} y={T} width={W - L - RGT} height={H - T - B} fill={`url(#${id}-unknown)`} />
      )}
      {ticks.map((e) => (
        <g key={e}>
          <line x1={L} x2={W - RGT} y1={Y(e)} y2={Y(e)} strokeWidth={e === 0 ? 1.2 : 0.5}
            strokeDasharray={e === 0 ? "4 3" : undefined} style={{ stroke: e === 0 ? "var(--accent)" : "var(--border)" }} />
          <text x={L - 6} y={Y(e) + 3} fontSize="10" textAnchor="end" style={{ fill: e === 0 ? "var(--accent)" : "var(--muted)" }}>{e}°</text>
        </g>
      ))}
      {[0, 45, 90, 135, 180, 225, 270, 315, 360].map((a) => (
        <g key={a}>
          <line x1={X(a === 360 ? 359.999 : a)} x2={X(a === 360 ? 359.999 : a)} y1={T} y2={H - B} strokeWidth={0.4} strokeDasharray="2 4" style={{ stroke: "var(--border)" }} />
          <text x={X(a === 360 ? 359.999 : a)} y={H - 12} fontSize="10" textAnchor="middle" style={{ fill: "var(--muted)" }}>
            {a === 0 || a === 360 ? "N" : a === 90 ? "E" : a === 180 ? "S" : a === 270 ? "W" : `${a}°`}
          </text>
        </g>
      ))}
      <text x={(L + W - RGT) / 2} y={H - 1} fontSize="10" textAnchor="middle" style={{ fill: "var(--muted)" }}>azimuth, clockwise from north</text>
      {/* blocked region under the skyline */}
      {runs.map(([a, b]) => {
        const pts = Array.from({ length: b - a + 1 }, (_, k) => `${f(X(profile.azimuth_deg[a + k]))},${f(Y(profile.horizon_el_deg[a + k] as number))}`);
        const x1 = f(X(profile.azimuth_deg[b])), x0 = f(X(profile.azimuth_deg[a]));
        return (
          <g key={a}>
            <polygon points={`${x0},${H - B} ${pts.join(" ")} ${x1},${H - B}`} fill={`url(#${id}-terrain)`} />
            <polyline points={pts.join(" ")} fill="none" strokeWidth={1.6} style={{ stroke: "var(--foreground)" }} />
          </g>
        );
      })}
      {/* tracks: split where azimuth wraps through north */}
      {tracks.map((tr) =>
        runsByClass(tr.series, tr.intervals).flatMap((run, k) => {
          const segs: number[][] = [[]];
          run.idx.forEach((i, j) => {
            const prev = j > 0 ? tr.series.az_deg[run.idx[j - 1]] : tr.series.az_deg[i];
            if (j > 0 && Math.abs(tr.series.az_deg[i] - prev) > 180) segs.push([]);
            segs[segs.length - 1].push(i);
          });
          const c = run.cls ?? "none";
          return segs.filter((s) => s.length > 1).map((s, q) => (
            <polyline key={`${tr.target}-${k}-${q}`} fill="none" strokeLinecap="round" strokeWidth={WIDTH[c]}
              strokeDasharray={DASH[c]} style={{ stroke: HUE[tr.target] }}
              points={s.map((i) => `${f(X(tr.series.az_deg[i]))},${f(Y(tr.series.el_deg[i]))}`).join(" ")} />
          ));
        }),
      )}
      {tracks.map((tr) => (
        <Marker key={tr.target} target={tr.target} x={X(tr.cursor.az)} y={Y(tr.cursor.el)} />
      ))}
      <text x={L + 4} y={T + 12} fontSize="10" style={{ fill: "var(--muted)" }}>
        hatched: terrain blocks the sky ({n} azimuth bins)
      </text>
    </svg>
  );
}

export const trackName = targetLabel;
