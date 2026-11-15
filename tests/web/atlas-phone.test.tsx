import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataStatusProvider } from "@/components/DataStatusBanner";
import { Readout } from "@/components/atlas/Readout";
import { SkyControls } from "@/components/atlas/SkyControls";
import { TimeDock, type DockRun } from "@/components/atlas/TimeDock";
import { TopBar } from "@/components/atlas/TopBar";
import { initialClock, type RunWindow } from "@/lib/atlas/clock";
import type { Target } from "@/lib/api/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/atlas", useRouter: () => ({ push: () => {} }) }));
vi.mock("@/components/shell/CommandPalette", () => ({ openCommandPalette: vi.fn() }));

beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
});

describe("TopBar on a phone", () => {
  const base = () => ({ scale: "moon" as const, onScale: vi.fn(), open: [] as never[], onTogglePanel: vi.fn(), onView: vi.fn(), placing: false, onTogglePlacing: vi.fn(), runLabel: "Run GR-001" });

  it("keeps the name, the run chip and a Menu button; the groups wait behind the menu", () => {
    render(<TopBar {...base()} compact />);
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("run-chip")).toBeVisible();
    // the groups are in the page but folded away until the menu opens
    expect(screen.getByRole("button", { name: "Sites", hidden: true })).not.toBeVisible();
    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Sites" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Search" })).toBeVisible();
  });

  it("choosing something closes the menu, so the Moon is visible again", () => {
    const p = base();
    render(<TopBar {...p} compact />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Metrics" }));
    expect(p.onTogglePanel).toHaveBeenCalledWith("metrics");
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "South pole" }));
    expect(p.onView).toHaveBeenCalledWith("south-pole");
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("the run chip still opens the Runs panel without the menu", () => {
    const p = base();
    render(<TopBar {...p} compact />);
    fireEvent.click(screen.getByTestId("run-chip"));
    expect(p.onTogglePanel).toHaveBeenCalledWith("runs");
  });

  it("on a wide window there is no Menu and every group is shown", () => {
    render(<TopBar {...base()} />);
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sites" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Search" })).toBeVisible();
  });
});

describe("TimeDock on a phone", () => {
  const W: RunWindow = { startMs: Date.UTC(2026, 10, 15, 7, 3), totalS: 7 * 86400 };
  const run: DockRun = { kind: "ready", window: W, events: [3600], eventScope: "this site", label: "GR-001", synthetic: true };
  const actions = { toggle: vi.fn(), setSpeed: vi.fn(), toggleReverse: vi.fn(), toggleLoop: vi.fn(), seek: vi.fn() };
  const ui = (compact: boolean) => (
    <DataStatusProvider>
      <TimeDock run={run} clock={initialClock()} actions={actions} reducedMotion={false} compact={compact} />
    </DataStatusProvider>
  );

  it("keeps play, the scrubber, the time, the data label and the credit; the rest folds behind More", () => {
    render(ui(true));
    expect(screen.getByRole("button", { name: "Play" })).toBeVisible();
    expect(screen.getByRole("slider", { name: "Time (UTC)" })).toBeVisible();
    expect(screen.getByTestId("dock-elapsed")).toBeVisible();
    expect(screen.getByText(/Not endorsed by NASA/)).toBeVisible();
    expect(screen.getByText("SYNTHETIC")).toBeVisible();
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Next event", hidden: true })).not.toBeVisible();
    expect(screen.queryByLabelText("Go to (UTC)")).toBeNull();
    fireEvent.click(more);
    expect(screen.getByRole("button", { name: "Fewer" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Next event" })).toBeVisible();
    expect(screen.getByRole("button", { name: "1 day" })).toBeVisible();
    expect(screen.getByLabelText("Go to (UTC)")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next event" }));
    expect(actions.seek).toHaveBeenCalledWith(3600);
  });

  it("on a wide window everything is in view and there is no More", () => {
    render(ui(false));
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    expect(screen.getByRole("button", { name: "Next event" })).toBeVisible();
    // the go-to row is folded away by default on a wide window, and one press shows it
    expect(screen.getByRole("button", { name: "Go to time" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Go to time" }));
    expect(screen.getByLabelText("Go to (UTC)")).toBeVisible();
  });

  it("More is off while there is no run", () => {
    render(
      <DataStatusProvider>
        <TimeDock run={{ kind: "loading", text: "Loading" }} clock={initialClock()} actions={actions} reducedMotion={false} compact />
      </DataStatusProvider>,
    );
    expect(screen.getByRole("button", { name: "More" })).toBeDisabled();
  });
});

describe("SkyControls and Readout on a phone", () => {
  const p = () => ({
    look: "look" as const, onLook: vi.fn(), exaggeration: 1, onExaggeration: vi.fn(),
    paths: { sun_center: true, earth_center: true } as Record<Target, boolean>, onPaths: vi.fn(),
    onFaceTarget: vi.fn(), onFace: vi.fn(), onReturn: vi.fn(), yaw: 90,
    has: { sun_center: true, earth_center: true } as Record<Target, boolean>,
  });

  it("keeps Return to Moon and the heading in view, and folds the rest behind Controls", () => {
    const props = p();
    render(<SkyControls {...props} compact />);
    expect(screen.getByRole("button", { name: /Return to Moon/ })).toBeVisible();
    expect(screen.getByTestId("sky-heading")).toBeVisible();
    expect(screen.getByRole("button", { name: "Face the Sun", hidden: true })).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Controls" }));
    expect(screen.getByRole("button", { name: "Face the Sun" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Face the Sun" }));
    expect(props.onFaceTarget).toHaveBeenCalledWith("sun_center");
    fireEvent.click(screen.getByRole("button", { name: /Return to Moon/ }));
    expect(props.onReturn).toHaveBeenCalledOnce();
  });

  it("the compact readout still says the time, the scale and any extra rows", () => {
    render(<Readout compact scaleLabel="MOON SCALE" timeLabel="2026-11-18 21:48 UTC" extra={[{ label: "Sun", value: "AZ 1.0° · EL +2.00°" }]} />);
    const r = screen.getByTestId("atlas-readout");
    expect(r).toHaveTextContent("2026-11-18 21:48 UTC");
    expect(r).toHaveTextContent("MOON SCALE");
    expect(r).toHaveTextContent("AZ 1.0° · EL +2.00°");
  });
});
