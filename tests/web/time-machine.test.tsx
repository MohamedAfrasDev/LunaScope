import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimeMachineView } from "@/components/TimeMachineView";
import { matchRoute } from "@/lib/bff";

const BASE = "a".repeat(64);
const CHILD = "b".repeat(64);
const SITE = "rule-89.5S-E0";
const DAY = 86400;
const json = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });

const summary = (run_id: string, status = "complete_with_warnings") => ({
  run_id, result_id: "r", status, stage: "done", progress: 1, result_state: "real_data_unverified", attempt: 1,
  created_utc: "2026-11-13T00:00:00Z", finished_utc: "2026-11-13T00:01:00Z", algorithm_id: "lunascope-science/x",
  warnings: ["UNVERIFIED"], verified: false, matrix: [],
});

const metrics = (outcome: string, lo: number) => ({
  outcome, availability_lower: lo, availability_upper: lo, threshold: 0.6, longest_known_hidden_s: 3600, margin_lower: 0,
  margin_upper: 0, visible_s: 0, hidden_s: 0, unknown_s: 0, exclusion_reasons: [], known_time_fraction: 1,
  longest_known_hidden_start: null, longest_known_hidden_end: null, worst_case_not_visible_s: 0,
});

function results(run_id: string, startMs: number, sunText: string) {
  const iv = (cls: string, a: number, b: number) => ({
    start_s: a, end_s: b, class: cls,
    start_utc: new Date(startMs + a * 1000).toISOString(), end_utc: new Date(startMs + b * 1000).toISOString(),
  });
  const block = (outcome: string, text: string) => ({
    metrics: metrics(outcome, outcome === "PASS" ? 0.8 : 0.2), clearance_at_nodes: null,
    countdown_at_start: { kind: "set", text, remaining_s: 3 * 3600 },
    intervals: [iv("V", 0, 3 * 3600), iv("H", 3 * 3600, 2 * DAY)],
    events: [{ t_s: 3 * 3600, t_utc: new Date(startMs + 3 * 3600 * 1000).toISOString(), type: "set", solver_bracket_s: 1,
               geometry_timing_bound_s: 0.1, quality: "normal" }],
  });
  return {
    run_id, result_id: "r", status: "complete_with_warnings", result_state: "real_data_unverified", warnings: [],
    sites: [{ site_id: SITE, validity: "unverified", site_status: "FAIL_SUN", result_state: "real_data_unverified", warnings: [],
      target_metrics: { sun_center: { terrain: block("FAIL", sunText) }, earth_center: { terrain: block("PASS", "Predicted set") } } }],
  };
}

const row = (outcome: string, lo: number) => ({
  outcome, availability_lower: lo, availability_upper: lo, margin_lower: 0, margin_upper: 0, longest_known_hidden_s: 3600,
  worst_case_not_visible_s: 0, events: 1, exclusion_reasons: [],
});
function comparison(alignment: "elapsed" | "calendar") {
  return {
    mode: "runs", compatible: true, alignment,
    runs: { a: { run_id: BASE, start_utc: "2027-01-10T00:00:00Z" }, b: { run_id: CHILD, start_utc: "2027-01-15T00:00:00Z" } },
    shift_s: 5 * DAY, overlap: alignment === "calendar" ? { start_utc: "2027-01-15T00:00:00Z", duration_s: 2 * DAY } : null,
    held_constant: [{ field: "terrain.radius_km", value: 150 }],
    changed: [{ field: "mission.start_utc", from: "2027-01-10T00:00:00Z", to: "2027-01-15T00:00:00Z" }],
    sites: [{ site_id: SITE, site_status: { a: "FAIL_SUN", b: "PASS" }, targets: {
      sun_center: { a: row("FAIL", 0.2), b: row("PASS", 0.8), delta: { availability_lower: 0.6, availability_upper: 0.6, longest_known_hidden_s: 0 },
        outcome_change: "FAIL to PASS", event_count: [1, 1], changed_intervals: [{ start_s: 0, end_s: 3600, a: "H", b: "V" }],
        terrain_vs_flat: { a: "PASS", b: "PASS" } },
      earth_center: { a: row("PASS", 0.8), b: row("PASS", 0.8), delta: { availability_lower: 0, availability_upper: 0, longest_known_hidden_s: 0 },
        outcome_change: null, event_count: [1, 1], changed_intervals: [], terrain_vs_flat: { a: "PASS", b: "PASS" } },
    } }],
    result_state: "real_data_unverified", warnings: ["UNVERIFIED"], verified: false,
    note: alignment === "elapsed" ? "elapsed: each run keeps its own UTC and the same elapsed time is compared"
      : "calendar: one shared UTC axis; only the overlap is compared, time outside a run's own window is never counted",
  };
}

