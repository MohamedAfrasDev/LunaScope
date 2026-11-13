import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResultStateFrame } from "@/components/ResultStateFrame";
import { RunView } from "@/components/RunView";
import { StatusMatrix } from "@/components/StatusMatrix";
import type { MatrixCell, MatrixRow, RunStatusResponse } from "@/lib/api/types";

const RUN = "c".repeat(64);
const cell = (outcome: MatrixCell["outcome"], lo: number, hi: number, threshold = 0.6): MatrixCell => ({
  outcome,
  availability_lower: lo,
  availability_upper: hi,
  threshold,
});
const row = (id: string): MatrixRow => ({
  site_id: id,
  site_status: "FAIL_SUN",
  targets: {
    sun_center: { terrain: cell("FAIL", 0, 0), flat: cell("PASS", 1, 1) },
    earth_center: { terrain: cell("INDETERMINATE", 0.58, 0.62, 0.6), flat: cell("EXCLUDED", 0, 1, 0.5) },
  },
});

const done = (over: Partial<RunStatusResponse> = {}): RunStatusResponse => ({
  run_id: RUN,
  result_id: "r".repeat(64),
  status: "complete_with_warnings",
  stage: "done",
  progress: 1,
  result_state: "synthetic_demonstration",
  attempt: 1,
  created_utc: "2027-01-01T00:00:00Z",
  finished_utc: "2027-01-01T00:01:00Z",
  algorithm_id: "lunascope-science/test",
  warnings: ["DEMONSTRATION_DATA"],
  verified: false,
  matrix: [row("rule-89.5S-E0")],
  ...over,
});

function mockFetch(handler: (url: string) => { status?: number; body: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const r = handler(String(url));
      return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
    }),
  );
}

beforeEach(() => vi.useRealTimers());
afterEach(() => vi.unstubAllGlobals());

describe("StatusMatrix", () => {
  it("shows every state as an icon plus a word, with the bound and the requirement", () => {
    render(<StatusMatrix runId={RUN} rows={[row("rule-89.5S-E0")]} />);
    const table = screen.getByRole("table");
    for (const word of ["Fail", "Pass", "Indeterminate", "Excluded"])
      expect(within(table).getAllByText(word).length).toBeGreaterThan(0);
    expect(within(table).getByText("58.0–62.0%")).toBeInTheDocument(); // a bound, not a point
    expect(within(table).getAllByText(/needs at least 60%/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /timeline and evidence/i })).toHaveAttribute(
      "href",
      `/runs/${RUN}/timeline/rule-89.5S-E0`,
    );
  });

  it("labels which column decides and which is the flat-horizon comparison, and has no score", () => {
    render(<StatusMatrix runId={RUN} rows={[row("rule-89.5S-E0")]} />);
    expect(screen.getAllByText(/terrain-aware \(decides\)/)).toHaveLength(2);
    expect(screen.getAllByText(/flat horizon \(comparison\)/)).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/score|rank|winner|best site/i);
  });
});

describe("ResultStateFrame", () => {
  it.each([
    ["synthetic_demonstration", "Synthetic demonstration"],
    ["real_data_unverified", "Real data, unverified"],
  ] as const)("always names the state: %s", (state, label) => {
    render(<ResultStateFrame state={state}><p>numbers</p></ResultStateFrame>);
    expect(screen.getByRole("region", { name: new RegExp(label) })).toBeInTheDocument();
    expect(screen.getByText("numbers")).toBeInTheDocument();
  });
});

describe("RunView", () => {
  it("renders a finished run inside its result-state frame with warnings and no verified claim", async () => {
    mockFetch((url) => (url.includes("provenance") ? { status: 500, body: { error: { code: "X", message: "m", field: null, retryable: false, correlation_id: null } } } : { body: done() }));
    render(<RunView runId={RUN} />);
    expect(await screen.findByRole("region", { name: /Synthetic demonstration/ })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("DEMONSTRATION_DATA")).toBeInTheDocument();
    expect(screen.queryByText(/validated/i)).not.toBeInTheDocument();
  });

  it("shows progress while running", async () => {
    mockFetch(() => ({ body: done({ status: "running", stage: "site 1/3: rule-89.5S-E0", progress: 0.33, matrix: undefined, warnings: undefined }) }));
    render(<RunView runId={RUN} />);
    expect(await screen.findByText(/Running: site 1\/3/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /progress/i })).toHaveAttribute("value", "0.33");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("a failed run shows the code and never a pass or fail", async () => {
    mockFetch(() => ({ body: done({ status: "failed", matrix: undefined, error: { code: "TIMEOUT", message: "exceeded 900 s" } }) }));
    render(<RunView runId={RUN} />);
    expect(await screen.findByText(/did not complete/)).toBeInTheDocument();
    expect(screen.getByText(/TIMEOUT: exceeded 900 s/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("an unknown run id says so", async () => {
    mockFetch(() => ({ status: 404, body: { error: { code: "NOT_FOUND", message: "no run", field: null, retryable: false, correlation_id: "c" } } }));
    render(<RunView runId={RUN} />);
    expect(await screen.findByText("Run not found")).toBeInTheDocument();
  });

  it("ignores a reply that belongs to a different run (result binding)", async () => {
    mockFetch(() => ({ body: done({ run_id: "d".repeat(64) }) }));
    render(<RunView runId={RUN} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("reports an unreachable service and keeps trying instead of inventing a state", async () => {
    mockFetch(() => ({ status: 502, body: { error: { code: "SERVICE_UNAVAILABLE", message: "down", field: null, retryable: true, correlation_id: "c" } } }));
    render(<RunView runId={RUN} />);
    expect(await screen.findByText(/not reachable/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
