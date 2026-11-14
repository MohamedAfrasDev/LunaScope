"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { describeError, getJson } from "@/lib/api/client";
import type {
  CountdownResponse,
  HorizonProfileResponse,
  IntervalRow,
  ResultsResponse,
  SkySeries,
  Target,
} from "@/lib/api/types";
import { degrees, duration, siteLabel, targetLabel } from "@/lib/format";
import { classAt, elevationBand, eventTimes, interpAzEl, nextEvent, prevEvent, skylineAt, variantRange, type VariantRange } from "@/lib/sky";
import { INTERVAL, SITE_STATUS } from "@/lib/status";
import { ResultStateFrame } from "./ResultStateFrame";
import { PolarSky, SkyLegend, UnrolledSky, type Track } from "./SkyPlots";
import { StatusChip } from "./StatusChip";

const TARGETS: Target[] = ["sun_center", "earth_center"];
const SPEEDS = [
  { label: "1 hour per second", v: 3600 },
  { label: "6 hours per second", v: 6 * 3600 },
  { label: "1 day per second", v: 86400 },
];

const reducedQuery = "(prefers-reduced-motion: reduce)";

/** matchMedia is missing in some environments (older or embedded browsers); without it, assume motion is allowed. */
function media(): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(reducedQuery) : null;
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = media();
      m?.addEventListener("change", cb);
      return () => m?.removeEventListener("change", cb);
    },
    () => media()?.matches ?? false,
    () => false,
  );
}

interface Loaded {
  results: ResultsResponse;
  profile: HorizonProfileResponse;
}

function CountdownCard({ runId, siteId, target, t, playing, range }: { runId: string; siteId: string; target: Target; t: number; playing: boolean; range: VariantRange | null }) {
  const [cd, setCd] = useState<CountdownResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // While playing, reuse the last server answer until the cursor passes its event time.
    if (playing && cd && cd.at !== undefined && t >= cd.t && t <= cd.at) return;
    const ctl = new AbortController();
    const timer = setTimeout(
      () =>
        getJson<CountdownResponse>(
          `analyses/${runId}/countdown?site=${encodeURIComponent(siteId)}&target=${target}&horizon=terrain&t=${t.toFixed(1)}`,
          ctl.signal,
        )
          .then((r) => {
            // a reply for a cursor position the user has since left must never replace a newer answer
            if (!ctl.signal.aborted && r.run_id === runId && r.site_id === siteId) {
              setCd(r);
              setErr(null);
            }
          })
          .catch((e) => !(e instanceof DOMException) && setErr(describeError(e))),
      playing ? 0 : 250,
    );
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [runId, siteId, target, t, playing, cd]);

  if (err) return <p className="text-sm text-fail">{err}</p>;
  if (!cd) return <p className="text-sm text-muted">Working out the next change…</p>;
  const fresh = cd.at !== undefined ? t <= cd.at : Math.abs(cd.t - t) < 1;
  const remaining = cd.at !== undefined && t <= cd.at ? cd.at - t : null;
  return (
    <p className="text-sm" aria-live={playing ? "off" : "polite"}>
      {fresh ? "" : "Updating… "}
      {cd.text}
      {remaining !== null && cd.kind !== "in_decision_band" ? <>: in <strong>{duration(remaining)}</strong></> : null}
      {cd.kind === "in_decision_band" && remaining !== null
        ? Math.abs(remaining) < 1
          ? <>: the predicted {cd.event_type} is at this moment</>
          : <>: the predicted {cd.event_type} is {remaining > 0 ? `in ${duration(remaining)}` : `${duration(-remaining)} ago`}</>
        : null}
      {cd.solver_bracket_s != null && cd.kind !== "unknown" ? <span className="text-muted"> (model bracket {cd.solver_bracket_s} s)</span> : null}
      {cd.at !== undefined && cd.kind !== "unknown" ? <TerrainRange range={range} /> : null}
    </p>
  );
}

/** The countdown's spread across the terrain variants: a different skyline can move the event, so say by how much. */
function TerrainRange({ range }: { range: VariantRange | null }) {
  if (range === null)
    return <span className="block text-xs text-muted">No sensitivity check was run, so no range across terrain variants is shown.</span>;
  return (
    <span className="block text-xs text-muted">
      {range.maxShiftS < 1
        ? `Across ${range.variants} terrain variant${range.variants === 1 ? "" : "s"} (finer azimuth step, other DEM release) this time does not move.`
        : `Across ${range.variants} terrain variant${range.variants === 1 ? "" : "s"} (finer azimuth step, other DEM release) this time moves by up to ${duration(range.maxShiftS)}.`}
      {range.countChanged ? " At least one variant finds a different number of events here, so treat this prediction as sensitive to the terrain." : ""}
    </span>
  );
}

