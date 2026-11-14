import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AlternativesStrip } from "@/components/AlternativesStrip";
import { matchRoute } from "@/lib/bff";

const RUN = "a".repeat(64);
const SID = "b".repeat(32);
const json = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });
afterEach(() => vi.unstubAllGlobals());

const site = (status: string, margin: number) => ({
  site_id: "rule-89.5S-E0", site_status: status, sun_outcome: "PASS", earth_outcome: "PASS",
  sun_margin: margin, earth_margin: margin, objective_margin: margin,
});
const date = (days: number, state: string, verdict: string | null, status = "PASS", margin = 0.1, err: unknown = null) => ({
  offset_s: days * 86400, offset_days: days, run_id: state === "pending" ? null : `${days}`.padEnd(64, "c"), state,
  start_utc: new Date(Date.UTC(2027, 0, 10 + days)).toISOString().replace(".000Z", "Z"), verdict,
  sites: verdict ? [site(status, margin)] : [], error: err,
});
const strip = (over: Record<string, unknown> = {}) => ({
  search_id: SID, parent_run_id: RUN, objective: "Smaller of the Sun and Earth margin. Not a score or a ranking.",
  complete: true, counts: { planned: 5, tested: 4, passing: 2, failing: 1, unknown: 1, pending: 0, failed_runs: 0 },
  dates: [date(-1, "complete", "fail", "FAIL_SUN", -0.2), date(0, "baseline", "pass", "PASS", 0.1),
    date(1, "complete", "pass", "PASS", 0.3), date(2, "complete", "unknown", "INDETERMINATE", -0.01)],
  largest_margin_among_passing: { "rule-89.5S-E0": 86400 },
  note: "A date that is still pending or failed is not counted as a pass or a fail.", ...over,
});

function stub(initial: unknown[], posts: unknown[] = []) {
  vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
    const url = String(u);
    if (init?.method === "POST") {
      posts.push(JSON.parse(String(init.body)));
      return json({ search_id: SID, parent_run_id: RUN, variant_type: "alternatives_search", planned: 4, attached: false,
        objective: "x", status_url: `/api/v1/analyses/${RUN}/searches/${SID}` }, 202);
    }
    if (url.endsWith("/searches")) return json({ run_id: RUN, searches: initial });
    if (url.includes(`/searches/${SID}`)) return json(strip());
    return json({ error: { code: "NOT_FOUND", message: url, field: null, retryable: false, correlation_id: null } }, 404);
  }));
}

describe("BFF allow-list for searches", () => {
  it("allows only the two GETs, with a 32-hex search id", () => {
    expect(matchRoute("GET", ["analyses", RUN, "searches"], new URLSearchParams())).toMatchObject({ ok: true });
    expect(matchRoute("GET", ["analyses", RUN, "searches", SID], new URLSearchParams())).toMatchObject({
      ok: true, match: { upstreamPath: `/api/v1/analyses/${RUN}/searches/${SID}` } });
    expect(matchRoute("GET", ["analyses", RUN, "searches", "xyz"], new URLSearchParams())).toMatchObject({ ok: false });
    expect(matchRoute("POST", ["analyses", RUN, "searches"], new URLSearchParams())).toMatchObject({ ok: false, reason: "method_not_allowed" });
  });
});

