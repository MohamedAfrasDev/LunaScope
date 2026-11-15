import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TermsHint } from "@/components/TermsHint";
import { RunTour, TOUR_STEPS } from "@/components/tour/RunTour";
import { GLOSSARY } from "@/lib/glossary";
import { resetTourForTests, startTour } from "@/lib/tour";

beforeEach(() => {
  localStorage.clear();
  resetTourForTests();
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => localStorage.clear());

/** a page with the things the tour talks about */
function Page() {
  return (
    <>
      <header>
        <span role="status">Synthetic demonstration data</span>
      </header>
      <main>
        <RunTour />
        <nav aria-label="Analysis views">tabs</nav>
        <div data-tour="verdict">verdict</div>
        <div data-tour="cards">cards</div>
        <details>
          <summary>table</summary>
        </details>
      </main>
    </>
  );
}

describe("glossary and terms", () => {
  it("has the five key terms plus unknown, each with a plain sentence", () => {
    expect(GLOSSARY.map((g) => g.id)).toEqual(["terrain-aware", "flat-horizon", "availability-range", "unresolved", "unknown", "excluded"]);
    for (const g of GLOSSARY) expect(g.text.length).toBeGreaterThan(30);
  });

  it("opens a term's meaning from a button, and closes it with Escape", async () => {
    render(<TermsHint />);
    fireEvent.click(screen.getByRole("button", { name: "Flat horizon" }));
    expect(await screen.findByText(/What a level horizon would say/)).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(screen.queryByText(/What a level horizon would say/)).toBeNull();
  });
});

describe("RunTour", () => {
  it("is offered once, as a quiet line, and 'No thanks' is remembered", () => {
    const { unmount } = render(<Page />);
    expect(screen.getByRole("region", { name: "Page tour offer" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "No thanks" }));
    expect(screen.queryByRole("region", { name: "Page tour offer" })).toBeNull();
    expect(localStorage.getItem("lunascope.tour")).toBe("seen");
    unmount();
    resetTourForTests();
    render(<Page />);
    expect(screen.queryByRole("region", { name: "Page tour offer" })).toBeNull(); // never offered again by itself
  });

  it("walks through the steps, outlines each target, and ends with Done", () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    const tour = () => screen.getByRole("region", { name: "Page tour" });
    expect(tour()).toHaveTextContent(`Step 1 of ${TOUR_STEPS.length}`);
    expect(tour()).toHaveTextContent("The verdict, by requirement");
    expect(document.querySelector('[data-tour="verdict"]')).toHaveAttribute("data-tour-active", "true");
    expect(screen.getByRole("heading", { name: "The verdict, by requirement" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    for (let i = 1; i < TOUR_STEPS.length; i++) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(tour()).toHaveTextContent("The data label");
    expect(document.querySelector('[data-tour="verdict"]')).not.toHaveAttribute("data-tour-active");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("region", { name: "Page tour" })).toBeNull();
    expect(document.querySelector("[data-tour-active]")).toBeNull();
  });

  it("ends with Escape, and can be started again on request (the palette)", () => {
    render(<Page />);
    act(() => startTour());
    expect(screen.getByRole("region", { name: "Page tour" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Page tour" })).toBeNull();
    act(() => startTour()); // already seen, still available when asked for
    expect(screen.getByRole("region", { name: "Page tour" })).toBeInTheDocument();
  });

  it("skips a step whose target is not on the page", () => {
    render(
      <main>
        <RunTour />
        <div data-tour="verdict">verdict</div>
      </main>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    expect(screen.getByRole("region", { name: "Page tour" })).toHaveTextContent("Step 1 of 1"); // only the verdict exists here
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });
});
