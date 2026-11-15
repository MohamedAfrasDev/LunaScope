import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RunVerdict, summarizeRows } from "@/components/RunVerdict";
import { RunView } from "@/components/RunView";
import { SiteCards } from "@/components/SiteCard";
import type { MatrixCell, MatrixRow, RunStatusResponse, SiteStatus } from "@/lib/api/types";

const RUN = "b".repeat(64);
const c = (outcome: MatrixCell["outcome"], lo = 0, hi = 0, threshold = 0.6): MatrixCell => ({
  outcome,
  availability_lower: lo,
  availability_upper: hi,
  threshold,
});

/** terrain and flat outcomes can differ, which is the point of the product */
const row = (
  id: string,
  status: SiteStatus,
  sunTerrain: MatrixCell["outcome"] = "FAIL",
  sunFlat: MatrixCell["outcome"] = "PASS",
  earthTerrain: MatrixCell["outcome"] = "PASS",
  earthFlat: MatrixCell["outcome"] = "PASS",
): MatrixRow => ({
  site_id: id,
  site_status: status,
  targets: {
    sun_center: { terrain: c(sunTerrain, 0, 0), flat: c(sunFlat, 1, 1) },
    earth_center: { terrain: c(earthTerrain, 0.745, 0.747, 0.5), flat: c(earthFlat, 0.92, 0.924, 0.5) },
  },
});

const ROWS = [
  row("rule-89.5S-E0", "FAIL_SUN"),
  row("rule-89.5S-E120", "FAIL_BOTH", "FAIL", "PASS", "FAIL", "PASS"),
  row("rule-89.5S-E240", "PASS", "PASS", "PASS"),
  row("rule-89.5S-E999", "UNKNOWN_COVERAGE"),
];

describe("summarizeRows", () => {
  it("counts each requirement on its own and keeps excluded apart", () => {
    const v = summarizeRows(ROWS);
    expect(v).toMatchObject({ total: 4, pass: 1, sunFail: 2, earthFail: 1, indeterminate: 0, excluded: 1 });
  });
  it("counts where a flat horizon would have passed what the terrain fails, ignoring excluded sites", () => {
    const v = summarizeRows(ROWS);
    expect(v.flatWouldPassSun).toBe(2); // E0 and E120
    expect(v.flatWouldPassEarth).toBe(1); // E120
  });
});

