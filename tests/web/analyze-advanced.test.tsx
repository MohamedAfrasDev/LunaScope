import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyzeForm } from "@/components/AnalyzeForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const json = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });
const sites = {
  note: "Rule-chosen demonstration points.",
  sites: [{ site_id: "rule-89.5S-E0", label: "x", lat_deg: -89.5, lon_east_deg: 0, convention: "planetocentric", source: "rule",
    precision_m: 100, kind: "demonstration_rule", dem_coverage_150km: { covered_fraction: 1, fully_covered: true, sectors_with_gap: 0, radius_km: 150 } }],
};

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

async function open(handler?: (u: string, init?: RequestInit) => Response) {
  vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => handler?.(String(u), init) ?? json(sites)));
  render(<AnalyzeForm />);
  return screen.findByText("Advanced settings");
}
const advanced = () => screen.getByText("Advanced settings").closest("details")!;

describe("Analysis form: Advanced settings", () => {
  it("shows the window and the sites up front and keeps the rest closed", async () => {
    await open();
    expect(screen.getByText("Mission window (UTC)")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Sites/ })).toBeInTheDocument();
    expect(advanced()).not.toHaveAttribute("open");
    // requirements, terrain and options live inside it
    for (const name of [/Minimum sunlight availability/, /Horizon radius/, /Also run a sensitivity check/])
      expect(advanced()).toContainElement(screen.getByLabelText(name));
    // the window and the sites do not
    expect(advanced()).not.toContainElement(screen.getByLabelText("Start date"));
    expect(advanced()).not.toContainElement(screen.getByRole("group", { name: /Sites/ }));
  });

  it("puts the window and sites before Advanced settings, and Run after them", async () => {
    await open();
    const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(screen.getByLabelText("Start date"), screen.getByRole("group", { name: /Sites/ }))).toBe(true);
    expect(follows(screen.getByRole("group", { name: /Sites/ }), advanced())).toBe(true);
    expect(follows(advanced(), screen.getByRole("button", { name: "Run analysis" }))).toBe(true);
  });

  it("states the current advanced values on the closed summary, and updates them", async () => {
    await open();
    const summary = advanced().querySelector("summary")!;
    expect(summary).toHaveTextContent("Sunlight at least 60%, Earth visibility at least 50%, terrain 150 km, sensitivity off");
    fireEvent.change(screen.getByLabelText(/Minimum sunlight availability/), { target: { value: "70" } });
    expect(summary).toHaveTextContent("Sunlight at least 70%");
    fireEvent.click(screen.getByLabelText(/Also run a sensitivity check/));
    expect(summary).toHaveTextContent("sensitivity on");
  });

  it("opens itself, and moves focus to the error summary, when an advanced field is invalid", async () => {
    const user = userEvent.setup();
    await open();
    fireEvent.change(screen.getByLabelText(/Horizon radius/), { target: { value: "9999" } });
    expect(advanced()).not.toHaveAttribute("open"); // typing alone does not open it
    await user.click(screen.getByRole("button", { name: "Run analysis" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Fix 1 field(s) before submitting.");
    expect(alert).toHaveFocus();
    expect(advanced()).toHaveAttribute("open");
    expect(screen.getByLabelText(/Horizon radius/)).toHaveAttribute("aria-invalid", "true");
    expect(within(advanced()).getByText(/Horizon radius must be 1 to 300 km/)).toBeInTheDocument();
  });

  it("leaves it closed when the problem is outside it, but still moves focus to the error summary", async () => {
    const user = userEvent.setup();
    await open();
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "not a date" } });
    await user.click(screen.getByRole("button", { name: "Run analysis" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveFocus();
    expect(advanced()).not.toHaveAttribute("open");
  });

  it("opens it too when the service rejects an advanced field", async () => {
    const user = userEvent.setup();
    await open((u, init) =>
      init?.method === "POST" && u.includes("analyses")
        ? json({ error: { code: "VALIDATION", message: "Radius too large for this DEM.", field: "terrain.radius_km", retryable: false, correlation_id: "c" } }, 422)
        : json(sites),
    );
    await user.click(screen.getByRole("button", { name: "Run analysis" }));
    await waitFor(() => expect(advanced()).toHaveAttribute("open"));
    expect(await screen.findByText(/Radius too large for this DEM/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("stays open while you fix the field, so the error does not move under your hands", async () => {
    const user = userEvent.setup();
    await open();
    fireEvent.change(screen.getByLabelText(/Horizon radius/), { target: { value: "9999" } });
    await user.click(screen.getByRole("button", { name: "Run analysis" }));
    await screen.findByRole("alert");
    await user.clear(screen.getByLabelText(/Horizon radius/));
    await user.type(screen.getByLabelText(/Horizon radius/), "120");
    expect(advanced()).toHaveAttribute("open");
    expect(screen.queryByRole("alert")).toBeNull(); // the error clears as you edit, as before
  });
});
