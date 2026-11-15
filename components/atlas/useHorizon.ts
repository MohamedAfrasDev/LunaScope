"use client";

import { useEffect, useState } from "react";
import { describeError, getJson } from "@/lib/api/client";
import type { HorizonProfileResponse } from "@/lib/api/types";

export type HorizonLoad =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; profile: HorizonProfileResponse };

/**
 * The terrain skyline of one site of the loaded run, from the service. Fetched when a site is selected and a panel needs it;
 * an answer for a different run or site is ignored. Failing leaves the panels to say so.
 */
export function useHorizon(runId: string | null, siteId: string | null, wanted: boolean): HorizonLoad {
  const [state, setState] = useState<{ key: string; load: HorizonLoad }>({ key: "", load: { status: "idle" } });
  const key = runId && siteId && wanted ? `${runId}/${siteId}` : "";

  useEffect(() => {
    if (!key) return;
    const ctl = new AbortController();
    const [run, site] = key.split("/");
    getJson<HorizonProfileResponse>(`analyses/${run}/horizon/${encodeURIComponent(site)}`, ctl.signal)
      .then((profile) => !ctl.signal.aborted && setState({ key, load: { status: "ready", profile } }))
      .catch((e) => {
        if (ctl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
        setState({ key, load: { status: "error", message: describeError(e) } });
      });
    return () => ctl.abort();
  }, [key]);

  if (!key) return { status: "idle" };
  return state.key === key ? state.load : { status: "loading" };
}
