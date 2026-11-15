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

export function AmbientToggle() {
  // localStorage is the source of truth; the server render (and first paint) assumes "running".
  const paused = useSyncExternalStore(subscribe, read, () => false);

  useEffect(() => {
    if (paused) document.documentElement.dataset.motion = "paused";
    else delete document.documentElement.dataset.motion;
  }, [paused]);

  function toggle() {
    try {
      if (!paused) localStorage.setItem(KEY, "paused");
      else localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable: nothing to remember */
    }
    listeners.forEach((fn) => fn());
  }

  return (
    <Button type="button" variant="ghost" size="sm" aria-pressed={paused} onClick={toggle} className="text-muted-foreground">
      {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
      {paused ? "Resume background motion" : "Pause background motion"}
    </Button>
  );
}
