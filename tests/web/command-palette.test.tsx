import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette, PaletteButton } from "@/components/shell/CommandPalette";
import { resetRecentRunsForTests, rememberRun } from "@/lib/recent-runs";

const push = vi.fn();
let path = "/";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => path }));

const A = "a".repeat(64);

beforeEach(() => {
  // cmdk needs these two browser APIs, which jsdom lacks
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  resetRecentRunsForTests();
  delete document.documentElement.dataset.motion;
  push.mockClear();
  path = "/";
});
afterEach(() => localStorage.clear());

const press = (init: KeyboardEventInit, target: EventTarget = document.body) => act(() => void target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })));

describe("CommandPalette", () => {
  it("is closed until Ctrl+K, opens as a named dialog, and closes with Escape", () => {
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).toBeNull();
    press({ key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Search LunaScope" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "New analysis" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens with / unless you are typing in a field", () => {
    render(
      <>
        <input aria-label="field" />
        <CommandPalette />
      </>,
    );
    press({ key: "/" }, screen.getByLabelText("field"));
    expect(screen.queryByRole("dialog")).toBeNull();
    press({ key: "/" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens from the visible Search button", () => {
    render(
      <>
        <PaletteButton />
        <CommandPalette />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("goes to a page", () => {
    render(<CommandPalette />);
    press({ key: "k", metaKey: true });
    fireEvent.click(screen.getByRole("option", { name: "Why the south pole is hard" }));
    expect(push).toHaveBeenCalledWith("/why-the-south-pole-is-hard");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers the open run's own views, with its sites, and recent runs", () => {
    rememberRun({ id: A, label: "Shackleton rim and 1 more", state: "synthetic_demonstration", sites: ["shackleton_rim", "malapert"] });
    path = `/runs/${A}/evidence`;
    render(<CommandPalette />);
    press({ key: "k", ctrlKey: true });
    expect(screen.getByText("This analysis")).toBeInTheDocument();
    for (const n of ["Matrix", "Compare sites", "Time Machine", "Evidence"]) expect(screen.getByRole("option", { name: n })).toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: /^Timeline: / })).toHaveLength(2);
    expect(screen.getAllByRole("option", { name: /^Sky: / })).toHaveLength(2);
    fireEvent.click(screen.getByRole("option", { name: "Time Machine" }));
    expect(push).toHaveBeenCalledWith(`/runs/${A}/time-machine`);
    press({ key: "k", ctrlKey: true });
    fireEvent.click(screen.getByRole("option", { name: /Shackleton rim and 1 more/ }));
    expect(push).toHaveBeenLastCalledWith(`/runs/${A}`);
  });

  it("has no run views outside a run", () => {
    render(<CommandPalette />);
    press({ key: "k", ctrlKey: true });
    expect(screen.queryByText("This analysis")).toBeNull();
  });

  it("switches the explanation style and pauses the motion", () => {
    render(<CommandPalette />);
    press({ key: "k", ctrlKey: true });
    fireEvent.click(screen.getByRole("option", { name: "Switch to the Technical view" }));
    expect(localStorage.getItem("lunascope.view-mode")).toBe("technical");
    press({ key: "k", ctrlKey: true });
    expect(screen.getByRole("option", { name: "Switch to the Guided view" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Pause background motion" }));
    expect(localStorage.getItem("lunascope.motion")).toBe("paused");
  });

  it("says so when nothing matches", () => {
    render(<CommandPalette />);
    press({ key: "k", ctrlKey: true });
    fireEvent.change(screen.getByPlaceholderText(/Go to a page/), { target: { value: "zzzzqqq" } });
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });
});
