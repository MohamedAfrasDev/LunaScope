import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/(shell)/error";
import NotFound from "@/app/not-found";
import { LoadingState } from "@/components/ui/loading-state";

// the sidebar shell is its own concern (shell.test.tsx); here only the page content is under test
vi.mock("@/components/shell/ShellFrame", () => ({ ShellFrame: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

describe("LoadingState", () => {
  it("says what is loading as a status, and hides the decorative blocks", () => {
    const { container } = render(<LoadingState label="Loading the timeline…" kind="page" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the timeline…");
    expect(container.querySelector('[aria-hidden="true"] [data-slot="skeleton"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(2);
  });
});

describe("not-found and error screens", () => {
  it("not-found has one h1, plain wording and two ways out", () => {
    render(<NotFound />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "This page is not here" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "New analysis" })).toHaveAttribute("href", "/analyze");
  });

  it("error says what happened and what to do, shows no technical detail, and can retry", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("secret stack detail")} reset={reset} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/secret stack detail/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/");
  });
});
