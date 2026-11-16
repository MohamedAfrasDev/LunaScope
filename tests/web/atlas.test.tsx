import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Panel } from "@/components/atlas/Panel";
import { TAGS, Tag, type TagKind } from "@/components/atlas/Tag";
import { TopBar } from "@/components/atlas/TopBar";
import { LearnPanel } from "@/components/atlas/LearnPanel";

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

  it("marks the current scale, and offers System as an enabled scale", () => {
    render(<TopBar {...base} />);
    expect(screen.getByRole("button", { name: "Moon" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "System" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Site sky" })).toBeInTheDocument();
  });

  it("explains on hover why Place a point is off on an offline copy, and works normally otherwise", () => {
    const { rerender } = render(<TopBar {...base} canPlace={false} />);
    const wrap = screen.getByTestId("place-wrap");
    expect(wrap).toHaveAttribute("title", expect.stringMatching(/offline.*run LunaScope on your computer/i));
    expect(screen.getByRole("button", { name: /Place a point/ })).toBeDisabled();
    rerender(<TopBar {...base} />);
    expect(screen.getByTestId("place-wrap")).not.toHaveAttribute("title");
    expect(screen.getByRole("button", { name: "Place a point" })).toBeEnabled();
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

describe("LearnPanel", () => {
  it("carries the three rules and the limits, unchanged in meaning", () => {
    render(<LearnPanel onClose={() => {}} />);
    expect(screen.getByText(/No placeholder is shown as science/)).toBeInTheDocument();
    expect(screen.getByText(/Unknown is not/)).toBeInTheDocument();
    expect(screen.getByText(/No hidden score/)).toBeInTheDocument();
    expect(screen.getByText(/Not endorsed by NASA/)).toBeInTheDocument();
  });
});
