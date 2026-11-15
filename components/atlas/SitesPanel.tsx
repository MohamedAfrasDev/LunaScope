"use client";

import { useId, useState } from "react";
import { Panel } from "@/components/atlas/Panel";
import type { Catalog } from "@/components/atlas/useCatalog";
import {
  filterSites,
  formatEastLon,
  formatLat,
  groupSites,
  MAX_CUSTOM_POINTS,
  type AtlasSite,
} from "@/lib/atlas/sites";

/**
 * Sites (spec 6.15): every site as a searchable list, and the keyboard way to everything the pins do, including adding a
 * point by its coordinates. Selecting a row selects the pin and flies to it.
 */
export function SitesPanel({
  catalog,
  sites,
  selectedId,
  onSelect,
  onAddPoint,
  customCount,
  onClose,
}: {
  catalog: Catalog;
  sites: AtlasSite[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddPoint: (latDeg: number, lonEastDeg: number) => Promise<string | null>;
  customCount: number;
  onClose: () => void;
}) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const groups = groupSites(filterSites(sites, q), catalog.status === "ready" ? catalog.groups : undefined);
  const latN = Number(lat);
  const lonN = Number(lon);
  const valid = lat.trim() !== "" && lon.trim() !== "" && Number.isFinite(latN) && Number.isFinite(lonN) && lonN >= -360 && lonN <= 360;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setMsg(null);
    const err = await onAddPoint(latN, lonN);
    setBusy(false);
    if (err) setMsg(err);
    else {
      setMsg("Point added and selected.");
      setLat("");
      setLon("");
    }
  }

  const input = "atlas-number h-9 w-full rounded border border-[var(--input)] bg-[var(--void)] px-2 text-sm text-[var(--ink)]";

  return (
    <Panel title="Sites" onClose={onClose} className="max-h-full" bodyClassName="space-y-4">
      <div>
        <label htmlFor={`${uid}-q`} className="atlas-label text-[var(--ink-dim)]">
          Search sites
        </label>
        <input id={`${uid}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or type" className={`${input} mt-1`} />
      </div>

      {catalog.status === "loading" && (
        <p role="status" className="atlas-prose text-sm text-[var(--ink-dim)]">
          Loading the site list…
        </p>
      )}
      {catalog.status === "error" && (
        <p role="alert" className="atlas-prose text-sm text-[var(--fail)]">
          The site list could not be loaded. {catalog.message} Nothing is shown in its place.
        </p>
      )}

      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`${uid}-${g.id}`}>
          <h3 id={`${uid}-${g.id}`} className="atlas-label mb-1 text-[var(--ink-dim)]">
            {g.title}
          </h3>
          <ul className="m-0 list-none p-0">
            {g.sites.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="atlas-key flex min-h-9 w-full items-baseline justify-between gap-3 px-2 text-left"
                  aria-pressed={s.id === selectedId}
                  onClick={() => onSelect(s.id)}
                >
                  <span className="atlas-prose truncate text-sm text-[var(--ink)]">{s.label}</span>
                  <span className="atlas-number shrink-0 text-xs text-[var(--ink-dim)]">
                    {formatLat(s.latDeg)} {formatEastLon(s.lonEastDeg)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {catalog.status === "ready" && groups.length === 0 && (
        <p role="status" className="atlas-prose text-sm text-[var(--ink-dim)]">
          No site matches &ldquo;{q}&rdquo;.
        </p>
      )}

      <form onSubmit={add} className="space-y-2 border-t border-[var(--panel-edge)] pt-4" aria-label="Add a point by coordinates">
        <h3 className="atlas-label text-[var(--ink-dim)]">Add a point</h3>
        <p className="atlas-prose text-xs text-[var(--ink-dim)]">
          Latitude from −90 to −80, because the terrain data covers 80° S to the pole. Or use Place a point in the top bar and click
          the Moon.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`${uid}-lat`} className="atlas-label text-[var(--ink-dim)]">
              Latitude (°)
            </label>
            <input id={`${uid}-lat`} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-89.5" className={`${input} mt-1`} />
          </div>
          <div>
            <label htmlFor={`${uid}-lon`} className="atlas-label text-[var(--ink-dim)]">
              East longitude (°)
            </label>
            <input id={`${uid}-lon`} inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="45" className={`${input} mt-1`} />
          </div>
        </div>
        <button type="submit" className="atlas-key atlas-label border-[var(--panel-edge)]" disabled={!valid || busy || customCount >= MAX_CUSTOM_POINTS}>
          {busy ? "Checking…" : "Check coverage and add"}
        </button>
        {customCount >= MAX_CUSTOM_POINTS && (
          <p className="atlas-prose text-xs text-[var(--ink-dim)]">Up to {MAX_CUSTOM_POINTS} points. Remove one to add another.</p>
        )}
        <p role="status" aria-live="polite" className="atlas-prose min-h-5 text-xs text-[var(--ink)]">
          {msg}
        </p>
      </form>
    </Panel>
  );
}
