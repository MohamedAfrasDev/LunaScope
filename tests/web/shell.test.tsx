import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crumbsFor } from "@/components/shell/ShellBar";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { clearRecentRuns, rememberRun, resetRecentRunsForTests, useRecentRuns } from "@/lib/recent-runs";

let path = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

const A = "a".repeat(64);
const B = "b".repeat(64);

beforeEach(() => {
  localStorage.clear();
  resetRecentRunsForTests();
  path = "/";
  window.matchMedia =
    window.matchMedia ??
    ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList);
});
afterEach(() => localStorage.clear());

describe("breadcrumbs", () => {
  it("names where the URL is, with the product's own words", () => {
    expect(crumbsFor("/")).toEqual([{ label: "Home" }]);
    expect(crumbsFor("/analyze")).toEqual([{ label: "Home", href: "/" }, { label: "New analysis" }]);
    expect(crumbsFor("/why-the-south-pole-is-hard").at(-1)).toEqual({ label: "Why the south pole is hard" });
    expect(crumbsFor(`/runs/${A}`)).toEqual([{ label: "Home", href: "/" }, { label: `Analysis ${"a".repeat(12)}` }]);
  });
  it("links back to the run from one of its views", () => {
    const c = crumbsFor(`/runs/${A}/time-machine`);
    expect(c.map((x) => x.label)).toEqual(["Home", `Analysis ${"a".repeat(12)}`, "Time Machine"]);
    expect(c[1].href).toBe(`/runs/${A}`);
    expect(c[2].href).toBeUndefined();
  });
});

describe("recent runs", () => {
  it("keeps the newest first, one entry per run, and at most eight", () => {
    rememberRun({ id: A, label: "Shackleton rim" });
    rememberRun({ id: B, label: "Malapert" });
    rememberRun({ id: A, label: "Shackleton rim and 2 more" });
    let ids: string[] = [];
    function Probe() {
      ids = useRecentRuns().map((r) => r.id);
      return null;
    }
    render(<Probe />);
    expect(ids).toEqual([A, B]);
    for (let i = 0; i < 12; i++) rememberRun({ id: i.toString(16).padStart(64, "0"), label: `r${i}` });
    act(() => rememberRun({ id: A, label: "x" }));
    expect(ids.length).toBe(8);
  });
  it("ignores anything that is not a run id, and survives corrupt storage", () => {
    rememberRun({ id: "not-a-run", label: "x" });
    localStorage.setItem("lunascope.recent-runs", "{broken");
    resetRecentRunsForTests();
    let n = -1;
    function Probe() {
      n = useRecentRuns().length;
      return null;
    }
    render(<Probe />);
    expect(n).toBe(0);
  });
});

describe("sidebar", () => {
  function shell() {
    return render(
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </TooltipProvider>,
    );
  }

  it("is the Main navigation, marks the current page and lists the destinations", () => {
    path = "/analyze";
    shell();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New analysis" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Why the south pole is hard" })).toHaveAttribute("href", "/why-the-south-pole-is-hard");
    expect(screen.getByText(/appear here, on this device only/)).toBeInTheDocument();
  });

  it("lists recent runs, marks the open one, and clears them", () => {
    rememberRun({ id: A, label: "Shackleton rim and 1 more", state: "synthetic_demonstration" });
    path = `/runs/${A}/sky/x`;
    shell();
    const link = screen.getByRole("link", { name: /Shackleton rim and 1 more/ });
    expect(link).toHaveAttribute("href", `/runs/${A}`);
    expect(link).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Clear recent runs" }));
    expect(screen.queryByRole("link", { name: /Shackleton/ })).toBeNull();
    clearRecentRuns();
  });
});