describe("RunVerdict", () => {
  it("states the answer, the per-requirement detail and the flat-horizon contrast", () => {
    render(<RunVerdict rows={ROWS} />);
    expect(screen.getByRole("heading", { name: "1 of 4 sites meet both requirements" })).toBeInTheDocument();
    expect(screen.getByText(/2 sites fail the sunlight requirement; 1 site fails the Earth-visibility requirement/)).toBeInTheDocument();
    expect(screen.getByText(/1 site excluded for lack of data \(not failures\)/)).toBeInTheDocument();
    expect(screen.getByText(/would pass sunlight at 2 sites and Earth visibility at 1 site that the terrain fails/)).toBeInTheDocument();
  });
  it("uses singular verbs for a single site", () => {
    render(<RunVerdict rows={[row("rule-89.5S-E0", "FAIL_SUN")]} />);
    expect(screen.getByRole("heading", { name: "0 of 1 site meets both requirements" })).toBeInTheDocument();
    expect(screen.getByText(/1 site fails the sunlight requirement; 0 sites fail the Earth-visibility requirement/)).toBeInTheDocument();
  });
  it("never ranks, scores or names a winner", () => {
    const { container } = render(<RunVerdict rows={ROWS} />);
    expect(container.textContent).not.toMatch(/score|rank|winner|best site/i);
  });
  it("says nothing for a run with no rows", () => {
    const { container } = render(<RunVerdict rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("SiteCards", () => {
  it("makes a card per decided site, with terrain first and the flat horizon as a comparison", () => {
    render(<SiteCards runId={RUN} rows={ROWS} />);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    const card = screen.getByRole("article", { name: "89.5°S, 0°E" });
    expect(within(card).getByText("Fail: Sun")).toBeInTheDocument(); // overall: icon + word
    expect(within(card).getAllByText(/Flat horizon \(comparison\)/)).toHaveLength(2);
    expect(within(card).getByText("74.5–74.7%")).toBeInTheDocument(); // a bound, not a point
    expect(within(card).getByRole("link", { name: "Timeline and evidence" })).toHaveAttribute(
      "href", `/runs/${RUN}/timeline/rule-89.5S-E0`);
    expect(within(card).getByRole("link", { name: "Local sky" })).toHaveAttribute("href", `/runs/${RUN}/sky/rule-89.5S-E0`);
  });
  it("does not make a card for an excluded site: excluded is not a failure", () => {
    render(<SiteCards runId={RUN} rows={ROWS} />);
    expect(screen.queryByText("89.5°S, 999°E")).toBeNull();
    expect(screen.queryByRole("article", { name: /999/ })).toBeNull();
  });
  it("draws the availability bars as decoration only, since the numbers are written beside them", () => {
    const { container } = render(<SiteCards runId={RUN} rows={[ROWS[0]]} />);
    const bars = container.querySelectorAll(".bg-muted.rounded-full");
    expect(bars.length).toBe(2);
    bars.forEach((b) => expect(b).toHaveAttribute("aria-hidden", "true"));
  });
});

const done = (rows: MatrixRow[], warnings: string[] = ["UNVERIFIED", "EOP_PREDICTED"]): RunStatusResponse =>
  ({
    run_id: RUN,
    result_id: "r".repeat(64),
    status: "complete_with_warnings",
    stage: "done",
    progress: 1,
    result_state: "real_data_unverified",
    attempt: 1,
    created_utc: "2027-01-01T00:00:00Z",
    finished_utc: "2027-01-01T00:01:00Z",
    algorithm_id: "lunascope-science/test",
    warnings,
    verified: false,
    matrix: rows,
  }) as unknown as RunStatusResponse;

function serve(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      (String(url).includes("provenance") || String(url).includes("validation"))
        ? new Response("{}", { status: 500 })
        : new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }),
    ),
  );
}
afterEach(() => vi.unstubAllGlobals());

describe("RunView composition", () => {
  it("leads with the verdict and the cards; the full table and the warnings are one click away", async () => {
    serve(done(ROWS));
    render(<RunView runId={RUN} />);
    expect(await screen.findByRole("heading", { name: /1 of 4 sites meet both requirements/ })).toBeInTheDocument();
    const frame = screen.getByRole("region", { name: /Result state: Real data, unverified/ });
    expect(within(frame).getAllByRole("article")).toHaveLength(3);

    const tableBox = screen.getByRole("table").closest("details")!;
    expect(tableBox).not.toHaveAttribute("open");
    expect(within(tableBox).getByText(/Full comparison table/)).toBeInTheDocument();

    const warnBox = screen.getByText("UNVERIFIED").closest("details")!;
    expect(warnBox).not.toHaveAttribute("open");
    expect(within(warnBox).getByText("Warnings carried with these results (2)")).toBeInTheDocument();
  });

  it("keeps excluded sites and the compare link visible, outside the closed table", async () => {
    serve(done(ROWS));
    render(<RunView runId={RUN} />);
    const excluded = await screen.findByRole("region", { name: "Excluded sites" });
    expect(excluded.closest("details")).toBeNull();
    expect(within(excluded).getByText(/not counted as\s+failures/)).toBeInTheDocument();
    const compare = screen.getByRole("link", { name: "Compare these sites side by side" });
    expect(compare.closest("details")).toBeNull();
  });

  it("opens the table straight away when no site could be decided", async () => {
    serve(done([row("rule-89.5S-E0", "UNKNOWN_COVERAGE")], []));
    render(<RunView runId={RUN} />);
    const table = await screen.findByRole("table");
    expect(table.closest("details")).toHaveAttribute("open");
    expect(screen.getByText("No site in this run could be decided.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).toBeNull();
  });
});