export function SkyView({ runId, siteId }: { runId: string; siteId: string }) {
  const uid = useId();
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(SPEEDS[1].v);
  const [view, setView] = useState<"polar" | "unrolled">("polar");
  const reduced = useReducedMotion();
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    Promise.all([
      getJson<ResultsResponse>(`analyses/${runId}/results?site=${encodeURIComponent(siteId)}&include=intervals,events,series`, ctl.signal),
      getJson<HorizonProfileResponse>(`analyses/${runId}/horizon/${encodeURIComponent(siteId)}`, ctl.signal),
    ])
      .then(([results, profile]) => !ctl.signal.aborted && results.run_id === runId && setData({ results, profile }))
      .catch((e) => !(e instanceof DOMException) && !ctl.signal.aborted && setErr(describeError(e)));
    return () => ctl.abort();
  }, [runId, siteId]);

  const site = data?.results.sites[0];
  const tracks = useMemo(() => {
    if (!site) return [];
    return TARGETS.flatMap((target) => {
      const m = site.target_metrics[target];
      const series = m?.series;
      const intervals = m?.terrain?.intervals;
      return series && intervals ? [{ target, series, intervals }] : [];
    });
  }, [site]);
  const total = tracks[0]?.intervals[tracks[0].intervals.length - 1]?.end_s ?? 0;
  const events = useMemo(
    () => eventTimes(TARGETS.map((x) => site?.target_metrics[x]?.terrain?.events ?? [])),
    [site],
  );
  const band = useMemo(
    () => (data ? elevationBand(data.profile.horizon_el_deg, tracks.map((x) => x.series.el_deg)) : { min: -5, max: 10 }),
    [data, tracks],
  );

  // Playback: display only; it advances the cursor and never computes anything about visibility.
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT((prev) => {
        const next = Math.min(prev + dt * speed, total);
        if (next >= total) setPlaying(false);
        return next;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [playing, speed, total]);

  const jump = useCallback((to: number | null) => {
    if (to !== null) {
      setPlaying(false);
      setT(to);
    }
  }, []);

  const startMs = tracks[0] ? Date.parse(tracks[0].intervals[0].start_utc) : 0;
  const clock = (s: number) => new Date(startMs + s * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";

  if (err)
    return (
      <div className="grid gap-3">
        <Link href={`/runs/${runId}`} className="text-sm text-accent underline underline-offset-4">← Back to the status matrix</Link>
        <p role="alert" className="rounded-md border border-fail/40 bg-fail-soft px-3 py-2 text-fail">{err}</p>
      </div>
    );
  if (!data || !site || tracks.length === 0)
    return <p className="text-muted">Loading the local sky…</p>;

  const cursors: Track[] = tracks.map((x) => ({ ...x, cursor: interpAzEl(x.series, t) }));
  const sp = SITE_STATUS[site.site_status];
  const desc =
    `Terrain skyline from ${data.profile.skyline_min_deg.toFixed(1)}° to ${data.profile.skyline_max_deg.toFixed(1)}° elevation. ` +
    tracks.map((x) => `${targetLabel(x.target)} track from azimuth ${x.series.az_deg[0].toFixed(0)}° to ${x.series.az_deg[x.series.az_deg.length - 1].toFixed(0)}°, ` +
      `elevation ${Math.min(...x.series.el_deg).toFixed(1)}° to ${Math.max(...x.series.el_deg).toFixed(1)}°.`).join(" ") +
    ` ${events.length} predicted rise or set event(s).`;
  const title = `Local sky for ${siteLabel(siteId)}`;

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || e.target !== e.currentTarget) return;
    if (e.key === " " && !reduced) setPlaying((p) => !p);
    else if (e.key === ".") jump(nextEvent(events, t));
    else if (e.key === ",") jump(prevEvent(events, t));
    else if (e.key === "ArrowRight") jump(Math.min(t + 600, total));
    else if (e.key === "ArrowLeft") jump(Math.max(t - 600, 0));
    else return;
    e.preventDefault();
  };

  const rows = [] as { t: number; cells: { target: Target; az: number; el: number; cls: string }[] }[];
  for (let s = 0; s <= total; s += 6 * 3600)
    rows.push({ t: s, cells: tracks.map((x) => { const p = interpAzEl(x.series, s); return { target: x.target, ...p, cls: classAt(x.intervals, s) ?? "?" }; }) });

  const csv = () => {
    const lines = ["time_utc,target,azimuth_deg,elevation_deg,state"];
    for (const x of tracks)
      x.series.az_deg.forEach((az, i) => lines.push(`${clock(i * x.series.step_s)},${x.target},${az},${x.series.el_deg[i]},${classAt(x.intervals, i * x.series.step_s)}`));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lunascope-${siteId}-sky.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6">
      <Link href={`/runs/${runId}`} className="text-sm text-accent underline underline-offset-4">← Back to the status matrix</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Local sky: {siteLabel(siteId)}</h1>
        <StatusChip p={sp} title={sp.help} />
        <Link href={`/runs/${runId}/timeline/${encodeURIComponent(siteId)}`} className="text-sm text-accent underline underline-offset-4">
          Timeline
        </Link>
      </div>

      <ResultStateFrame state={site.result_state}>
        <div className="grid gap-6">
          <fieldset className="flex flex-wrap items-center gap-4 text-sm">
            <legend className="sr-only">Sky view</legend>
            <span className="font-medium">View</span>
            {(["polar", "unrolled"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name={`${uid}-view`} checked={view === v} onChange={() => setView(v)} />
                {v === "polar" ? "Polar (north up)" : "Unrolled (azimuth across)"}
              </label>
            ))}
          </fieldset>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div>
              {view === "polar" ? (
                <PolarSky profile={data.profile} tracks={cursors} band={band} title={title} desc={desc} />
              ) : (
                <UnrolledSky profile={data.profile} tracks={cursors} band={band} title={title} desc={desc} />
              )}
              <div className="mt-2"><SkyLegend /></div>
              <p className="mt-2 text-xs text-muted">
                Hatched ground is the terrain skyline from the elevation data; the dashed circle or line is the flat 0°
                horizon. A target is visible only where it is above the skyline, which the service decides, not this
                picture. Elevation rings are 5° apart.
              </p>
            </div>

            <div className="grid content-start gap-4">
              <div className="rounded border border-border p-3 text-sm">
                <h2 className="font-semibold">At the cursor</h2>
                <p className="tabular-nums" aria-live={playing ? "off" : "polite"}>{clock(t)}</p>
                <p className="text-xs text-muted">Day {(t / 86400).toFixed(2)} of {(total / 86400).toFixed(0)}</p>
              </div>
              {cursors.map((c) => {
                const cls = classAt(c.intervals, t);
                const skyline = skylineAt(data.profile, c.cursor.az);
                return (
                  <section key={c.target} aria-label={`${targetLabel(c.target)} at the cursor`} className="rounded border border-border p-3 text-sm">
                    <h2 className="font-semibold">{targetLabel(c.target)}</h2>
                    <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
                      <dt className="text-muted">Azimuth</dt><dd className="tabular-nums">{c.cursor.az.toFixed(2)}°</dd>
                      <dt className="text-muted">Elevation</dt><dd className="tabular-nums">{degrees(c.cursor.el)}</dd>
                      <dt className="text-muted">Skyline there</dt>
                      <dd className="tabular-nums">{skyline === null ? "unknown (no terrain data)" : degrees(skyline)}</dd>
                      <dt className="text-muted">State</dt>
                      <dd>{cls ? INTERVAL[cls].label : "outside the window"}</dd>
                    </dl>
                    <div className="mt-2 border-t border-border pt-2">
                      <CountdownCard runId={runId} siteId={siteId} target={c.target} t={t} playing={playing} range={variantRange(site?.sensitivity, c.target)} />
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          <div role="group" tabIndex={0} onKeyDown={onKey}
            aria-label="Time player. With this group focused: Space plays or pauses, comma and period jump to the previous or next event, left and right arrows step ten minutes."
            aria-keyshortcuts="Space , . ArrowLeft ArrowRight"
            className="grid gap-3 rounded-lg border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={reduced} onClick={() => (t >= total && setT(0), setPlaying((p) => !p))}
                className="rounded border border-border bg-surface px-3 py-2 text-sm font-medium disabled:opacity-50">
                {playing ? "Pause" : "Play"}
              </button>
              <button type="button" onClick={() => jump(prevEvent(events, t))} disabled={prevEvent(events, t) === null}
                className="rounded border border-border bg-surface px-3 py-2 text-sm disabled:opacity-50">
                Previous event
              </button>
              <button type="button" onClick={() => jump(nextEvent(events, t))} disabled={nextEvent(events, t) === null}
                className="rounded border border-border bg-surface px-3 py-2 text-sm disabled:opacity-50">
                Next event
              </button>
              <label className="flex items-center gap-2 text-sm">
                Speed
                <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
                  className="rounded border border-border bg-surface px-2 py-1">
                  {SPEEDS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
              </label>
            </div>
            {reduced && (
              <p className="text-xs text-muted">Your system asks for reduced motion, so playback is off. Use the slider and the event buttons.</p>
            )}
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Time (UTC)</span>
              <input type="range" min={0} max={total} step={60} value={Math.round(t)}
                aria-valuetext={clock(t)}
                onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} />
              <span className="flex justify-between text-xs text-muted tabular-nums"><span>{clock(0)}</span><span>{clock(total)}</span></span>
            </label>
          </div>

          <details className="rounded border border-border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">View sky positions as a table (every 6 hours)</summary>
            <div className="overflow-x-auto px-3 pb-3">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-1 pr-3">Time (UTC)</th>
                    {tracks.map((x) => <th key={x.target} scope="col" className="py-1 pr-3">{targetLabel(x.target)}: azimuth, elevation, state</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.t} className="border-b border-border/50">
                      <th scope="row" className="py-1 pr-3 font-normal tabular-nums">{clock(r.t)}</th>
                      {r.cells.map((c) => (
                        <td key={c.target} className="py-1 pr-3 tabular-nums">
                          {c.az.toFixed(1)}°, {degrees(c.el)}, {c.cls in INTERVAL ? INTERVAL[c.cls as keyof typeof INTERVAL].label : c.cls}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={csv} className="mt-3 rounded border border-border px-3 py-2 text-sm font-medium">
                Download all positions (CSV)
              </button>
            </div>
          </details>
        </div>
      </ResultStateFrame>
    </div>
  );
}

export type { SkySeries, IntervalRow };
