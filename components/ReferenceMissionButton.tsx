"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { describeError, getJson, postJson } from "@/lib/api/client";
import type { ReferenceDefinition, RunSummary } from "@/lib/api/types";

const REF = "GR-001";

/**
 * Home's one button: submits the reference definition (GR-001) exactly as the service holds it, so
 * the demo, the reference run and its evidence share one run id. Same inputs attach to the same run.
 */
export function ReferenceMissionButton() {
  const router = useRouter();
  const [ref, setRef] = useState<ReferenceDefinition | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    getJson<ReferenceDefinition>(`references/${REF}`, ctl.signal)
      .then(setRef)
      .catch((e) => !(e instanceof DOMException) && setErr(describeError(e)));
    return () => ctl.abort();
  }, []);

  async function start() {
    if (!ref) return;
    setBusy(true);
    setErr(null);
    try {
      const run = await postJson<RunSummary>("analyses", ref.request);
      router.push(`/runs/${run.run_id}`);
    } catch (e) {
      setErr(describeError(e));
      setBusy(false);
    }
  }

  const days = ref ? ref.request.mission.duration_s / 86400 : 7;
  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={busy || !ref}
        className="btn-primary"
      >
        {busy ? "Starting…" : "Start the reference mission"}
      </button>
      <p className="mt-2 text-sm text-muted">
        {ref
          ? `Reference ${ref.reference_id}: ${days} days from ${ref.request.mission.start_utc.slice(0, 10)} UTC, sunlight at least ` +
            `${Math.round(ref.request.requirements.sun_min_availability * 100)}% and Earth visibility at least ` +
            `${Math.round(ref.request.requirements.earth_min_availability * 100)}% (scenario values), terrain on, ` +
            `${ref.request.sites.length} sites${ref.request.options.sensitivity ? ", with sensitivity checks" : ""}.`
          : "Loading the reference definition…"}
      </p>
      {ref && (
        <p className="mt-1 text-xs text-muted">
          {ref.status === "frozen"
            ? `${ref.reference_id} is frozen: its inputs and settings cannot change, and any change would be a new reference version. `
            : `${ref.reference_id} is a ${ref.status}. `}
          Its three sites are rule-chosen points, not candidate landing sites.
        </p>
      )}
      {err && (
        <p role="alert" className="mt-3 rounded border border-fail/40 bg-fail-soft px-3 py-2 text-sm text-fail">
          {err}
        </p>
      )}
    </div>
  );
}
