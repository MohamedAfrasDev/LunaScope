import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Colour contrast guard for the Atlas scope (docs/redesign/LAYOUT-SPEC.md, section 5.1), computed from the real stylesheet
 * so a palette edit cannot quietly break it. Same rules as tokens.test.ts: text 4.5:1, control edges 3:1. Panels are drawn
 * at 90% over the imagery, so text is also checked on the worst case: the panel colour mixed over pure white.
 */
const css = readFileSync("app/atlas.css", "utf-8").replace(/\r\n/g, "\n");
const root = readFileSync("app/globals.css", "utf-8");

const a: Record<string, string> = {};
for (const m of css.slice(css.indexOf(".atlas {"), css.indexOf("/* Instrument labels")).matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) a[m[1]] = m[2];

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(x: string, y: string): number {
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}
function over(fg: string, bg: string, alpha: number): string {
  const mix = [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * alpha + parseInt(bg.slice(i, i + 2), 16) * (1 - alpha)));
  return `#${mix.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

const SURF = ["void", "panel", "panel-raised"];
const TXT = ["ink", "ink-dim", "sun", "earth", "ok", "warn", "fail", "info"];

describe("atlas scope", () => {
  it("is imported by the global stylesheet", () => {
    expect(root).toContain('@import "./atlas.css";');
  });

  it("defines every token the guard reads", () => {
    for (const k of [...SURF, ...TXT, "panel-edge", "select", "sun-soft", "earth-soft", "ok-soft", "warn-soft", "fail-soft", "info-soft", "input", "ring"])
      expect(a[k], `--${k}`).toBeDefined();
  });

  it.each(TXT)("%s text reads on every Atlas surface (4.5:1)", (k) => {
    for (const s of SURF) expect(ratio(a[k], a[s]), `--${k} on --${s}`).toBeGreaterThanOrEqual(4.5);
  });

  it("panel text still reads when the panel sits over the brightest imagery", () => {
    const worst = over(a.panel, "#ffffff", 0.9);
    for (const k of ["ink", "ink-dim", "sun", "earth"]) expect(ratio(a[k], worst), `--${k} on panel over white`).toBeGreaterThanOrEqual(4.5);
  });

  it("status and protagonist text reads on its own soft fill (4.5:1)", () => {
    for (const k of ["ok", "fail", "warn", "info", "sun", "earth"]) expect(ratio(a[k], a[`${k}-soft`]), `--${k} on --${k}-soft`).toBeGreaterThanOrEqual(4.5);
  });

  it("control edges and the selection ring are visible (3:1)", () => {
    for (const s of SURF) {
      expect(ratio(a.input, a[s]), `--input on --${s}`).toBeGreaterThanOrEqual(3);
      expect(ratio(a.select, a[s]), `--select on --${s}`).toBeGreaterThanOrEqual(3);
      expect(ratio(a.ring, a[s]), `--ring on --${s}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps selection neutral: white, never a hue that could be read as Sun or Earth", () => {
    expect(a.select.toLowerCase()).toBe("#ffffff");
    expect(a.sun).not.toBe(a.earth);
  });

  it("re-points the shadcn tokens at the Atlas palette, so shadcn components render on it", () => {
    expect(a.card).toBe(a.panel);
    expect(a.foreground).toBe(a.ink);
    expect(a["muted-foreground"]).toBe(a["ink-dim"]);
    expect(a.ring).toBe(a.select);
  });
});
