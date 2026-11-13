"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { describeError, getJson, postJson } from "@/lib/api/client";
import type { RunSummary, SitesResponse } from "@/lib/api/types";
import { referenceDraft, toRequest } from "@/lib/draft";

/** Home's one button: starts the reference mission and goes straight to its run page. */
export function ReferenceMissionButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const sites = await getJson<SitesResponse>("sites");
      const body = toRequest(referenceDraft(sites.sites.map((s) => s.site_id)));
      const run = await postJson<RunSummary>("analyses", body);
      router.push(`/runs/${run.run_id}`);
    } catch (e) {
      setErr(describeError(e));
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="rounded-lg bg-accent px-5 py-3 text-base font-semibold text-background disabled:opacity-60"
      >
        {busy ? "Starting…" : "Start the reference mission"}
      </button>
      <p className="mt-2 text-sm text-muted">
        Seven days from 2027-01-10 UTC, sunlight at least 60% and Earth visibility at least 50% (scenario values),
        terrain on, three demonstration points.
      </p>
      {err && (
        <p role="alert" className="mt-3 rounded border border-fail/40 bg-fail-soft px-3 py-2 text-sm text-fail">
          {err}
        </p>
      )}
    </div>
  );
}
