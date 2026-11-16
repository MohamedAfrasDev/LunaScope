"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/atlas/Panel";
import { subLunarPoint } from "@/lib/atlas/earth-orient";
import { PHASES, moonAgeDays, moonDistanceKm, moonIllumination, nextPhaseTime, phaseAngle, phaseName } from "@/lib/atlas/system";

const DAY = 86400000;
const MIN_DATE = "1950-01-01";
const MAX_DATE = "2100-12-31";

/** Dates worth jumping to: the landings the Atlas already knows (mission records), so the sky can be seen as it was. */
const JUMPS = [
  { label: "Apollo 11", date: "1969-07-20" },
  { label: "Apollo 17", date: "1972-12-11" },
  { label: "Chang'e-4", date: "2019-01-03" },
  { label: "IM-1 Odysseus", date: "2024-02-22" },
  { label: "IM-2", date: "2025-03-06" },
];

const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";
const dateOnly = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const deg = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? pos : neg}`;

/**
 * Pick a date and see the Earth, Moon and Sun on it (System scale). The picture and the clock follow the date; these numbers follow the
 * clock, so they change as time plays. All of it comes from a low-precision Sun and Moon series (about half a degree), a display estimate.
 */
export function SystemDatePanel({ utcMs, onPick, onReset, custom }: { utcMs: number; onPick: (startMs: number) => void; onReset: () => void; custom: boolean }) {
  const [text, setText] = useState(() => dateOnly(utcMs));
  const info = useMemo(() => {
    const angle = phaseAngle(utcMs);
    const dist = moonDistanceKm(utcMs);
    const sub = subLunarPoint(utcMs);
    return {
      phase: phaseName(angle),
      lit: Math.round(moonIllumination(utcMs) * 100),
      age: moonAgeDays(angle),
      dist,
      size: Math.round((384400 / dist) * 100),
      sub,
    };
  }, [utcMs]);
  // the next phases move slowly: work them out a few times a day, not at every clock tick
  const slot = Math.floor(utcMs / (6 * 3600000));
  const next = useMemo(
    () => PHASES.map((p) => ({ name: p.name, t: nextPhaseTime(slot * 6 * 3600000, p.angle) })).sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity)),
    [slot],
  );

  const go = (iso: string) => {
    const ms = Date.parse(`${iso}T00:00:00Z`);
    if (Number.isNaN(ms) || iso < MIN_DATE || iso > MAX_DATE) return;
    setText(iso);
    onPick(ms);
  };

  return (
    <Panel title="Pick a date" tag="derived" className="w-full">
      <div className="flex flex-col gap-3 text-sm" data-testid="system-date-panel">
        <label className="atlas-label flex flex-col gap-1 text-[var(--ink-dim)]">
          Date (UTC)
          <input
            type="date"
            value={text}
            min={MIN_DATE}
            max={MAX_DATE}
            onChange={(e) => go(e.target.value)}
            className="rounded border border-[var(--panel-edge)] bg-black px-2 py-1.5 text-[var(--ink)]"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          <button type="button" className="atlas-key atlas-label" onClick={() => go(dateOnly(Date.now()))}>Today</button>
          <button type="button" className="atlas-key atlas-label" onClick={() => go(dateOnly(utcMs - 30 * DAY))}>−30 days</button>
          <button type="button" className="atlas-key atlas-label" onClick={() => go(dateOnly(utcMs + 30 * DAY))}>+30 days</button>
          {JUMPS.map((j) => (
            <button key={j.date} type="button" className="atlas-key atlas-label" onClick={() => go(j.date)} title={j.date}>{j.label}</button>
          ))}
          {custom && <button type="button" className="atlas-key atlas-label" onClick={onReset}>Back to run window</button>}
        </div>

        <div className="border-t border-[var(--panel-edge)] pt-2">
          <p className="atlas-label text-[var(--ink-dim)]">{stamp(utcMs)}</p>
          <p className="text-lg text-[var(--ink)]">{info.phase} · {info.lit}% lit</p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[var(--ink)]">
            <dt className="text-[var(--ink-dim)]">Moon age</dt>
            <dd>{info.age.toFixed(1)} days since New Moon</dd>
            <dt className="text-[var(--ink-dim)]">Distance</dt>
            <dd>{Math.round(info.dist).toLocaleString("en-US")} km ({info.size}% of average size in the sky)</dd>
            <dt className="text-[var(--ink-dim)]">Over the Earth</dt>
            <dd>{deg(info.sub.latDeg, "N", "S")} · {deg(info.sub.lonDeg, "E", "W")}</dd>
          </dl>
        </div>

        <div className="border-t border-[var(--panel-edge)] pt-2">
          <p className="atlas-label text-[var(--ink-dim)]">Next phases</p>
          <ul className="text-[var(--ink)]">
            {next.map((n) => (
              <li key={n.name} className="flex justify-between gap-3">
                <span>{n.name}</span>
                <span className="atlas-number">{n.t ? stamp(n.t) : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="atlas-label text-[var(--ink-dim)]">Display estimate (about half a degree), not a science service result. Press play to watch the month.</p>
      </div>
    </Panel>
  );
}
