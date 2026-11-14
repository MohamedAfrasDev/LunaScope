import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { ResultBadge } from "@/components/ui/ResultBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Stat } from "@/components/ui/Stat";
import { SunEarthKey } from "@/components/ui/SunEarthKey";
import { WarningItem } from "@/components/ui/WarningItem";

describe("Alert", () => {
  it("is announced as an alert by default and carries its tone", () => {
    render(<Alert tone="warn">Heads up</Alert>);
    const a = screen.getByRole("alert");
    expect(a).toHaveTextContent("Heads up");
    expect(a.className).toContain("text-warn");
  });
  it("can be a status for non-urgent notes", () => {
    render(<Alert tone="info" role="status">Saved</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Button", () => {
  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "button");
  });
  it("can be a submit and can be disabled", () => {
    render(<Button type="submit" variant="primary" disabled>Run</Button>);
    const b = screen.getByRole("button", { name: "Run" });
    expect(b).toHaveAttribute("type", "submit");
    expect(b).toBeDisabled();
  });
});

describe("Card", () => {
  it("renders children and forwards props", () => {
    render(<Card variant="inset" aria-label="Box">content</Card>);
    expect(screen.getByLabelText("Box")).toHaveTextContent("content");
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

describe("Stat", () => {
  it("pairs a label with a readout value, unit and hint", () => {
    render(<dl><Stat label="Availability" value="74.5" unit="%" hint="needs at least 50%" /></dl>);
    expect(screen.getByText("Availability")).toBeInTheDocument();
    expect(screen.getByText("74.5").className).toContain("readout");
    expect(screen.getByText("%")).toBeInTheDocument();
    expect(screen.getByText("needs at least 50%")).toBeInTheDocument();
  });
});

describe("ResultBadge", () => {
  it("shows icon, word and the explanation as a title (never colour alone)", () => {
    render(<ResultBadge state="real_data_unverified" />);
    const badge = screen.getByText("Real data, unverified");
    expect(badge.closest("span[title]")).toHaveAttribute("title", expect.stringContaining("no validation gate"));
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
