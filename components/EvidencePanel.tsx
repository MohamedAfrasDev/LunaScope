"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { describeError, getJson } from "@/lib/api/client";
import type { DiskEdge, ProvenanceResponse, Target, ValidationCard, ValidationGroup, ValidationResponse } from "@/lib/api/types";
import { fieldLabel, fieldValue } from "@/lib/facts";
import { duration, pctRange, shortId, siteLabel, targetLabel, utc } from "@/lib/format";
import { CARD_STATUS, OUTCOME, WARNING_TEXT } from "@/lib/status";
import { ResultStateFrame } from "./ResultStateFrame";
import { StatusChip } from "./StatusChip";

const Hash = ({ v, n = 16 }: { v: string; n?: number }) => (
  <span className="break-all font-mono text-xs" title={v}>
    {v.slice(0, n)}…
  </span>
);

function useEvidence(runId: string) {
  const [p, setP] = useState<ProvenanceResponse | null>(null);
  const [v, setV] = useState<ValidationResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    getJson<ValidationResponse>(`analyses/${runId}/validation`, ctl.signal)
      .then((x) => x.run_id === runId && setV(x))
      .catch(() => undefined); // the cards are additional evidence; provenance still shows without them
    getJson<ProvenanceResponse>(`analyses/${runId}/provenance`, ctl.signal)
      .then((x) => x.run_id === runId && setP(x))
      .catch((e) => !(e instanceof DOMException) && setErr(describeError(e)));
    return () => ctl.abort();
  }, [runId]);
  return { p, v, err };
}

