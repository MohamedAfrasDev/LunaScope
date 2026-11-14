import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RunNav, parseView } from "@/components/RunNav";
import type { MatrixRow, RunStatusResponse } from "@/lib/api/types";

const RUN = "a".repeat(64);
const nav = { params: { runId: RUN } as Record<string, string>, path: `/runs/${RUN}` };
vi.mock("next/navigation", () => ({
  useParams: () => nav.params,
  usePathname: () => nav.path,
}));

const row = (id: string) => ({ site_id: id, site_status: "FAIL_SUN", targets: {} }) as unknown as MatrixRow;
const run = (ids: string[]): RunStatusResponse =>
  ({
    run_id: RUN,
    status: "complete",
    result_state: "real_data_unverified",
    matrix: ids.map(row),
  }) as unknown as RunStatusResponse;

function serve(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })),
  );
}

beforeEach(() => {
  nav.params = { runId: RUN };
  nav.path = `/runs/${RUN}`;
});
afterEach(() => vi.unstubAllGlobals());

describe("parseView", () => {
  const base = `/runs/${RUN}`;
  it("reads the view and the site from the path", () => {
    expect(parseView(base, base)).toEqual({ kind: "matrix" });
    expect(parseView(`${base}/timeline/rule-89.5S-E0`, base)).toEqual({ kind: "timeline", siteId: "rule-89.5S-E0" });
    expect(parseView(`${base}/sky/rule-89.5S-E240`, base)).toEqual({ kind: "sky", siteId: "rule-89.5S-E240" });
    expect(parseView(`${base}/compare`, base).kind).toBe("compare");
    expect(parseView(`${base}/time-machine`, base).kind).toBe("time-machine");
    expect(parseView(`${base}/evidence`, base).kind).toBe("evidence");
  });
  it("falls back to the matrix for anything else", () => {
    expect(parseView("/elsewhere", base).kind).toBe("matrix");
  });
});

describe("RunNav", () => {
  it("lists every view once the sites are known and marks the current one", async () => {
    serve(run(["rule-89.5S-E0", "rule-89.5S-E120"]));
    render(<RunNav />);
    const views = await screen.findByRole("navigation", { name: "Analysis views" });
    await within(views).findByRole("link", { name: "Timeline" });
    for (const name of ["Matrix", "Timeline", "Sky", "Compare", "Time Machine", "Evidence"])
      expect(within(views).getByRole("link", { name })).toBeInTheDocument();
    expect(within(views).getByRole("link", { name: "Matrix" })).toHaveAttribute("aria-current", "page");
    expect(within(views).getByRole("link", { name: "Timeline" })).toHaveAttribute("href", `/runs/${RUN}/timeline/rule-89.5S-E0`);
    expect(screen.queryByRole("navigation", { name: "Switch site" })).toBeNull(); // only on site views
  });

  it("hides Compare for a single site", async () => {
    serve(run(["rule-89.5S-E0"]));
    render(<RunNav />);
    const views = await screen.findByRole("navigation", { name: "Analysis views" });
    await within(views).findByRole("link", { name: "Timeline" });
    expect(within(views).queryByRole("link", { name: "Compare" })).toBeNull();
  });

  it("on a site view, switches site and keeps the same tab", async () => {
    nav.path = `/runs/${RUN}/sky/rule-89.5S-E120`;
    serve(run(["rule-89.5S-E0", "rule-89.5S-E120", "rule-89.5S-E240"]));
    render(<RunNav />);
    const sites = await screen.findByRole("navigation", { name: "Switch site" });
    const links = within(sites).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["89.5°S, 0°E", "89.5°S, 120°E", "89.5°S, 240°E"]);
    expect(links[1]).toHaveAttribute("aria-current", "true");
    expect(links[2]).toHaveAttribute("href", `/runs/${RUN}/sky/rule-89.5S-E240`);
    const views = screen.getByRole("navigation", { name: "Analysis views" });
    expect(within(views).getByRole("link", { name: "Sky" })).toHaveAttribute("aria-current", "page");
    expect(within(views).getByRole("link", { name: "Sky" })).toHaveAttribute("href", `/runs/${RUN}/sky/rule-89.5S-E120`);
  });

  it("shows the run's own result state next to the tabs", async () => {
    serve(run(["rule-89.5S-E0"]));
    render(<RunNav />);
    expect(await screen.findByText("Real data, unverified")).toBeInTheDocument();
  });

  it("renders nothing for a run that does not exist, or an invalid id", async () => {
    serve({ error: { code: "NOT_FOUND", message: "no such run" } }, 404);
    const { container } = render(<RunNav />);
    // the bar appears while the run is loading, then goes once the service says the run does not exist
    await vi.waitFor(() => expect(container.querySelector("nav")).toBeNull());

    nav.params = { runId: "nope" };
    const second = render(<RunNav />);
    expect(second.container.querySelector("nav")).toBeNull();
  });
});
