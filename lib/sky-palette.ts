"use client";

import { useSyncExternalStore } from "react";

/**
 * The 3D sky's colours come from the same design tokens as the rest of the interface (galaxy G9), read from the
 * stylesheet at the moment the scene is built, so the scene follows the theme: the night palette in dark, the lunar-day
 * palette in light. The fallbacks are the night values and are used only where there is no stylesheet (tests).
 */
export type SkyPalette = {
  background: string;
  ground: string;
  wall: string;
  ridge: string;
  horizonRing: string;
  ring: string;
  label: string;
  labelNorth: string;
  labelStroke: string;
  pin: string;
  sun: string;
  earth: string;
};

const MAP: Record<keyof SkyPalette, [token: string, fallback: string]> = {
  background: ["--background", "#0b1020"],
  ground: ["--card", "#111830"],
  wall: ["--accent", "#212b57"],
  ridge: ["--foreground", "#e9edfa"],
  horizonRing: ["--muted-foreground", "#a9b2d3"],
  ring: ["--border", "#2a3560"],
  label: ["--foreground", "#e9edfa"],
  labelNorth: ["--sun", "#f4c873"],
  labelStroke: ["--background", "#0b1020"],
  pin: ["--foreground", "#e9edfa"],
  sun: ["--sun", "#f4c873"],
  earth: ["--earth", "#86b8ff"],
};

export function readSkyPalette(scope?: Element | null): SkyPalette {
  const cs = typeof document !== "undefined" ? getComputedStyle(scope ?? document.documentElement) : null;
  const out = {} as SkyPalette;
  for (const [key, [token, fallback]] of Object.entries(MAP) as [keyof SkyPalette, [string, string]][]) {
    const v = cs?.getPropertyValue(token).trim();
    out[key] = v || fallback;
  }
  return out;
}

const QUERY = "(prefers-color-scheme: light)";

/** "light" or "dark" as the system says; the scene is rebuilt when it changes. The server and first paint say "dark". */
export function useColorScheme(): "light" | "dark" {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia?.(QUERY);
      mql?.addEventListener?.("change", cb);
      return () => mql?.removeEventListener?.("change", cb);
    },
    () => (window.matchMedia?.(QUERY).matches ? "light" : "dark"),
    () => "dark",
  );
}
