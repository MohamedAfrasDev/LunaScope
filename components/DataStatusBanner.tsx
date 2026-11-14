"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";
import type { Health } from "@/lib/api/types";

type State = { kind: "loading" } | { kind: "down" } | { kind: "ok"; h: Health };

/**
 * Persistent data-status banner (spec 7: stays until the real resources are verified).
 * It reports what the service says, and says so plainly when the service cannot be reached.
 */
export function DataStatusBanner() {
  const [s, setS] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    const load = () =>
      getJson<Health>("health", ctl.signal)
        .then((h) => alive && setS({ kind: "ok", h }))
        .catch((e) => alive && !(e instanceof DOMException) && setS({ kind: "down" }));
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      ctl.abort();
      clearInterval(t);
    };
  }, []);

  let tone = "border-border bg-surface-2 text-muted";
  let text = "Checking the science service…";
  if (s.kind === "down") {
    tone = "border-fail/50 bg-fail-soft text-fail";
    text = "Science service not reachable. No results can be computed or shown right now.";
  } else if (s.kind === "ok") {
    const synthetic = s.h.stack === "synthetic";
    tone = synthetic ? "border-warn/60 bg-warn-soft text-warn" : "border-info/50 bg-info-soft text-info";
    text = synthetic
      ? "Synthetic demonstration data: values are invented test fixtures, not lunar results."
      : "Real data, unverified: no validation gate has closed. Screening and education only, not flight-qualified.";
  }
  const replay = s.kind === "ok" && s.h.mode === "replay";

  return (
    <div role="status" className={`border-b px-4 py-2 text-center text-xs leading-5 sm:text-sm ${tone}`}>
      {replay && (
        <span className="mr-2 rounded border border-current px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
          Replay mode
        </span>
      )}
      <span className="font-medium">Data status: </span>
      {text}
      {replay && " This is an offline copy: it shows saved runs only and cannot compute new ones."}
    </div>
  );
}
