"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { advance, clamp, initialClock, type ClockState, type RunWindow, type SpeedId } from "@/lib/atlas/clock";

/** How often a playing clock commits to React. The scrubber and the readouts do not need 60 frames a second. */
const COMMIT_MS = 100;

export type ClockActions = {
  toggle: () => void;
  setSpeed: (id: SpeedId) => void;
  toggleReverse: () => void;
  toggleLoop: () => void;
  /** Move the cursor to t (seconds since the start), clamped to the window. Playback state is unchanged. */
  seek: (t: number) => void;
};

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * The clock of the loaded run. With no window it does nothing. Under reduced motion playback is off (the scrubber and the
 * event buttons still work). A new window puts the cursor back at its start and pauses.
 */
export function useClock(window_: RunWindow | null): { clock: ClockState; actions: ClockActions; reducedMotion: boolean } {
  const [clock, setClock] = useState<ClockState>(initialClock);
  const [reduced] = useState(prefersReducedMotion);
  const total = window_?.totalS ?? 0;
  const startMs = window_?.startMs;

  // a new window puts the cursor back at its start and pauses (derived state: adjusted during render, not in an effect)
  const windowKey = `${startMs}:${total}`;
  const [seenKey, setSeenKey] = useState(windowKey);
  if (seenKey !== windowKey) {
    setSeenKey(windowKey);
    setClock((c) => ({ ...c, t: 0, playing: false }));
  }

  const playing = clock.playing;

  useEffect(() => {
    if (!playing || total <= 0) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      acc += now - last;
      last = now;
      if (acc >= COMMIT_MS) {
        const dt = acc;
        acc = 0;
        setClock((c) => advance(c, dt, total));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  const toggle = useCallback(() => {
    if (reduced || total <= 0) return;
    setClock((c) => {
      if (c.playing) return { ...c, playing: false };
      // pressing play at an end (with loop off) starts again from the other end
      const atEnd = !c.loop && (c.reverse ? c.t <= 0 : c.t >= total);
      return { ...c, playing: true, t: atEnd ? (c.reverse ? total : 0) : c.t };
    });
  }, [reduced, total]);

  const actions = useMemo<ClockActions>(
    () => ({
      toggle,
      setSpeed: (speed) => setClock((c) => ({ ...c, speed })),
      toggleReverse: () => setClock((c) => ({ ...c, reverse: !c.reverse })),
      toggleLoop: () => setClock((c) => ({ ...c, loop: !c.loop })),
      seek: (t) => setClock((c) => ({ ...c, t: clamp(t, total) })),
    }),
    [toggle, total],
  );

  return { clock, actions, reducedMotion: reduced };
}
