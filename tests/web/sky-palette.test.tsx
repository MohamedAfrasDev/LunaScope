import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { readSkyPalette } from "@/lib/sky-palette";

afterEach(() => {
  for (const t of ["--sun", "--earth", "--background"]) document.documentElement.style.removeProperty(t);
});

describe("3D sky palette", () => {
  it("reads the theme's tokens when they exist", () => {
    document.documentElement.style.setProperty("--sun", "#8a5500");
    document.documentElement.style.setProperty("--earth", "#1d4f9c");
    document.documentElement.style.setProperty("--background", "#f7f5f0");
    const p = readSkyPalette();
    expect(p.sun).toBe("#8a5500");
    expect(p.earth).toBe("#1d4f9c");
    expect(p.background).toBe("#f7f5f0");
  });

  it("falls back to the night values where there is no stylesheet", () => {
    const p = readSkyPalette();
    expect(p.background).toBe("#0b1020");
    expect(p.sun).toBe("#f4c873");
    expect(p.earth).toBe("#86b8ff");
  });

  it("leaves no hard-coded colour in the scene itself", () => {
    const src = readFileSync("components/Sky3D.tsx", "utf-8");
    expect(src).not.toMatch(/0x[0-9a-fA-F]{6}\b/);
    expect(src).not.toMatch(/["']#[0-9a-fA-F]{3,6}["']/);
  });
});