interface Opts { children?: boolean; slowElapsed?: boolean }
let calls: { url: string; body?: unknown }[] = [];
let releaseElapsed: (() => void) | null = null;
function stub(o: Opts = {}) {
  calls = [];
  let variantCreated = !!o.children;
  vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
    const url = String(u);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    if (url.endsWith(`/analyses/${BASE}/variants`) && init?.method === "POST") {
      variantCreated = true;
      return json({ ...summary(CHILD, "queued"), parent_run_id: BASE, variant_type: "date_shift", changed_fields: ["mission.start_utc"],
        start_utc: "2027-01-15T00:00:00Z", parent_start_utc: "2027-01-10T00:00:00Z", attached: false, status_url: "x" }, 202);
    }
    if (url.endsWith(`/analyses/${BASE}/variants`))
      return json({ run_id: BASE, start_utc: "2027-01-10T00:00:00Z", parents: [], children: variantCreated ? [{
        child_run_id: CHILD, parent_run_id: BASE, variant_type: "date_shift", changed_fields: ["mission.start_utc"],
        status: "complete", created_utc: "2026-11-13T00:00:00Z", start_utc: "2027-01-15T00:00:00Z" }] : [] });
    if (url.includes("/comparisons")) {
      if (o.slowElapsed && body.alignment === "elapsed")
        await new Promise<void>((r) => { releaseElapsed = r; }); // reply arrives late
      return json(comparison(body.alignment));
    }
    if (url.includes(`/analyses/${BASE}/results`)) return json(results(BASE, Date.UTC(2027, 0, 10), "Predicted set under this terrain model"));
    if (url.includes(`/analyses/${CHILD}/results`)) return json(results(CHILD, Date.UTC(2027, 0, 15), "Predicted set under this terrain model"));
    if (url.endsWith(`/analyses/${BASE}`)) return json(summary(BASE));
    if (url.endsWith(`/analyses/${CHILD}`)) return json(summary(CHILD));
    return json({ error: { code: "NOT_FOUND", message: url, field: null, retryable: false, correlation_id: null } }, 404);
  }));
}
afterEach(() => {
  vi.unstubAllGlobals();
  releaseElapsed = null;
});

describe("BFF allow-list for variants", () => {
  it("allows POST and GET /analyses/{id}/variants only, with a small body limit", () => {
    expect(matchRoute("POST", ["analyses", BASE, "variants"], new URLSearchParams())).toMatchObject({
      ok: true, match: { upstreamPath: `/api/v1/analyses/${BASE}/variants`, maxBodyBytes: 4096 } });
    expect(matchRoute("GET", ["analyses", BASE, "variants"], new URLSearchParams())).toMatchObject({ ok: true });
    expect(matchRoute("POST", ["analyses", "xyz", "variants"], new URLSearchParams())).toMatchObject({ ok: false });
    expect(matchRoute("GET", ["analyses", BASE, "variants"], new URLSearchParams("x=1"))).toMatchObject({ ok: false, reason: "invalid_query" });
  });
});

