import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { Progress } from "@/components/ui/progress";
import { SectionHeader } from "@/components/ui/section-header";
import { SunEarthKey } from "@/components/ui/sun-earth-key";
import { WarningItem } from "@/components/ui/warning-item";

describe("Alert (shadcn, with the product's status tones)", () => {
  it("is announced as an alert by default and carries its tone", () => {
    render(<Alert variant="warning">Heads up</Alert>);
    const a = screen.getByRole("alert");
    expect(a).toHaveTextContent("Heads up");
    expect(a.className).toContain("text-warn");
    expect(a).toHaveAttribute("data-slot", "alert");
  });
  it("has a destructive tone in the status colours, and an info tone", () => {
    const { rerender } = render(<Alert variant="destructive">Failed</Alert>);
    expect(screen.getByRole("alert").className).toContain("text-fail");
    rerender(<Alert variant="info">FYI</Alert>);
    expect(screen.getByRole("alert").className).toContain("text-info");
  });
  it("can be a status for non-urgent notes", () => {
    render(<Alert variant="info" role="status">Saved</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Button (shadcn)", () => {
  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "button");
  });
  it("can be a submit and can be disabled", () => {
    render(<Button type="submit" disabled>Run</Button>);
    const b = screen.getByRole("button", { name: "Run" });
    expect(b).toHaveAttribute("type", "submit");
    expect(b).toBeDisabled();
  });
  it("is the primary look by default and has an outline variant for everything else", () => {
    render(<><Button>Main</Button><Button variant="outline">Other</Button></>);
    expect(screen.getByRole("button", { name: "Main" })).toHaveAttribute("data-variant", "default");
    expect(screen.getByRole("button", { name: "Other" })).toHaveAttribute("data-variant", "outline");
  });
  it("can render a link as a button without adding a type to the anchor", () => {
    render(<Button asChild><a href="/x">Download</a></Button>);
    const a = screen.getByRole("link", { name: "Download" });
    expect(a).toHaveAttribute("data-slot", "button");
    expect(a).not.toHaveAttribute("type");
  });
});

describe("Badge (status chips)", () => {
  it("renders every status tone with its colour classes", () => {
    render(
      <>
        {(["ok", "fail", "warn", "info", "muted"] as const).map((t) => (
          <Badge key={t} variant={t}>{t}</Badge>
        ))}
      </>,
    );
    for (const t of ["ok", "fail", "warn", "info"]) expect(screen.getByText(t).className).toContain(`text-${t}`);
    expect(screen.getByText("muted").className).toContain("text-muted-foreground");
  });
});

describe("Card (shadcn)", () => {
  it("renders children and forwards props", () => {
    render(<Card aria-label="Box">content</Card>);
    expect(screen.getByLabelText("Box")).toHaveTextContent("content");
    expect(screen.getByLabelText("Box")).toHaveAttribute("data-slot", "card");
  });
});

describe("Progress (shadcn)", () => {
  it("is a named progress bar with its value as a percentage", () => {
    render(<Progress value={33} aria-label="Analysis progress" />);
    const bar = screen.getByRole("progressbar", { name: "Analysis progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "33");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });
});

describe("Disclosure", () => {
  it("is a native details/summary, closed by default, and toggles on activation", async () => {
    // Enter/Space on <summary> is browser behaviour (jsdom does not implement it); the e2e keyboard flow covers that.
    const user = userEvent.setup();
    render(<Disclosure summary="More detail">Hidden text</Disclosure>);
    const summary = screen.getByText("More detail");
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    await user.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
  });
  it("can start open", () => {
    render(<Disclosure summary="S" open>Body</Disclosure>);
    expect(screen.getByText("S").closest("details")).toHaveAttribute("open");
  });
});

describe("SectionHeader", () => {
  it("renders the requested heading level with eyebrow, description and action", () => {
    render(<SectionHeader as="h3" eyebrow="Step 1" title="Shift" description="Move the start" action={<button>Go</button>} />);
    expect(screen.getByRole("heading", { level: 3, name: "Shift" })).toBeInTheDocument();
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Move the start")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });
});

describe("SunEarthKey", () => {
  it("names both protagonists in words", () => {
    render(<SunEarthKey />);
    expect(screen.getByRole("list", { name: "Key" })).toHaveTextContent("Sun");
    expect(screen.getByRole("list", { name: "Key" })).toHaveTextContent("Earth");
  });
});

describe("WarningItem", () => {
  it("shows the code and its text", () => {
    render(<ul><WarningItem code="UNVERIFIED" text="No gate has closed." /></ul>);
    expect(screen.getByText("UNVERIFIED").tagName).toBe("CODE");
    expect(screen.getByText("No gate has closed.")).toBeInTheDocument();
  });
  it("tolerates a code with no text", () => {
    render(<ul><WarningItem code="X" /></ul>);
    expect(screen.getByText("X")).toBeInTheDocument();
  });
});