function GroupCard({ g, cards }: { g: ValidationGroup; cards: ValidationCard[] }) {
  const members = cards.filter((c) => g.card_ids.includes(c.id));
  const s = CARD_STATUS[g.status];
  return (
    <article aria-labelledby={`card-${g.id}`} className="flex flex-col rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`card-${g.id}`} className="font-semibold">{g.title}</h3>
        <StatusChip p={s} title={s.help} />
      </div>
      <p className="mt-2 text-sm text-muted">{g.scope}</p>
      <p className="mt-2 text-sm tabular-nums">
        {g.counts.met} met, {g.counts.not_met} not met, {g.counts.not_evaluated} not evaluated
      </p>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-medium">The {members.length} checks behind this card</summary>
        <ul className="mt-2 space-y-2">
          {members.map((c, i) => (
            <li key={`${c.id}-${c.site_id}-${c.target}-${i}`}>
              <StatusChip p={CARD_STATUS[c.status]} /> {c.title}
              {c.site_id ? ` (${siteLabel(c.site_id)}${c.target ? `, ${targetLabel(c.target)}` : ""})` : ""}
              <span className="block text-muted">
                {c.facts.join("; ")}. Scope: {c.scope}.
              </span>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

const READINGS = [
  { key: "upper_limb", label: "Upper limb", help: "Visible as soon as any part of the disc clears the skyline (most optimistic)" },
  { key: "centre", label: "Centre (used)", help: "The reading every result in LunaScope uses" },
  { key: "whole_disk", label: "Whole disc", help: "Visible only when all of the disc clears the skyline (most conservative)" },
] as const;

/** Centre versus disc edge (S-2): does treating the Sun and Earth as points change the answer here? */
function DiskEdgeTable({ siteId, d }: { siteId: string; d: DiskEdge }) {
  return (
    <div className="mt-2">
      <p className="text-sm">
        <strong>{siteLabel(siteId)}:</strong>{" "}
        {d.matters ? (
          <span className="font-medium text-warn"><span aria-hidden="true">! </span>treating the disc as a point changes an outcome here.</span>
        ) : (
          <span><span aria-hidden="true">✓ </span>no outcome changes between the upper limb, the centre and the whole disc.</span>
        )}
      </p>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">{siteLabel(siteId)}: availability and outcome by disc reading</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-1 pr-3">Target</th>
              {READINGS.map((r) => <th key={r.key} scope="col" className="py-1 pr-3" title={r.help}>{r.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {(Object.entries(d.targets) as [Target, NonNullable<DiskEdge["targets"][Target]>][]).map(([t, b]) => (
              <tr key={t} className="border-b border-border/50 align-top">
                <th scope="row" className="py-1 pr-3 font-medium">
                  {targetLabel(t)}
                  <span className="block text-xs font-normal text-muted">radius {b.angular_radius_deg.toFixed(2)}°</span>
                </th>
                {READINGS.map((r) => {
                  const c = b[r.key];
                  const changed = r.key !== "centre" && b.outcome_changes[r.key];
                  return (
                    <td key={r.key} className="py-1 pr-3 tabular-nums">
                      <StatusChip p={OUTCOME[c.outcome]} />
                      {changed && <span className="ml-1 text-xs font-medium text-warn">changed</span>}
                      <span className="block">{pctRange(c.availability_lower, c.availability_upper, 1)}</span>
                      <span className="block text-xs text-muted">longest hidden {duration(c.longest_known_hidden_s)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Evidence workspace (FR-09, FR-13): can I trust and reproduce this? */
export function EvidencePanel({ runId }: { runId: string }) {
  const uid = useId();
  const { p, v, err } = useEvidence(runId);

  const back = (
    <Link href={`/runs/${runId}`} className="text-sm text-accent underline underline-offset-4">
      ← Back to the status matrix
    </Link>
  );
  if (err)
    return (
      <div className="grid gap-3">
        {back}
        <p role="alert" className="rounded-md border border-fail/40 bg-fail-soft px-3 py-2 text-fail">{err}</p>
      </div>
    );
  if (!p) return <div className="grid gap-3">{back}<p className="text-muted">Loading the evidence…</p></div>;

  const req = p.request;
  const eff = p.effective_settings ?? {};
  const method: [string, string][] = [];
  if (req) {
    for (const [k, val] of [
      ["mission.start_utc", req.mission.start_utc], ["mission.duration_s", req.mission.duration_s],
      ["mission.step_s", req.mission.step_s],
      ["requirements.sun_min_availability", req.requirements.sun_min_availability],
      ["requirements.earth_min_availability", req.requirements.earth_min_availability],
      ["terrain.dem_profile", req.terrain.dem_profile], ["terrain.radius_km", req.terrain.radius_km],
      ["terrain.az_step_deg", req.terrain.az_step_deg], ["terrain.observer_height_m", req.terrain.observer_height_m],
      ["terrain.clearance_margin_deg", req.terrain.clearance_margin_deg],
    ] as [string, string | number][])
      method.push([fieldLabel(k), fieldValue(k, val)]);
  }
  const num = (k: string) => (typeof eff[k] === "number" ? (eff[k] as number) : null);
  if (num("eps_deg") != null) method.push(["Decision band ε", `${num("eps_deg")}°`]);
  if (num("tau_s") != null) method.push(["Root tolerance τ", `${num("tau_s")} s`]);
  if (num("w_min_s") != null) method.push(["Minimum interval", `${num("w_min_s")} s`]);
  for (const k of ["interpolation", "horizon_algorithm", "event_algorithm", "stack_kind"])
    if (typeof eff[k] === "string") method.push([fieldLabel(k), String(eff[k])]);

  return (
    <div className="grid gap-6">
      {back}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Evidence</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          What was used, what was checked against what, and what was not checked. Every number in this run
          traces to the inputs below.
        </p>
      </div>

      <ResultStateFrame state={p.result_state}>
        <div className="grid gap-8">
          <section aria-labelledby={`${uid}-cards`}>
            <h2 id={`${uid}-cards`} className="text-lg font-semibold">Validation cards</h2>
            {v ? (
              <>
                <p className="mt-1 text-sm text-muted">
                  {v.note} Validated scopes: {v.scopes_closed.length ? v.scopes_closed.join(", ") : "none"}.
                </p>
                <div className="mt-3 grid gap-4 lg:grid-cols-3">
                  {v.groups.map((g) => <GroupCard key={g.id} g={g} cards={v.cards} />)}
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">The validation cards could not be loaded; provenance is still shown below.</p>
            )}
          </section>

          <section aria-labelledby={`${uid}-ids`}>
            <h2 id={`${uid}-ids`} className="text-lg font-semibold">Identity and pinned resources</h2>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
              <dt className="text-muted">Run (hash of request, resources and algorithm)</dt>
              <dd><Hash v={p.run_id} n={24} /></dd>
              <dt className="text-muted">Result (sealed at completion)</dt>
              <dd><Hash v={p.result_id} n={24} /></dd>
              <dt className="text-muted">Algorithm</dt>
              <dd>{p.algorithm_id}</dd>
              {p.resources.map((r) => (
                <div key={r.role} className="contents">
                  <dt className="text-muted">{fieldLabel(`resource.${r.role}`)}</dt>
                  <dd><Hash v={r.sha256} n={24} /></dd>
                </div>
              ))}
            </dl>
          </section>

          {method.length > 0 && (
            <section aria-labelledby={`${uid}-method`}>
              <h2 id={`${uid}-method`} className="text-lg font-semibold">Method and inputs</h2>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                {method.map(([k, val]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="tabular-nums">{val}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section aria-labelledby={`${uid}-sites`}>
            <h2 id={`${uid}-sites`} className="text-lg font-semibold">Per site</h2>
            <div className="mt-2 grid gap-4">
              {p.sites.map((s) => (
                <article key={s.site_id} aria-label={`Evidence for ${siteLabel(s.site_id)}`} className="rounded border border-border p-3 text-sm">
                  <h3 className="font-semibold">{siteLabel(s.site_id)}</h3>
                  <p className="text-muted">
                    {s.observer.lat_deg}°, {s.observer.lon_deg_east}° E planetocentric
                    {s.observer.body_frame ? `, frame ${s.observer.body_frame}` : ""}; ground {s.observer.ground_height_m.toFixed(1)} m
                    {s.observer.reference_radius_km ? ` above the ${s.observer.reference_radius_km} km sphere` : ""}
                    {s.observer.observer_height_above_ground_m != null ? `, mast ${s.observer.observer_height_above_ground_m} m` : ""}.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {Object.entries(s.geometry).map(([t, g]) => (
                      <li key={t}>
                        <span className="font-medium">{targetLabel(t)}:</span> {g.provider}
                        {g.signature_version ? ` (signature ${g.signature_version})` : ""}
                        {g.correction_mode ? `, ${g.correction_mode}` : ""}
                        {g.time_scale ? `, ${g.time_scale}` : ""}
                        {g.retrieved_utc ? `, retrieved ${utc(g.retrieved_utc)}` : ""}; response <Hash v={g.raw_sha256} n={12} />
                        {g.reference_agreement
                          ? `; independent SPICE check max ${g.reference_agreement.max_total_arcsec.toFixed(4)}″ (tolerance ${g.reference_agreement.tolerance_arcsec}″, ${g.reference_agreement.within_tolerance ? "within" : "EXCEEDED"})`
                          : "; no independent check on this stack"}
                        {g.holdout ? `; interpolation holdout ${g.holdout.max_deg.toExponential(1)}°` : ""}
                      </li>
                    ))}
                    {s.horizon && (
                      <li>
                        <span className="font-medium">Skyline:</span> {s.horizon.settings.radius_km} km radius,{" "}
                        {s.horizon.settings.az_step_deg}° azimuth step; sectors{" "}
                        {Object.entries(s.horizon.sectors).map(([k, n]) => `${n} ${k.replace("_", " ")}`).join(", ")}; key{" "}
                        <Hash v={s.horizon.cache_key} n={12} />
                        {s.horizon.payload_sha256 ? <>; digest <Hash v={s.horizon.payload_sha256} n={12} /></> : "; no skyline digest recorded"}
                      </li>
                    )}
                  </ul>
                  {s.warnings && s.warnings.length > 0 && (
                    <p className="mt-2 text-xs">
                      {s.warnings.map((w) => (
                        <span key={w} className="mr-2"><code className="rounded bg-surface-2 px-1">{w}</code> <span className="text-muted">{WARNING_TEXT[w] ?? ""}</span></span>
                      ))}
                    </p>
                  )}
                </article>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Geometry agreement checks the Sun and Earth directions only. It does not validate the terrain horizon.
            </p>
          </section>

          <section aria-labelledby={`${uid}-disc`}>
            <h2 id={`${uid}-disc`} className="text-lg font-semibold">Disc size: centre or edge?</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted">
              Every result treats the Sun and Earth as a single point, their centre. Earth is about 1.9° across and the
              Sun about 0.5°, so near the skyline that can matter. The table brackets it: the same sky and terrain with
              the edge of the disc used instead.
            </p>
            {p.sites.some((s) => s.disk_edge) ? (
              p.sites.map((s) => (s.disk_edge
                ? <DiskEdgeTable key={s.site_id} siteId={s.site_id} d={s.disk_edge} />
                : <p key={s.site_id} className="mt-2 text-sm text-muted">{siteLabel(s.site_id)}: not computed for this result.</p>))
            ) : (
              <p className="mt-2 text-sm text-muted">Not computed for this analysis: it was made before this check existed. Run it again to get it.</p>
            )}
            {p.sites.find((s) => s.disk_edge)?.disk_edge && (
              <p className="mt-2 text-xs text-muted">{p.sites.find((s) => s.disk_edge)?.disk_edge?.note}</p>
            )}
          </section>

          <section aria-labelledby={`${uid}-limits`}>
            <h2 id={`${uid}-limits`} className="text-lg font-semibold">Limits that apply to every number here</h2>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {Array.from(new Set(p.sites.flatMap((s) => s.caveats))).map((c) => <li key={c}>{c}</li>)}
            </ul>
          </section>

          <section aria-labelledby={`${uid}-export`}>
            <h2 id={`${uid}-export`} className="text-lg font-semibold">Export</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted">
              The bundle holds the request, settings, resource pins, provider response hashes, angle series, skyline,
              classified intervals, events, metrics and caveats, plus a frozen snapshot of the validation cards above.
              It is designated <strong>investigative</strong>: a verified export is refused until a validation scope
              closes.
            </p>
            <a
              href={`/api/v1/analyses/${runId}/export`}
              download={`lunascope-${shortId(runId)}-investigative.json`}
              className="mt-3 inline-block rounded border border-border px-3 py-2 text-sm font-medium"
            >
              Download investigative bundle (JSON)
            </a>
          </section>
        </div>
      </ResultStateFrame>
    </div>
  );
}

/** Compact pointer from the run page to the Evidence workspace. */
export function EvidenceLink({ runId }: { runId: string }) {
  const { v } = useEvidence(runId);
  return (
    <section aria-label="Evidence summary" className="surface-card p-4 text-sm">
      <h2 className="text-lg font-semibold">Evidence</h2>
      {v && (
        <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {v.groups.map((g) => (
            <li key={g.id} className="flex items-center gap-2">
              {g.title} <StatusChip p={CARD_STATUS[g.status]} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3">
        <Link href={`/runs/${runId}/evidence`} className="font-medium text-accent underline underline-offset-4">
          Open the evidence: provenance, validation cards and export
        </Link>
      </p>
    </section>
  );
}
