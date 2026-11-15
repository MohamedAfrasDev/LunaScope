import { readFileSync, statSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/images/hero-2400.jpg", () => ({ default: { src: "/hero.jpg", width: 2400, height: 1345, blurDataURL: "data:image/jpeg;base64,AAAA" } }));
const { HeroStage } = await import("@/components/HeroStage");

const css = readFileSync("app/globals.css", "utf-8").replace(/\r\n/g, "\n");
const block = (open: string) => {
  const a = css.indexOf(open);
  return css.slice(a, css.indexOf("\n}", a) + 2);
};

describe("HeroStage", () => {
  it("is decoration with a visible honesty label, and holds the content", () => {
    const { container } = render(
      <HeroStage>
        <h1>Intro</h1>
      </HeroStage>,
    );
    expect(screen.getByRole("heading", { name: "Intro" })).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(screen.getByText(/illustration only\. Not NASA imagery, not data/i)).toBeInTheDocument();
    expect(container.querySelector(".theme-night")).not.toBeNull();
    expect(container.querySelector('.hero-scrim[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("hero image budget", () => {
  it("ships a small copy, and nothing imports the 22.7 MB original", () => {
    expect(statSync("app/images/hero-2400.jpg").size).toBeLessThan(600 * 1024);
    for (const f of ["components/HeroStage.tsx", "app/page.tsx", "app/layout.tsx"]) {
      expect(readFileSync(f, "utf-8")).not.toMatch(/hero-bg\.jpg/);
    }
  });
});

describe("night scope", () => {
  it("repeats the dark tokens exactly, so the hero reads the same in the light theme", () => {
    const dark = block(":root {").replace(":root {", "");
    const night = block(".theme-night {").replace(".theme-night {", "");
    expect(night).toBe(dark);
  });
});
