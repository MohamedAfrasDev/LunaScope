"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { DataStatusPill } from "@/components/DataStatusBanner";
import { Tag } from "@/components/atlas/Tag";
import type { ClockActions } from "@/components/atlas/useClock";
import {
  elapsedLabel,
  eventBefore,
  nextEventAfter,
  parseUtcInput,
  SPEEDS,
  statusLine,
  utcInputValue,
  utcLabel,
  type ClockState,
  type RunWindow,
} from "@/lib/atlas/clock";
import { CREDIT_TEXT } from "@/lib/explore/geometry";

export type DockRun =
  | { kind: "loading"; text: string }
  | { kind: "error"; text: string; retry?: () => void }
  | {
      kind: "ready";
      window: RunWindow;
      /** Event times the Next and Previous buttons jump between, in seconds since the start. */
      events: number[];
      /** Whose events they are, in words ("this site", "any site in the run"). */
      eventScope: string;
      label: string;
      synthetic: boolean;
    };

function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}
/** Elements that already use Space or Enter themselves. */
function pressable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el?.tagName && (["BUTTON", "A", "SUMMARY"].includes(el.tagName) || typing(t));
}

/**
 * The time dock (spec 4 and 6): play, speed, reverse, loop, previous and next event, a scrubber, a go-to date, and the data
 * status. It only moves a cursor through a finished run: every value that follows the clock was computed by the science service.
 * With no run, or a failed one, every clock control is off and the dock says why. Under reduced motion playback is off, and the
 * scrubber and event buttons still work.
 */
