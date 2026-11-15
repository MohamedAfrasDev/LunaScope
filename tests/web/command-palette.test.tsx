import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette, PaletteButton } from "@/components/shell/CommandPalette";
import { resetRecentRunsForTests, rememberRun } from "@/lib/recent-runs";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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
  push.mockClear();
});
afterEach(() => localStorage.clear());

const press = (init: KeyboardEventInit, target: EventTarget = document.body) => act(() => void target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })));

describe("CommandPalette", () => {
  it("is closed until Ctrl+K, opens as a named dialog, and closes with Escape", () => {
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).toBeNull();
    press({ key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Search LunaScope" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Open the Atlas" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("option", { name: "Open the Atlas" }));
    expect(push).toHaveBeenCalledWith("/atlas");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lists recent runs, which open in the Atlas", () => {
    rememberRun({ id: A, label: "Shackleton rim and 1 more", state: "synthetic_demonstration", sites: ["shackleton_rim", "malapert"] });
    render(<CommandPalette />);
    press({ key: "k", ctrlKey: true });
    fireEvent.click(screen.getByRole("option", { name: /Shackleton rim and 1 more/ }));
    expect(push).toHaveBeenLastCalledWith(`/atlas?run=${A}`);
  });

  it("can clear the recent runs", () => {
    rememberRun({ id: A, label: "Shackleton rim and 1 more", state: "synthetic_demonstration", sites: ["shackleton_rim"] });
    render(<CommandPalette />);
    press({ key: "k", ctrlKey: true });
    fireEvent.click(screen.getByRole("option", { name: "Clear recent runs" }));
    press({ key: "k", ctrlKey: true });
    expect(screen.queryByRole("option", { name: /Shackleton rim/ })).toBeNull();
  });

  it("says so when nothing matches", () => {
    render(<CommandPalette />);
    press({ key: "k", ctrlKey: true });
    fireEvent.change(screen.getByPlaceholderText(/Go to a page/), { target: { value: "zzzzqqq" } });
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });
});
