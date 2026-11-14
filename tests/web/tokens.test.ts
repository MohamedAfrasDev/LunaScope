import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Colour contrast guard (WCAG 2.2 AA), computed from the real stylesheet so a palette edit cannot quietly
 * break it. Text needs 4.5:1. The edge of a form control needs 3:1 (non-text contrast, 1.4.11), which axe does
 * not check.
 */
const css = readFileSync("app/globals.css", "utf-8").replace(/\r\n/g, "\n");

function block(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}

const darkSrc = css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme: light)"));
const lightStart = css.indexOf("@media (prefers-color-scheme: light)");
const lightSrc = css.slice(lightStart, css.indexOf("@theme inline"));
const THEMES = { dark: block(darkSrc), light: block(lightSrc) };

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ["background", "surface", "surface-2"];

describe.each(Object.entries(THEMES))("%s theme", (_name, t) => {
  it("defines every token the guard reads", () => {
    for (const k of [...SURFACES, "foreground", "muted", "accent", "sun", "earth", "ok", "fail", "warn", "info", "border-strong"])
      expect(t[k], `--${k}`).toBeDefined();
  });

  it.each(["foreground", "muted", "accent", "sun", "earth", "ok", "fail", "warn", "info"])("%s text reads on every surface (4.5:1)", (k) => {
    for (const s of SURFACES) expect(ratio(t[k], t[s]), `--${k} on --${s}`).toBeGreaterThanOrEqual(4.5);
  });

  it("the edge of a form control is at least 3:1 against every surface it can sit on", () => {
    for (const s of SURFACES) expect(ratio(t["border-strong"], t[s]), `--border-strong on --${s}`).toBeGreaterThanOrEqual(3);
  });

  it("status text reads on its own soft fill (4.5:1)", () => {
    for (const k of ["ok", "fail", "warn", "info"]) expect(ratio(t[k], t[`${k}-soft`]), `--${k} on --${k}-soft`).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.sun, t["sun-soft"])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.earth, t["earth-soft"])).toBeGreaterThanOrEqual(4.5);
  });

  it("the primary button's label reads on the accent (4.5:1)", () => {
    expect(ratio(t["accent-contrast"], t.accent)).toBeGreaterThanOrEqual(4.5);
  });
});
