"use client";

import { useEffect, useId, useState } from "react";
import { Panel } from "@/components/atlas/Panel";
import { StatusChip } from "@/components/StatusChip";
import { describeError, postJson } from "@/lib/api/client";
import type { ComparisonResponse, Target } from "@/lib/api/types";
import { fieldLabel, fieldValue, factText } from "@/lib/facts";
import { duration, pctRange, siteLabel } from "@/lib/format";
import { OUTCOME, SITE_STATUS } from "@/lib/status";

const TARGETS: Target[] = ["sun_center", "earth_center"];
const NAME: Record<Target, string> = { sun_center: "Sun above the terrain skyline", earth_center: "Line of sight to Earth" };

/**
 * Compare (spec 6.10): pick two or more sites of the loaded run; the science service recomputes the comparison for exactly those
 * sites from identical inputs. Facts are the service's typed records worded by the same templates as the Compare page. Sites are
 * never ranked or scored.
 */
export function ComparePanel({ runId, siteIds, nameOf, onClose }: { runId: string; siteIds: string[]; nameOf?: (id: string) => string; onClose: () => void }) {
  const uid = useId();
  const label = nameOf ?? siteLabel;
  const [chosen, setChosen] = useState<string[]>(() => siteIds.slice(0, 3));
  const [cmp, setCmp] = useState<ComparisonResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const picked = siteIds.filter((s) => chosen.includes(s));

  useEffect(() => {
    if (picked.length < 2) return;
    let alive = true;
    postJson<ComparisonResponse>("comparisons", { runs: [runId], sites: picked })
      .then((c) => {
        if (alive && c.run_id === runId) {
          setCmp(c);
          setErr(null);
        }
      })
      .catch((e) => alive && setErr(describeError(e)));
    return () => {
      alive = false;
    };
    // picked is derived from chosen and siteIds, so those are the real inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, chosen.join("|"), siteIds.join("|")]);

  const toggle = (id: string, on: boolean) => setChosen((c) => (on ? [...c, id] : c.filter((x) => x !== id)));
  const show = cmp && picked.length >= 2 && !err;

  return (
    <Panel title="Compare" tag="derived" onClose={onClose} focused className="max-h-full" bodyClassName="space-y-4">
      <fieldset className="m-0 border-0 p-0" aria-describedby={picked.length < 2 ? `${uid}-n` : undefined}>
        <legend className="atlas-label mb-1 text-[var(--ink-dim)]">Sites of this run</legend>
        <div className="flex flex-wrap gap-1.5">
          {siteIds.map((id) => (
            <label key={id} className="atlas-key atlas-label flex cursor-pointer items-center gap-2 border border-[var(--panel-edge)] has-[:checked]:border-[var(--select)] has-[:checked]:text-[var(--ink)]">
              <input type="checkbox" className="accent-[var(--select)]" checked={chosen.includes(id)} onChange={(e) => toggle(id, e.target.checked)} />
              {label(id)}
            </label>
          ))}
        </div>
        {picked.length < 2 && (
          <p id={`${uid}-n`} role="alert" className="atlas-prose mt-2 text-sm text-[var(--fail)]">
            <span aria-hidden="true">✗ </span>Choose at least two sites.
          </p>
        )}
      </fieldset>

      {err && (
        <p role="alert" className="atlas-prose text-sm text-[var(--fail)]">
          {err}
        </p>
      )}

      {show && (
        <>
          <section aria-label="What differs" data-testid="compare-facts">
            <h3 className="atlas-label mb-1 text-[var(--ink-dim)]">What differs</h3>
            <ul className="atlas-prose m-0 list-disc space-y-1.5 pl-5 text-sm text-[var(--ink)]">
              {cmp.facts.map((f, i) => (
                <li key={i}>{factText(f)}</li>
              ))}
            </ul>
          </section>

          {TARGETS.map((t) => {
            const block = cmp.targets[t];
            if (!block) return null;
            return (
              <section key={t} aria-label={NAME[t]} className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                  <span aria-hidden="true" className={t === "sun_center" ? "text-[var(--sun)]" : "text-[var(--earth)]"}>
                    {t === "sun_center" ? "●" : "◆"}
                  </span>
                  {NAME[t]}
                </h3>
                <p className="atlas-prose text-xs text-[var(--ink-dim)]">
                  Lower bounds range from {(block.spread.availability_lower_min * 100).toFixed(1)}% to {(block.spread.availability_lower_max * 100).toFixed(1)}%.
                </p>
                <ul className="m-0 list-none space-y-2 p-0">
                  {block.sites.map((r) => (
                    <li key={r.site_id} className="border border-[var(--panel-edge)] p-2" data-testid={`compare-${t}-${r.site_id}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="atlas-prose text-sm text-[var(--ink)]">{label(r.site_id)}</strong>
                        <StatusChip p={OUTCOME[r.terrain.outcome]} title={OUTCOME[r.terrain.outcome].help} />
                      </div>
                      <p className="atlas-number mt-1 text-sm text-[var(--ink)]">
                        {pctRange(r.terrain.availability_lower, r.terrain.availability_upper, 2)}
                        <span className="atlas-prose ml-2 text-xs text-[var(--ink-dim)]">
                          longest known hidden {duration(r.terrain.longest_known_hidden_s)} · {r.terrain.events} predicted events
                        </span>
                      </p>
                      <p className="atlas-prose mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-dim)]">
                        Flat horizon would give <StatusChip p={OUTCOME[r.flat.outcome]} />
                        <span className="atlas-number">{pctRange(r.flat.availability_lower, r.flat.availability_upper, 2)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <section aria-label="Site status" className="space-y-1">
            <h3 className="atlas-label text-[var(--ink-dim)]">Overall, each requirement judged on its own</h3>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {Object.entries(cmp.site_status).map(([id, st]) => (
                <li key={id} className="atlas-prose flex items-center gap-1.5 text-xs text-[var(--ink)]">
                  {label(id)} <StatusChip p={SITE_STATUS[st]} title={SITE_STATUS[st].help} />
                </li>
              ))}
            </ul>
          </section>

          <details className="atlas-prose text-sm">
            <summary className="atlas-label cursor-pointer text-[var(--ink-dim)]">Held constant ({cmp.held_constant.length} inputs)</summary>
            <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 text-xs">
              {cmp.held_constant.map((h) => (
                <div key={h.field} className="contents">
                  <dt className="text-[var(--ink-dim)]">{fieldLabel(h.field)}</dt>
                  <dd className="atlas-number break-all text-[var(--ink)]">{fieldValue(h.field, h.value)}</dd>
                </div>
              ))}
            </dl>
          </details>
          <p className="atlas-prose text-xs text-[var(--ink-dim)]">Sites are not ranked or scored: the trade-offs are shown.</p>
        </>
      )}
    </Panel>
  );
}
