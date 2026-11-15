import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Colour contrast guard (WCAG 2.2 AA), computed from the real stylesheet so a palette edit cannot quietly
 * break it. Text needs 4.5:1. The edge of a form control (--input) needs 3:1 (non-text contrast, 1.4.11),
 * which axe does not check. Every pair is checked on every surface it can sit on, in both themes.
 */
const css = readFileSync("app/globals.css", "utf-8").replace(/\r\n/g, "\n");

function block(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}

const lightStart = css.indexOf("@media (prefers-color-scheme: light)");
const darkSrc = css.slice(css.indexOf(":root {"), lightStart);
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

/** Solid surfaces that text can sit on. */
const SURFACES = ["background", "card", "popover", "muted"];
const TEXT = ["foreground", "muted-foreground", "primary", "destructive", "sun", "earth", "ok", "fail", "warn", "info"];

describe.each(Object.entries(THEMES))("%s theme", (_name, t) => {
  it("defines every token the guard reads", () => {
    for (const k of [
      ...SURFACES, ...TEXT, "primary-foreground", "secondary", "accent", "input", "border", "ring",
      "ok-soft", "fail-soft", "warn-soft", "info-soft", "sun-soft", "earth-soft",
    ])
      expect(t[k], `--${k}`).toBeDefined();
  });

  it.each(TEXT)("%s text reads on every surface (4.5:1)", (k) => {
    for (const s of SURFACES) expect(ratio(t[k], t[s]), `--${k} on --${s}`).toBeGreaterThanOrEqual(4.5);
  });

  it("the edge of a form control is at least 3:1 against every surface it can sit on", () => {
    for (const s of [...SURFACES, "secondary", "accent"]) expect(ratio(t.input, t[s]), `--input on --${s}`).toBeGreaterThanOrEqual(3);
  });

  it("status and protagonist text reads on its own soft fill (4.5:1)", () => {
    for (const k of ["ok", "fail", "warn", "info", "sun", "earth"])
      expect(ratio(t[k], t[`${k}-soft`]), `--${k} on --${k}-soft`).toBeGreaterThanOrEqual(4.5);
  });

  it("hover and selected backgrounds keep their text readable (4.5:1)", () => {
    for (const bg of ["secondary", "accent"]) {
      expect(ratio(t.foreground, t[bg]), `--foreground on --${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t["muted-foreground"], t[bg]), `--muted-foreground on --${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the primary button's label reads on the primary colour (4.5:1)", () => {
    expect(ratio(t["primary-foreground"], t.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it("the focus ring is visible against every surface (3:1)", () => {
    for (const s of SURFACES) expect(ratio(t.ring, t[s]), `--ring on --${s}`).toBeGreaterThanOrEqual(3);
  });
});

describe("token system", () => {
  it("maps every semantic token into Tailwind, so shadcn components can use them", () => {
    const theme = css.slice(css.indexOf("@theme inline"));
    for (const k of ["background", "foreground", "card", "popover", "primary", "secondary", "muted", "accent", "destructive", "border", "input", "ring", "sidebar", "sun", "earth", "ok", "fail", "warn", "info"])
      expect(theme, `--color-${k}`).toContain(`--color-${k}: var(--${k})`);
  });

  it("keeps shadcn's dark: variant on this app's own theme switch, not a .dark class", () => {
    expect(css).toContain("@custom-variant dark (@media not (prefers-color-scheme: light));");
    expect(css).not.toMatch(/^\.dark\s*\{/m);
  });
});
