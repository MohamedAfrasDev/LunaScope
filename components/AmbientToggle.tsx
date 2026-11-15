"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const KEY = "lunascope.motion";

/**
 * The always-visible "Pause animation" control for the slow background drift. The choice is remembered in the
 * browser and applied as data-motion on <html>, which the stylesheet reads. With reduced motion the drift never
 * runs, whatever this says.
 */
const listeners = new Set<() => void>();
function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "paused";
  } catch {
    return false;
  }
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** True when the user paused the background motion. The server render (and first paint) assumes "running". */
export function useAmbientPaused(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

/** Pause or resume the background motion (also reachable from the command palette). */
export function toggleAmbient(): void {
  try {
    if (!read()) localStorage.setItem(KEY, "paused");
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: nothing to remember */
  }
  listeners.forEach((fn) => fn());
}

export function AmbientToggle() {
  const paused = useAmbientPaused();

  useEffect(() => {
    if (paused) document.documentElement.dataset.motion = "paused";
    else delete document.documentElement.dataset.motion;
  }, [paused]);

  return (
    <Button type="button" variant="ghost" size="sm" aria-pressed={paused} onClick={toggleAmbient} className="text-muted-foreground">
      {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
      {paused ? "Resume background motion" : "Pause background motion"}
    </Button>
  );
}
