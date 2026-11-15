"use client";

import { useEffect, useId, useState } from "react";
import { Panel } from "@/components/atlas/Panel";
import { getJson } from "@/lib/api/client";
import type { ReferenceDefinition } from "@/lib/api/types";
import { isRunId, sameTarget, type RunTarget } from "@/lib/atlas/run-target";
import { shortId } from "@/lib/format";
import { useRecentRuns } from "@/lib/recent-runs";

const REFERENCES = [
  { id: "GR-001", fallback: "Reference mission" },
  { id: "GR-002", fallback: "Artemis III candidate-region features" },
  { id: "GR-003", fallback: "Well-known south-polar craters" },
] as const;

type Def = { title: string | null; purpose: string | null; frozen: boolean };

/**
 * Runs (spec 6.13 and 7): the saved reference missions, the runs opened on this device, and any run by its id. Choosing one loads
 * it into the Atlas; a reference is submitted exactly as the service holds it, so the same inputs always give the same run.
 */
export function RunsPanel({ current, onChoose, onClose }: { current: RunTarget; onChoose: (t: RunTarget) => void; onClose: () => void }) {
  const uid = useId();
  const recent = useRecentRuns();
  const [defs, setDefs] = useState<Record<string, Def>>({});
  const [id, setId] = useState("");
  const [bad, setBad] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    for (const r of REFERENCES) {
      getJson<ReferenceDefinition>(`references/${r.id}`, ctl.signal)
        .then((d) => !ctl.signal.aborted && setDefs((m) => ({ ...m, [r.id]: { title: d.title ?? null, purpose: d.purpose ?? null, frozen: d.status === "frozen" } })))
        .catch(() => {}); // a reference that cannot be read keeps its plain name
    }
    return () => ctl.abort();
  }, []);

  function open(e: React.FormEvent) {
    e.preventDefault();
    const v = id.trim().toLowerCase();
    if (!isRunId(v)) return setBad("A run id is 64 characters, 0 to 9 and a to f.");
    setBad(null);
    setId("");
    onChoose({ kind: "run", id: v });
  }

  const item = "atlas-key flex w-full flex-col items-start gap-0.5 border border-[var(--panel-edge)] px-3 py-2 text-left aria-[current=true]:border-[var(--select)]";

  return (
    <Panel title="Runs" onClose={onClose} focused className="max-h-full" bodyClassName="space-y-5">
      <section aria-labelledby={`${uid}-ref`}>
        <h3 id={`${uid}-ref`} className="atlas-label mb-2 text-[var(--ink-dim)]">
          Reference missions
        </h3>
        <ul className="m-0 list-none space-y-1.5 p-0">
          {REFERENCES.map((r) => {
            const t: RunTarget = { kind: "reference", id: r.id };
            const d = defs[r.id];
            const on = sameTarget(current, t);
            return (
              <li key={r.id}>
                <button type="button" className={item} aria-current={on} onClick={() => onChoose(t)}>
                  <span className="atlas-label text-[var(--ink)]">
                    {r.id}
                    {d?.frozen ? " · frozen" : ""}
                    {on ? " · open" : ""}
                  </span>
                  <span className="atlas-prose text-sm text-[var(--ink)]">{d?.title ?? r.fallback}</span>
                  {d?.purpose && <span className="atlas-prose line-clamp-2 text-xs text-[var(--ink-dim)]">{d.purpose}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="atlas-prose mt-2 text-xs text-[var(--ink-dim)]">
          The named places are features from the IAU list, not landing recommendations. A reference is submitted exactly as the service
          holds it, so the same inputs always give the same run.
        </p>
      </section>

      <section aria-labelledby={`${uid}-rec`}>
        <h3 id={`${uid}-rec`} className="atlas-label mb-2 text-[var(--ink-dim)]">
          Opened on this device
        </h3>
        {recent.length === 0 ? (
          <p className="atlas-prose text-sm text-[var(--ink-dim)]">None yet. Runs you open or start appear here, and stay only in this browser.</p>
        ) : (
          <ul className="m-0 list-none space-y-1.5 p-0">
            {recent.map((r) => {
              const t: RunTarget = { kind: "run", id: r.id };
              return (
                <li key={r.id}>
                  <button type="button" className={item} aria-current={sameTarget(current, t)} onClick={() => onChoose(t)}>
                    <span className="atlas-prose text-sm text-[var(--ink)]">{r.label}</span>
                    <span className="atlas-number text-xs text-[var(--ink-dim)]">{shortId(r.id)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form onSubmit={open} className="space-y-2 border-t border-[var(--panel-edge)] pt-4" aria-label="Open a run">
        <label htmlFor={`${uid}-id`} className="atlas-label text-[var(--ink-dim)]">
          Open a run by its id
        </label>
        <input
          id={`${uid}-id`}
          value={id}
          onChange={(e) => setId(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={bad ? true : undefined}
          aria-describedby={bad ? `${uid}-bad` : undefined}
          placeholder="64 characters"
          className="atlas-number h-9 w-full rounded border border-[var(--input)] bg-[var(--void)] px-2 text-xs text-[var(--ink)]"
        />
        {bad && (
          <p id={`${uid}-bad`} role="alert" className="atlas-prose text-xs text-[var(--fail)]">
            {bad}
          </p>
        )}
        <button type="submit" className="atlas-key atlas-label border-[var(--panel-edge)]" disabled={!id.trim()}>
          Open
        </button>
      </form>
    </Panel>
  );
}
