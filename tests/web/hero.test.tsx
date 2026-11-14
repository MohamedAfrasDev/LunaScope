import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroSkyline } from "@/components/HeroSkyline";

describe("HeroSkyline", () => {
  it("is one labelled image that says it is a sketch, not data", () => {
    const { container } = render(<HeroSkyline />);
    const img = screen.getByRole("img", { name: /Sketch: a ridge hides the Sun from a low site, while Earth is clear/ });
    expect(img).toBeInTheDocument();
    // the long description carries the honesty note for assistive technology
    expect(container.querySelector("svg desc")?.textContent).toMatch(/not to scale, and not taken from any data/);
    // and so does the visible caption
    expect(screen.getByText(/Illustration only: not to scale, and not taken from any data/)).toBeInTheDocument();
  });

  it("does not reuse the explainer's schematic name or caption, so text selectors stay unambiguous", () => {
    const { container } = render(<HeroSkyline />);
    expect(screen.queryByRole("img", { name: /Schematic/ })).toBeNull();
    // the home page stays mounted (hidden) after navigating away, so its text must not collide with the explainer's
    expect(container.textContent).not.toMatch(/not to scale and not computed from data/);
  });

  it("names Sun and Earth in words and keeps every colour from design tokens", () => {
    const { container } = render(<HeroSkyline />);
    const text = container.textContent ?? "";
    for (const word of ["Sun", "Earth", "site", "skyline", "blocked", "flat horizon"]) expect(text).toContain(word);
    const svg = container.querySelector("svg")!.outerHTML;
    expect(svg).not.toMatch(/#[0-9a-fA-F]{3,6}\b/); // no hard-coded hex colours
    expect(svg).toContain("var(--sun)");
    expect(svg).toContain("var(--earth)");
  });
});

describe("Explainer schematic shares the hero drawing", () => {
  it("draws the same picture without Earth, keeps its own pinned text, and never matches the hero's text", async () => {
    const { default: Why } = await import("@/app/why-the-south-pole-is-hard/page");
    const { container } = render(<Why />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("role", "img");
    expect(svg.outerHTML).toContain("var(--sun)"); // same hues as the hero
    expect(svg.outerHTML).not.toContain("var(--earth)"); // this one is about the Sun only
    expect(svg.textContent).toContain("Sun, about 1° up");
    expect(container.textContent).toMatch(/Schematic, not to scale and not computed from data/);
    expect(container.textContent).not.toMatch(/Illustration only/); // the hero's caption stays the hero's
  });
});
