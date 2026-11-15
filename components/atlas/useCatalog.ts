"use client";

import { useEffect, useState } from "react";
import { describeError, getJson } from "@/lib/api/client";
import type { SitesResponse } from "@/lib/api/types";
import { fromCatalog, type AtlasSite } from "@/lib/atlas/sites";

export type Catalog =
  | { status: "loading"; sites: AtlasSite[] }
  | { status: "error"; sites: AtlasSite[]; message: string }
  | { status: "ready"; sites: AtlasSite[]; groups: SitesResponse["groups"]; note: string | null };

/** The site catalog from the science service, through the web app. Nothing is invented if it cannot be reached. */
export function useCatalog(): Catalog {
  const [state, setState] = useState<Catalog>({ status: "loading", sites: [] });
  useEffect(() => {
    const ctl = new AbortController();
    getJson<SitesResponse>("sites", ctl.signal)
      .then((c) => setState({ status: "ready", sites: c.sites.map(fromCatalog), groups: c.groups, note: (c as { note?: string }).note ?? null }))
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({ status: "error", sites: [], message: describeError(e) });
      });
    return () => ctl.abort();
  }, []);
  return state;
}