describe("AlternativesStrip", () => {
  it("validates the range before sending anything, and states the 15-date limit", async () => {
    const posts: unknown[] = [];
    stub([], posts);
    render(<AlternativesStrip runId={RUN} onOpenDate={() => undefined} />);
    expect(await screen.findByRole("button", { name: "Test 15 dates" })).toBeEnabled(); // -7..+7 by 1
    fireEvent.change(screen.getByLabelText("From (days)"), { target: { value: "-30" } });
    fireEvent.change(screen.getByLabelText("To (days)"), { target: { value: "30" } });
    expect(screen.getByText(/That is 61 dates; at most 15/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test 61 dates" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("To (days)"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("From (days)"), { target: { value: "5" } });
    expect(screen.getByText("The first date must not be after the last.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("From (days)"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("To (days)"), { target: { value: "0" } });
    expect(screen.getByText("That range holds only the baseline.")).toBeInTheDocument();
    expect(posts).toEqual([]);
  });

  it("sends the search and shows the strip with counts, words not just colour, and the stated objective", async () => {
    const posts: unknown[] = [];
    stub([], posts);
    render(<AlternativesStrip runId={RUN} onOpenDate={() => undefined} />);
    fireEvent.change(await screen.findByLabelText("From (days)"), { target: { value: "-1" } });
    fireEvent.change(screen.getByLabelText("To (days)"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Test 4 dates" }));
    expect(await screen.findByText(/4 of 5/)).toBeInTheDocument();
    expect(posts).toEqual([{ variant_type: "alternatives_search", changes: { from_days: -1, to_days: 2, step_days: 1 } }]);
    expect(screen.getByText(/2 pass, 1 fail, 1 unknown/)).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Tested dates" });
    expect(within(list).getAllByText("Passes")).toHaveLength(2);
    expect(within(list).getByText("Fails")).toBeInTheDocument();
    expect(within(list).getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText(/Objective, stated:/)).toBeInTheDocument();
    expect(screen.getByText(/largest margin among passing dates is \+1 d/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b(best date|winner|recommended)\b/i);
  });

  it("never counts a waiting, running or failed date as a pass or a fail", async () => {
    const mid = strip({
      complete: false, counts: { planned: 5, tested: 1, passing: 1, failing: 0, unknown: 0, pending: 3, failed_runs: 1 },
      dates: [date(0, "baseline", "pass"), date(1, "running", null), date(2, "pending", null), date(3, "queued", null),
        date(4, "failed", null, "PASS", 0, { code: "TIMEOUT", message: "x" })],
    });
    stub([mid]);
    render(<AlternativesStrip runId={RUN} onOpenDate={() => undefined} />);
    const list = await screen.findByRole("list", { name: "Tested dates" });
    expect(within(list).getByText("Running")).toBeInTheDocument();
    expect(within(list).getByText("Queued")).toBeInTheDocument();
    expect(within(list).getByText("Not run yet")).toBeInTheDocument();
    expect(within(list).getByText("Run failed")).toBeInTheDocument();
    expect(within(list).getAllByText("Passes")).toHaveLength(1); // only the baseline
    expect(screen.getByText(/3 not finished yet, 1 run\(s\) failed/)).toBeInTheDocument();
    expect(screen.getByText(/1 of 5/)).toBeInTheDocument();
  });

  it("offers Compare for a tested date, and the table lists every site and margin", async () => {
    const onOpen = vi.fn();
    stub([strip()]);
    render(<AlternativesStrip runId={RUN} onOpenDate={onOpen} />);
    await screen.findByRole("list", { name: "Tested dates" });
    fireEvent.click(screen.getByText("View the tested dates as a table"));
    const table = screen.getByRole("table", { name: /Each tested start date/ });
    expect(within(table).getAllByRole("button", { name: "Compare" })).toHaveLength(3); // not the baseline
    fireEvent.click(within(table).getAllByRole("button", { name: "Compare" })[1]);
    expect(onOpen).toHaveBeenCalledWith(1, expect.stringMatching(/^1c+$/));
    expect(within(table).getByText(/margin \+30\.0%/)).toBeInTheDocument();
  });

  it("says plainly when the service refuses (for example in replay mode)", async () => {
    stub([]);
    const real = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => init?.method === "POST"
      ? json({ error: { code: "REPLAY_ONLY", message: "x", field: null, retryable: false, correlation_id: "c" } }, 409)
      : real(u, init)));
    render(<AlternativesStrip runId={RUN} onOpenDate={() => undefined} />);
    fireEvent.click(await screen.findByRole("button", { name: "Test 15 dates" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/offline copy/));
  });
});
