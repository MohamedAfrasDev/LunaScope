"use client";

import Link from "next/link";
import { Panel } from "@/components/atlas/Panel";
import { Tag } from "@/components/atlas/Tag";
import type { CursorReading } from "@/lib/atlas/run";
import { INTERVAL } from "@/lib/status";
import { encodeShare, referenceDraft, SHARE_PARAM } from "@/lib/draft";
import { coverageWords, formatEastLon, formatLat, kindWords, type AtlasSite } from "@/lib/atlas/sites";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-0.5 py-1.5">
      <dt className="atlas-label pt-0.5 text-[var(--ink-dim)]">{label}</dt>
      <dd className="atlas-number min-w-0 break-words text-sm text-[var(--ink)]">{children}</dd>
    </div>
  );
}

/** A link to the analysis form with just this site filled in. It carries inputs only, and starts nothing. */
export function analyseHref(site: AtlasSite): string {
  const base = referenceDraft(site.kind === "custom" ? [] : [site.id]);
  const draft =
    site.kind === "custom"
      ? {
          ...base,
          custom: [
            {
              lat: String(Number(site.latDeg.toFixed(4))),
              lon: String(Number(site.lonEastDeg.toFixed(4))),
              direction: "east_positive" as const,
              source: site.source.slice(0, 200),
              precision: String(site.precisionM),
            },
          ],
        }
      : base;
  return `/analyze?${SHARE_PARAM}=${encodeShare(draft)}`;
}

/** What the loaded run says about this site at the clock time. Everything here came from the science service. */
export type SiteCursor =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "error"; text: string }
  | { kind: "not-in-run"; runLabel: string }
  | { kind: "ready"; timeLabel: string; runLabel: string; readings: CursorReading[] };

const TARGET_WORDS = { sun_center: "Sun", earth_center: "Earth" } as const;

function CursorBlock({ cursor }: { cursor: SiteCursor }) {
  if (cursor.kind === "ready") {
    return (
      <section aria-label="At the cursor" className="space-y-2" data-testid="site-cursor">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="atlas-label text-[var(--ink-dim)]">At the cursor</h4>
          <Tag kind="derived" />
        </div>
        <p className="atlas-number text-xs text-[var(--ink-dim)]">
          {cursor.timeLabel} · run {cursor.runLabel}
        </p>
        <dl className="divide-y divide-[var(--panel-edge)] border-y border-[var(--panel-edge)]">
          {cursor.readings.map((r) => (
            <div key={r.target} className="grid grid-cols-[4.5rem_1fr] gap-x-3 py-1.5">
              <dt className={`atlas-label pt-0.5 ${r.target === "sun_center" ? "text-[var(--sun)]" : "text-[var(--earth)]"}`}>
                <span aria-hidden="true">{r.target === "sun_center" ? "● " : "◆ "}</span>
                {TARGET_WORDS[r.target]}
              </dt>
              <dd className="atlas-number text-sm text-[var(--ink)]">
                AZ {r.azDeg.toFixed(1)}° · EL {r.elDeg >= 0 ? "+" : "−"}
                {Math.abs(r.elDeg).toFixed(2)}°
                <span className="atlas-prose block text-xs text-[var(--ink-dim)]">
                  {r.state ? INTERVAL[r.state].label : "No classified state at this time"} (terrain-aware)
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }
  const text =
    cursor.kind === "loading"
      ? "Loading the run, so there is no Sun or Earth result yet."
      : cursor.kind === "error"
        ? `The run could not be loaded, so no Sun or Earth result is shown. ${cursor.text}`
        : cursor.kind === "not-in-run"
          ? `This point is not in the loaded run (${cursor.runLabel}), so there is no Sun or Earth result for it. Use Analyse this site to compute one.`
          : "No run is loaded, so there is no Sun or Earth result for this point yet. Results arrive with a run.";
  return <p className="atlas-prose text-xs text-[var(--ink-dim)]">{text}</p>;
}

/**
 * Selected site (spec 6.3): what the point is, where it comes from and what the terrain data covers. Results (Sun and Earth
 * outcomes) arrive with a run in a later phase; until then it says so rather than leaving a gap that looks like data.
 */
export function SelectedSitePanel({
  site,
  onCentre,
  onReset,
  onRemove,
  onClose,
  onEnterSky,
  cursor = { kind: "none" },
}: {
  /** Present when the loaded run holds this site: enters Site sky. */
  onEnterSky?: () => void;
  site: AtlasSite;
  cursor?: SiteCursor;
  onCentre: () => void;
  onReset: () => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const cov = coverageWords(site.coverage);
  return (
    <Panel title="Selected site" onClose={onClose} focused className="max-h-full" bodyClassName="space-y-3">
      <div>
        <h3 className="text-base font-medium text-[var(--ink)]" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
          {site.label}
        </h3>
        <p className="atlas-prose mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-dim)]">
          {kindWords(site.kind)}
          {site.kind !== "named" && <Tag kind="assumption" />}
        </p>
      </div>

      <dl className="divide-y divide-[var(--panel-edge)] border-y border-[var(--panel-edge)]">
        <Row label="Latitude">{formatLat(site.latDeg)}</Row>
        <Row label="East longitude">{formatEastLon(site.lonEastDeg)}</Row>
        {(site.featureType || site.diameterKm) && (
          <Row label="Feature">
            {[site.featureType, site.diameterKm ? `${site.diameterKm} km across` : null].filter(Boolean).join(", ")}
          </Row>
        )}
        <Row label="Precision">±{site.precisionM.toLocaleString("en-US")} m</Row>
        <Row label="Terrain data">
          <span className="atlas-prose block text-sm" data-known={cov.known} data-full={cov.full}>
            <span aria-hidden="true">{cov.full ? "● " : "○ "}</span>
            {cov.word}
          </span>
        </Row>
        <Row label="Source">
          <span className="atlas-prose block text-sm">
            {site.source}
            {site.iauUrl && (
              <>
                {" "}
                <a href={site.iauUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                  IAU entry
                </a>
              </>
            )}
          </span>
        </Row>
      </dl>

      <CursorBlock cursor={cursor} />

      <div className="flex flex-wrap gap-2">
        <button type="button" className="atlas-key atlas-label border-[var(--panel-edge)]" onClick={onCentre}>
          Centre on site
        </button>
        <button type="button" className="atlas-key atlas-label border-[var(--panel-edge)]" onClick={onReset}>
          Reset view
        </button>
        <button
          type="button"
          className="atlas-key atlas-label border-[var(--panel-edge)]"
          disabled={!onEnterSky}
          title={onEnterSky ? undefined : "Needs a loaded run that holds this site"}
          onClick={onEnterSky}
        >
          Enter site sky
        </button>
        <Link href={analyseHref(site)} className="atlas-key atlas-label inline-flex items-center border border-[var(--panel-edge)]">
          Analyse this site
        </Link>
        {onRemove && (
          <button type="button" className="atlas-key atlas-label border-[var(--panel-edge)]" onClick={onRemove}>
            Remove point
          </button>
        )}
      </div>
    </Panel>
  );
}
