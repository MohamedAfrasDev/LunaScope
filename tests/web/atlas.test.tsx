import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Panel } from "@/components/atlas/Panel";
import { TAGS, Tag, type TagKind } from "@/components/atlas/Tag";
import { TopBar } from "@/components/atlas/TopBar";
import { TimeDock } from "@/components/atlas/TimeDock";
import { LearnPanel } from "@/components/atlas/LearnPanel";
import { DataStatusProvider } from "@/components/DataStatusBanner";

vi.mock("next/navigation", () => ({ usePathname: () => "/atlas", useRouter: () => ({ push: () => {} }) }));
vi.mock("@/components/shell/CommandPalette", () => ({ openCommandPalette: vi.fn() }));

beforeEach(() => {
  window.matchMedia =
    window.matchMedia ??
    ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList);
});

describe("Tag", () => {
  it.each(Object.keys(TAGS) as TagKind[])("%s shows its word and explains itself", (kind) => {
    render(<Tag kind={kind} />);
    const el = screen.getByText(TAGS[kind].label);
    expect(el).toHaveAttribute("data-kind", kind);
    expect(el).toHaveAttribute("title", TAGS[kind].help);
  });
});

describe("Panel", () => {
  it("is a named region that collapses and expands from a labelled button", () => {
    render(
      <Panel title="Timeline" tag="derived">
        content here
      </Panel>,
    );
    expect(screen.getByRole("region", { name: "Timeline" })).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Collapse Timeline" });
    expect(btn).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: "Expand Timeline" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("content here")).not.toBeVisible();
    expect(screen.getByText("DERIVED")).toBeInTheDocument();
  });

  it("offers a close button only when it can be closed", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Panel title="Learn">x</Panel>);
    expect(screen.queryByRole("button", { name: "Close Learn" })).toBeNull();
    rerender(
      <Panel title="Learn" onClose={onClose}>
        x
      </Panel>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close Learn" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("TopBar", () => {
  const base = { scale: "moon" as const, onScale: vi.fn(), open: [] as ("learn" | "sites")[], onTogglePanel: vi.fn(), onView: vi.fn(), placing: false, onTogglePlacing: vi.fn() };

  it("marks the current scale, and disables the scales that are not built yet, saying so", () => {
    render(<TopBar {...base} />);
    expect(screen.getByRole("button", { name: "Moon" })).toHaveAttribute("aria-pressed", "true");
    for (const name of ["System", "Site sky"]) {
      const b = screen.getByRole("button", { name });
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute("title", expect.stringMatching(/later phase/i));
    }
  });

  it("toggles panels and reports the camera views", () => {
    render(<TopBar {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Learn" }));
    expect(base.onTogglePanel).toHaveBeenCalledWith("learn");
    fireEvent.click(screen.getByRole("button", { name: "South pole" }));
    expect(base.onView).toHaveBeenCalledWith("south-pole");
    fireEvent.click(screen.getByRole("button", { name: "Whole Moon" }));
    expect(base.onView).toHaveBeenCalledWith("moon");
  });

  it("has a Place a point toggle that shows when it is on", () => {
    const { rerender } = render(<TopBar {...base} />);
    const b = screen.getByRole("button", { name: "Place a point" });
    expect(b).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(b);
    expect(base.onTogglePlacing).toHaveBeenCalledOnce();
    rerender(<TopBar {...base} placing />);
    expect(screen.getByRole("button", { name: "Place a point" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reflects an open panel in aria-pressed", () => {
    render(<TopBar {...base} open={["learn"]} />);
    expect(screen.getByRole("button", { name: "Learn" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("TimeDock", () => {
  it("is honest: every clock control is off and it says why, and the credit is always shown", () => {
    render(
      <DataStatusProvider>
        <TimeDock />
      </DataStatusProvider>,
    );
    expect(screen.getByRole("button", { name: /Play \(not available yet/ })).toBeDisabled();
    expect(screen.getByRole("slider", { name: /not available yet/ })).toBeDisabled();
    expect(screen.getByText(/No run loaded/)).toBeInTheDocument();
    expect(screen.getByText(/Not endorsed by NASA/)).toBeInTheDocument();
  });
});

describe("LearnPanel", () => {
  it("carries the three rules and the limits, unchanged in meaning", () => {
    render(<LearnPanel onClose={() => {}} />);
    expect(screen.getByText(/No placeholder is shown as science/)).toBeInTheDocument();
    expect(screen.getByText(/Unknown is not/)).toBeInTheDocument();
    expect(screen.getByText(/No hidden score/)).toBeInTheDocument();
    expect(screen.getByText(/Not endorsed by NASA/)).toBeInTheDocument();
  });
});
