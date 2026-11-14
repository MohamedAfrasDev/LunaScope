import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataStatusAlert, DataStatusPill, DataStatusProvider } from "@/components/DataStatusBanner";

function health(body: Record<string, unknown> | "down") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (body === "down") throw new TypeError("network");
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }),
  );
}

function renderStatus() {
  return render(
    <DataStatusProvider>
      <DataStatusAlert />
      <DataStatusPill />
    </DataStatusProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("data status pill", () => {
  it("names a synthetic stack in words, with an icon, and keeps the sentence one click away", async () => {
    health({ status: "ok", mode: "live", stack: "synthetic" });
    const user = userEvent.setup();
    renderStatus();
    expect(await screen.findByText("Synthetic demonstration data")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByText("Synthetic demonstration data"));
    expect(screen.getByText(/values are invented test fixtures, not lunar results/)).toBeInTheDocument();
    expect(screen.queryByText("Replay mode")).toBeNull();
  });

  it("says real data is unverified and not flight-qualified", async () => {
    health({ status: "ok", mode: "live", stack: "live" });
    const user = userEvent.setup();
    renderStatus();
    await user.click(await screen.findByText("Real data, unverified"));
    expect(screen.getByText(/no validation gate has closed/)).toBeInTheDocument();
    expect(screen.getByText(/not flight-qualified/)).toBeInTheDocument();
  });

  it("marks replay mode on the pill and explains the offline copy in the panel", async () => {
    health({ status: "ok", mode: "replay", stack: "live" });
    const user = userEvent.setup();
    renderStatus();
    const chip = await screen.findByText("Replay mode");
    await user.click(chip);
    expect(screen.getByText(/offline copy: it shows saved runs only and cannot compute new ones/)).toBeInTheDocument();
  });

  it("closes the panel with Escape and returns focus to the pill", async () => {
    health({ status: "ok", mode: "live", stack: "live" });
    const user = userEvent.setup();
    renderStatus();
    const label = await screen.findByText("Real data, unverified");
    const summary = label.closest("summary")!;
    await user.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
    await user.keyboard("{Escape}");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(summary).toHaveFocus();
  });

  it("shows a prominent banner, and no pill, when the service cannot be reached", async () => {
    health("down");
    renderStatus();
    await waitFor(() => expect(screen.getByText(/Science service not reachable/)).toBeInTheDocument());
    expect(screen.getByText(/No results can be computed or shown right now/)).toBeInTheDocument();
    expect(screen.queryByText("Real data, unverified")).toBeNull();
    expect(screen.queryByText("Synthetic demonstration data")).toBeNull();
  });

  it("starts with a neutral checking message, never a result state", () => {
    health({ status: "ok", mode: "live", stack: "live" });
    renderStatus();
    expect(screen.getByText("Checking the science service…")).toBeInTheDocument();
  });
});
