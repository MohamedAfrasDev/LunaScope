"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";
import type { TerrainPatch } from "@/lib/atlas/terrain";

export type TerrainLoad =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unavailable" } // no terrain to draw (replay copy, no data, slow): the sky falls back to the skyline wall
  | { status: "ready"; patch: TerrainPatch };

export const PATCH_RADIUS_KM = 25;
export const PATCH_STEP_M = 150;
const GIVE_UP_MS = 15_000;

/**
 * The real ground around a site, fetched when Site sky opens. It is only a picture, so any failure is not an error to the user:
 * the sky then shows the service's skyline wall alone, as before.
 */
export function useTerrainPatch(latDeg: number | null, lonEastDeg: number | null, wanted: boolean): TerrainLoad {
  const [state, setState] = useState<{ key: string; load: TerrainLoad }>({ key: "", load: { status: "idle" } });
  const key = wanted && latDeg != null && lonEastDeg != null ? `${latDeg.toFixed(5)}/${lonEastDeg.toFixed(5)}` : "";

  useEffect(() => {
    if (!key) return;
    const [lat, lon] = key.split("/");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), GIVE_UP_MS);
    getJson<TerrainPatch>(`terrain/patch?lat_deg=${lat}&lon_east_deg=${lon}&radius_km=${PATCH_RADIUS_KM}&step_m=${PATCH_STEP_M}`, ctl.signal)
      .then((patch) => setState({ key, load: patch.schema === "lunascope-terrain-patch/1" ? { status: "ready", patch } : { status: "unavailable" } }))
      .catch(() => setState({ key, load: { status: "unavailable" } }))
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [key]);

  if (!key) return { status: "idle" };
  return state.key === key ? state.load : { status: "loading" };
}
