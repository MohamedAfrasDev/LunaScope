import Link from "next/link";
import type { MatrixCell, MatrixRow, Target } from "@/lib/api/types";
import { pctRange, siteLabel } from "@/lib/format";
import { OUTCOME, SITE_STATUS } from "@/lib/status";
import { StatusChip } from "./StatusChip";

const TARGETS: { target: Target; name: string; hue: "sun" | "earth"; shape: string }[] = [
  { target: "sun_center", name: "Sun", hue: "sun", shape: "●" },
  { target: "earth_center", name: "Earth", hue: "earth", shape: "◆" },
];

/**
 * Availability as a bar: the solid part is the certified (lower) bound, the lighter part is the extra
 * time still inside the numerical decision band, and the tick is the requirement. Decorative: the same
 * numbers are written next to it.
 */
function AvailabilityBar({ cell, hue }: { cell: MatrixCell; hue: "sun" | "earth" }) {
  const w = (x: number) => `${Math.max(0, Math.min(1, x)) * 100}%`;
  const fill = hue === "sun" ? "bg-sun" : "bg-earth";
  return (
    <div className="relative mt-2 h-1.5 rounded-full bg-muted" aria-hidden="true">
      <div className={`absolute inset-y-0 left-0 rounded-full opacity-40 ${fill}`} style={{ width: w(cell.availability_upper) }} />
      <div className={`absolute inset-y-0 left-0 rounded-full ${fill}`} style={{ width: w(cell.availability_lower) }} />
      <div className="absolute -bottom-1 -top-1 w-0.5 rounded bg-foreground" style={{ left: w(cell.threshold) }} />
    </div>
  );
}

function TargetBlock({ row, spec }: { row: MatrixRow; spec: (typeof TARGETS)[number] }) {
  const terrain = row.targets[spec.target].terrain;
  const flat = row.targets[spec.target].flat;
  const p = OUTCOME[terrain.outcome];
  const fp = OUTCOME[flat.outcome];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span aria-hidden="true" className={spec.hue === "sun" ? "text-sun" : "text-earth"}>
            {spec.shape}
          </span>
          {spec.name}
        </span>
        <StatusChip p={p} title={p.help} />
      </div>
      <p className="mt-1.5 text-sm">
        <span className="readout">{pctRange(terrain.availability_lower, terrain.availability_upper)}</span>{" "}
        <span className="type-caption">needs at least {Math.round(terrain.threshold * 100)}%</span>
      </p>
      <AvailabilityBar cell={terrain} hue={spec.hue} />
      <p className="type-caption mt-2">
        Flat horizon (comparison): <span aria-hidden="true">{fp.icon} </span>
        {fp.label} <span className="readout">{pctRange(flat.availability_lower, flat.availability_upper)}</span>
      </p>
    </div>
  );
}

/** One site, decided. The terrain-aware result is the one shown large; the flat horizon is a comparison line. */
export function SiteCard({ runId, row }: { runId: string; row: MatrixRow }) {
  const s = SITE_STATUS[row.site_status];
  const id = `site-${row.site_id}`;
  return (
    <article aria-labelledby={id} className="surface-card flex flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="text-base font-semibold">
          {siteLabel(row.site_id)}
        </h3>
        <StatusChip p={s} title={s.help} />
      </header>
      {TARGETS.map((spec) => (
        <TargetBlock key={spec.target} row={row} spec={spec} />
      ))}
      <footer className="mt-auto flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3 text-sm">
        <Link
          href={`/runs/${runId}/timeline/${encodeURIComponent(row.site_id)}`}
          className="tap text-primary underline underline-offset-4"
        >
          Timeline and evidence
        </Link>
        <Link
          href={`/runs/${runId}/sky/${encodeURIComponent(row.site_id)}`}
          className="tap text-primary underline underline-offset-4"
        >
          Local sky
        </Link>
      </footer>
    </article>
  );
}

/** Decided sites as cards. Sites the service could not decide are not cards: see ExcludedSites. */
export function SiteCards({ runId, rows }: { runId: string; rows: MatrixRow[] }) {
  const decided = rows.filter((r) => r.site_status !== "UNKNOWN_COVERAGE");
  if (decided.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {decided.map((r) => (
        <SiteCard key={r.site_id} runId={runId} row={r} />
      ))}
    </div>
  );
}
