import type { MatrixRow } from "@/lib/api/types";

export interface Verdict {
  total: number;
  /** sites that meet both requirements */
  pass: number;
  /** sites that fail the sunlight / Earth requirement (a site failing both counts in each) */
  sunFail: number;
  earthFail: number;
  indeterminate: number;
  /** sites the service could not decide: left out, never counted as failures */
  excluded: number;
  /** sites a flat-horizon estimate would pass but the terrain fails, per requirement */
  flatWouldPassSun: number;
  flatWouldPassEarth: number;
}

/**
 * Counts what the matrix already says. Each requirement is judged on its own and nothing is combined
 * into a rank or a score; excluded sites are counted apart because excluded is not a failure.
 */
export function summarizeRows(rows: MatrixRow[]): Verdict {
  const v: Verdict = {
    total: rows.length,
    pass: 0,
    sunFail: 0,
    earthFail: 0,
    indeterminate: 0,
    excluded: 0,
    flatWouldPassSun: 0,
    flatWouldPassEarth: 0,
  };
  for (const r of rows) {
    if (r.site_status === "PASS") v.pass++;
    if (r.site_status === "FAIL_SUN" || r.site_status === "FAIL_BOTH") v.sunFail++;
    if (r.site_status === "FAIL_EARTH" || r.site_status === "FAIL_BOTH") v.earthFail++;
    if (r.site_status === "INDETERMINATE") v.indeterminate++;
    if (r.site_status === "UNKNOWN_COVERAGE") {
      v.excluded++;
      continue; // an excluded site has no decided numbers to compare
    }
    const sun = r.targets.sun_center;
    const earth = r.targets.earth_center;
    if (sun.terrain.outcome === "FAIL" && sun.flat.outcome === "PASS") v.flatWouldPassSun++;
    if (earth.terrain.outcome === "FAIL" && earth.flat.outcome === "PASS") v.flatWouldPassEarth++;
  }
  return v;
}

const sites = (n: number) => `${n} ${n === 1 ? "site" : "sites"}`;
const fails = (n: number) => (n === 1 ? "fails" : "fail");

/** The answer in one sentence, then what sits behind it. */
export function RunVerdict({ rows }: { rows: MatrixRow[] }) {
  if (rows.length === 0) return null;
  const v = summarizeRows(rows);

  const detail = [
    `${sites(v.sunFail)} ${fails(v.sunFail)} the sunlight requirement`,
    `${sites(v.earthFail)} ${fails(v.earthFail)} the Earth-visibility requirement`,
  ];
  if (v.indeterminate > 0) detail.push(`${sites(v.indeterminate)} cannot be decided`);

  const flat: string[] = [];
  if (v.flatWouldPassSun > 0) flat.push(`sunlight at ${sites(v.flatWouldPassSun)}`);
  if (v.flatWouldPassEarth > 0) flat.push(`Earth visibility at ${sites(v.flatWouldPassEarth)}`);

  return (
    <div>
      <h2 className="type-section">
        {v.pass} of {sites(v.total)} {v.total === 1 ? "meets" : "meet"} both requirements
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        Each requirement is judged on its own: {detail.join("; ")}.
        {v.excluded > 0 && ` ${sites(v.excluded)} excluded for lack of data (not failures).`}
      </p>
      {flat.length > 0 && (
        <p className="mt-1 text-sm leading-6">
          A flat-horizon estimate would pass {flat.join(" and ")} that the terrain fails. The terrain is what changes the
          answer.
        </p>
      )}
    </div>
  );
}
