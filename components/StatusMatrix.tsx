import Link from "next/link";
import type { HorizonKind, MatrixCell, MatrixRow, Target } from "@/lib/api/types";
import { pctRange, siteLabel } from "@/lib/format";
import { OUTCOME, SITE_STATUS } from "@/lib/status";
import { StatusChip } from "./StatusChip";

const COLS: { target: Target; horizon: HorizonKind; head: string; sub: string }[] = [
  { target: "sun_center", horizon: "terrain", head: "Sun", sub: "terrain-aware (decides)" },
  { target: "sun_center", horizon: "flat", head: "Sun", sub: "flat horizon (comparison)" },
  { target: "earth_center", horizon: "terrain", head: "Earth", sub: "terrain-aware (decides)" },
  { target: "earth_center", horizon: "flat", head: "Earth", sub: "flat horizon (comparison)" },
];

function Cell({ c, decides }: { c: MatrixCell; decides: boolean }) {
  const p = OUTCOME[c.outcome];
  return (
    // the comparison column is named in its header; it is not faded (fading failed WCAG contrast)
    <div className={decides ? "" : "border-l-2 border-dashed border-border pl-2"}>
      <StatusChip p={p} title={p.help} />
      <div className="mt-1 text-sm tabular-nums">{pctRange(c.availability_lower, c.availability_upper)}</div>
      <div className="text-xs text-muted">needs at least {Math.round(c.threshold * 100)}%</div>
    </div>
  );
}

/**
 * Status matrix: sites in rows, requirements in columns. Each requirement is judged on its own
 * and there is no overall winner or score. Excluded and indeterminate are not failures.
 */
export function StatusMatrix({ runId, rows: all }: { runId: string; rows: MatrixRow[] }) {
  // Sites the service could not decide are grouped apart: excluded is not a failure (FR-03).
  const rows = all.filter((r) => r.site_status !== "UNKNOWN_COVERAGE");
  const excluded = all.filter((r) => r.site_status === "UNKNOWN_COVERAGE");
  return (
    <div className="overflow-x-auto">
      {all.length >= 2 && (
        <p className="mb-3 text-sm">
          <Link href={`/runs/${runId}/compare`} className="font-medium text-accent underline underline-offset-4">
            Compare these sites side by side
          </Link>
        </p>
      )}
      <table className="w-full min-w-[46rem] border-collapse text-left">
        <caption className="mb-2 text-left text-sm text-muted">
          Availability is shown as a lower to upper bound: the lower bound counts only certified visible time,
          the upper bound adds time still inside the numerical decision band.
        </caption>
        <thead>
          <tr className="border-b border-border text-sm">
            <th scope="col" className="py-2 pr-3 font-semibold">Site</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Overall</th>
            {COLS.map((c) => (
              <th key={`${c.target}-${c.horizon}`} scope="col" className="py-2 pr-3 align-top font-semibold">
                {c.head}
                <span className="block text-xs font-normal text-muted">{c.sub}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = SITE_STATUS[r.site_status];
            return (
              <tr key={r.site_id} className="border-b border-border align-top">
                <th scope="row" className="py-3 pr-3 text-left font-medium">
                  {siteLabel(r.site_id)}
                  <Link
                    href={`/runs/${runId}/timeline/${encodeURIComponent(r.site_id)}`}
                    className="mt-1 block text-sm font-normal text-accent underline underline-offset-4"
                  >
                    Timeline and evidence
                  </Link>
                  <Link
                    href={`/runs/${runId}/sky/${encodeURIComponent(r.site_id)}`}
                    className="mt-1 block text-sm font-normal text-accent underline underline-offset-4"
                  >
                    Local sky
                  </Link>
                </th>
                <td className="py-3 pr-3">
                  <StatusChip p={s} title={s.help} />
                </td>
                {COLS.map((c) => (
                  <td key={`${c.target}-${c.horizon}`} className="py-3 pr-3">
                    <Cell c={r.targets[c.target][c.horizon]} decides={c.horizon === "terrain"} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p className="mt-2 text-sm text-muted">No site in this run could be decided.</p>}
      {excluded.length > 0 && (
        <section aria-label="Excluded sites" className="mt-4 rounded border border-border bg-surface-2 p-3 text-sm">
          <h3 className="font-semibold">
            <StatusChip p={SITE_STATUS.UNKNOWN_COVERAGE} /> Excluded: not enough data to decide ({excluded.length})
          </h3>
          <p className="mt-1 text-muted">
            Missing terrain coverage or uncertified time leaves these sites undecided. They are not counted as
            failures, and their numbers are not shown in the matrix above.
          </p>
          <ul className="mt-2 space-y-1">
            {excluded.map((r) => (
              <li key={r.site_id}>
                {siteLabel(r.site_id)}:{" "}
                <Link href={`/runs/${runId}/timeline/${encodeURIComponent(r.site_id)}`} className="text-accent underline underline-offset-4">
                  see why on the timeline
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