export function TimeDock({
  run,
  clock,
  actions,
  reducedMotion,
  compact = false,
}: {
  /** Phone width: the play button, the scrubber and the time stay; the rest folds behind More controls. */
  compact?: boolean;
  run: DockRun;
  clock: ClockState;
  actions: ClockActions;
  reducedMotion: boolean;
}) {
  const uid = useId();
  const ready = run.kind === "ready";
  const win = ready ? run.window : null;
  const events = ready ? run.events : [];
  // the go-to field holds what the person typed until the cursor moves (then it follows the cursor again). It must not reset on
  // blur: pressing Go blurs the field first, and the typed time has to survive until the form is submitted.
  const [typed, setTyped] = useState<{ value: string; at: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const goto = typed && typed.at === clock.t ? typed.value : win ? utcInputValue(win, clock.t) : "";

  const next = () => {
    const t = nextEventAfter(events, clock.t);
    if (t == null) return setMsg("No event before the end of the window.");
    setMsg(null);
    actions.seek(t);
  };
  const prev = () => {
    const t = eventBefore(events, clock.t);
    if (t == null) return setMsg("No event before this time in the window.");
    setMsg(null);
    actions.seek(t);
  };

  useEffect(() => {
    if (!ready) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      if (e.key === " " && !pressable(e.target)) {
        e.preventDefault();
        actions.toggle();
      } else if (e.key === ".") next();
      else if (e.key === ",") prev();
      else if (e.key === "]" || e.key === "[") {
        const i = SPEEDS.findIndex((s) => s.id === clock.speed);
        const n = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, i + (e.key === "]" ? 1 : -1)))];
        actions.setSpeed(n.id);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // next and prev read the latest cursor, so the listener is rebuilt with it
  });

  function onGo(e: React.FormEvent) {
    e.preventDefault();
    if (!win) return;
    const r = parseUtcInput(win, goto);
    if (!r.ok) return setMsg(r.reason);
    setMsg(null);
    setTyped(null);
    actions.seek(r.t);
  }

  const [more, setMore] = useState(false);
  const status = ready ? statusLine(clock) : run.text;
  const off = !ready;

  const groups = (
    <>
      <div role="group" aria-label="Speed, per second of real time" className="flex flex-wrap items-center gap-0.5">
          {SPEEDS.map((s) => (
            <button key={s.id} type="button" disabled={off} aria-pressed={clock.speed === s.id} onClick={() => actions.setSpeed(s.id)} className="atlas-key atlas-label">
              {s.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Direction and loop" className="flex items-center gap-0.5">
          <button type="button" disabled={off} aria-pressed={clock.reverse} onClick={actions.toggleReverse} className="atlas-key atlas-label">
            Reverse
          </button>
          <button type="button" disabled={off} aria-pressed={clock.loop} onClick={actions.toggleLoop} className="atlas-key atlas-label">
            Loop
          </button>
        </div>
        <div role="group" aria-label={`Events of ${ready ? run.eventScope : "the run"}`} className="flex items-center gap-0.5">
          <button type="button" disabled={off} onClick={prev} className="atlas-key atlas-label" aria-keyshortcuts=",">
            Previous event
          </button>
          <button type="button" disabled={off} onClick={next} className="atlas-key atlas-label" aria-keyshortcuts=".">
            Next event
          </button>
        </div>

    </>
  );

  return (
    <section aria-label="Time dock" className="atlas-panel px-3 py-2" data-testid="time-dock" data-playing={clock.playing}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" onKeyDown={undefined}>
        <button
          type="button"
          disabled={off || reducedMotion}
          onClick={actions.toggle}
          aria-label={off ? "Play (no run is loaded)" : clock.playing ? "Pause" : "Play"}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[var(--void)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--select)] disabled:opacity-40"
        >
          {clock.playing ? <Pause aria-hidden="true" className="size-4 fill-current" /> : <Play aria-hidden="true" className="size-4 fill-current" />}
        </button>
        <p role="status" className={`atlas-label min-w-0 text-[var(--ink-dim)] ${compact ? "flex-1" : ""}`} data-testid="dock-status">
          {status}
        </p>
        {run.kind === "error" && run.retry && (
          <button type="button" className="atlas-key atlas-label border-[var(--panel-edge)]" onClick={run.retry}>
            Try again
          </button>
        )}
        {compact && (
          <button type="button" className="atlas-key atlas-label shrink-0" aria-expanded={more} aria-controls={`${uid}-more`} onClick={() => setMore((m) => !m)} disabled={off}>
            {more ? "Fewer" : "More"}
          </button>
        )}

        {!compact && groups}
        <div className="flex min-w-48 flex-1 items-center gap-3">
          <input
            type="range"
            disabled={off}
            aria-label="Time (UTC)"
            aria-valuetext={win ? utcLabel(win, clock.t) : undefined}
            className="min-w-24 flex-1 accent-[var(--select)]"
            min={0}
            max={win ? win.totalS : 100}
            step={60}
            value={win ? Math.min(clock.t, win.totalS) : 0}
            onChange={(e) => actions.seek(Number(e.target.value))}
            onKeyDown={(e) => {
              // arrows move ten minutes (an hour with Shift), as the spec says; the browser default of one step is too fine
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
              e.preventDefault();
              const dir = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 1;
              actions.seek(clock.t + dir * (e.shiftKey ? 3600 : 600));
            }}
          />
          <span className="atlas-number shrink-0 text-xs text-[var(--ink-dim)]" data-testid="dock-elapsed">
            {ready ? elapsedLabel(clock.t) : ""}
          </span>
        </div>
      </div>

      {compact && (
        <div id={`${uid}-more`} hidden={!more} className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {groups}
        </div>
      )}

      {ready && win && (!compact || more) && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-[var(--ink-dim)]">
          <form onSubmit={onGo} noValidate className="flex flex-wrap items-center gap-2" aria-label="Go to a time">
            <label htmlFor={`${uid}-goto`} className="atlas-label">
              Go to (UTC)
            </label>
            <input
              id={`${uid}-goto`}
              type="datetime-local"
              value={goto}
              min={utcInputValue(win, 0)}
              max={utcInputValue(win, win.totalS)}
              onChange={(e) => setTyped({ value: e.target.value, at: clock.t })}
              className="atlas-number h-8 rounded border border-[var(--input)] bg-[var(--void)] px-2 text-xs text-[var(--ink)] [color-scheme:dark]"
            />
            <button type="submit" className="atlas-key atlas-label border-[var(--panel-edge)]">
              Go
            </button>
          </form>
          <span className="atlas-number">
            {utcLabel(win, 0)} <span aria-hidden="true">→</span> {utcLabel(win, win.totalS)}
          </span>
        </div>
      )}

      <p role="status" aria-live="polite" className="atlas-prose mt-1 min-h-5 text-xs text-[var(--ink)]">
        {msg ?? (reducedMotion && ready ? "Playback is off because your system asks for reduced motion. The slider and the event buttons still work." : "")}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--panel-edge)] pt-2">
        <DataStatusPill />
        {ready && (
          <span className="atlas-label flex items-center gap-2 text-[var(--ink-dim)]">
            Run {run.label}
            {run.synthetic && <Tag kind="synthetic" />}
          </span>
        )}
        <p className={`atlas-prose min-w-0 flex-1 text-[var(--ink-dim)] ${compact ? "basis-full text-[0.6875rem] leading-snug" : "text-xs"}`}>{CREDIT_TEXT}</p>
      </div>
    </section>
  );
}