describe("TimeMachineView", () => {
  it("creates a five-day date-shift variant and shows deltas and the changed field", async () => {
    stub();
    render(<TimeMachineView runId={BASE} />);
    const input = await screen.findByLabelText("Shift the start by (days)");
    expect(input).toHaveValue(5);
    fireEvent.click(screen.getByRole("button", { name: "Shift and recompute" }));
    expect(await screen.findByText(/Shifted by \+5 d, compared in elapsed time/)).toBeInTheDocument();
    const post = calls.find((c) => c.url.endsWith("/variants") && c.body);
    expect(post?.body).toEqual({ variant_type: "date_shift", changes: { start_offset_s: 5 * DAY } });
    expect(screen.getByText(/Start/, { selector: "li" })).toHaveTextContent("2027-01-10 00:00:00 UTC → 2027-01-15 00:00:00 UTC");
    const table = screen.getByRole("table", { name: /Baseline and shifted results/ });
    expect(within(table).getByText(/\+60\.0 percentage points/)).toBeInTheDocument();
    expect(within(table).getByText(/Outcome changes: Fail → Pass/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b(winner|score|ranking|best date)\b/i);
  });

  it("case 14: each panel keeps its own UTC, events and countdown", async () => {
    stub({ children: true });
    render(<TimeMachineView runId={BASE} />);
    const base = await screen.findByRole("article", { name: "Baseline run" });
    const shifted = screen.getByRole("article", { name: "Shifted run" });
    expect(within(base).getByText("Starts 2027-01-10 00:00:00 UTC")).toBeInTheDocument();
    expect(within(shifted).getByText("Starts 2027-01-15 00:00:00 UTC")).toBeInTheDocument();
    // the countdown at each run's start resolves to that run's own clock
    expect(within(base).getAllByText(/in 3 h \(2027-01-10 03:00:00 UTC\)/)).toHaveLength(2);
    expect(within(shifted).getAllByText(/in 3 h \(2027-01-15 03:00:00 UTC\)/)).toHaveLength(2);
    // changed spans: baseline and shifted clocks differ under elapsed alignment
    fireEvent.click(screen.getByText(/Sun at 89\.5°S, 0°E: 1 span/));
    expect(screen.getByText("2027-01-10 00:00:00 UTC to 2027-01-10 01:00:00 UTC")).toBeInTheDocument();
    expect(screen.getByText("2027-01-15 00:00:00 UTC to 2027-01-15 01:00:00 UTC")).toBeInTheDocument();
  });

  it("asks again in calendar mode, states the shared window, and a late reply cannot overwrite it", async () => {
    stub({ children: true, slowElapsed: true });
    render(<TimeMachineView runId={BASE} />);
    await screen.findByRole("article", { name: "Baseline run" });
    await waitFor(() => expect(releaseElapsed).not.toBeNull()); // the elapsed reply is still in flight
    fireEvent.click(screen.getByLabelText(/Calendar time/));
    expect(await screen.findByText(/compared in calendar time/)).toBeInTheDocument();
    expect(screen.getByText(/Shared window: 2027-01-15 00:00:00 UTC for 2 d/)).toBeInTheDocument();
    releaseElapsed?.();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText(/compared in calendar time/)).toBeInTheDocument(); // not replaced by the stale elapsed reply
    expect(screen.queryByText(/compared in elapsed time/)).toBeNull();
  });

  it("validates the shift before sending anything", async () => {
    stub();
    render(<TimeMachineView runId={BASE} />);
    const input = await screen.findByLabelText("Shift the start by (days)");
    fireEvent.change(input, { target: { value: "0" } });
    expect(screen.getByText("A shift of zero days is the baseline itself.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shift and recompute" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "45" } });
    expect(screen.getByText("Shift by at most 30 days either way.")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(calls.some((c) => c.body)).toBe(false);
  });

  it("refuses non-overlapping calendar windows with the service's message", async () => {
    stub({ children: true });
    const real = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      if (String(u).includes("/comparisons") && JSON.parse(String(init?.body)).alignment === "calendar")
        return json({ error: { code: "INCOMPATIBLE_RUNS", message: "the two windows do not overlap in calendar time",
          field: null, retryable: false, correlation_id: "c" } }, 422);
      return real(u, init);
    }));
    render(<TimeMachineView runId={BASE} />);
    await screen.findByText(/compared in elapsed time/);
    fireEvent.click(screen.getByLabelText(/Calendar time/));
    expect(await screen.findByRole("alert")).toHaveTextContent("the two windows do not overlap in calendar time");
    expect(screen.queryByText(/compared in elapsed time/)).toBeNull(); // the old comparison is not left on screen
  });
});
