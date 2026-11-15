import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

/**
 * Phase 13 sweep, in a real browser on the synthetic stack: layout from a 320 px phone to a 1440 px
 * desktop, target size, reduced motion, keyboard operation of the new disclosures and the status pill,
 * and the semantics a screen reader relies on (names, descriptions, current page, heading order).
 */
const WIDTHS = [320, 375, 768, 1024, 1440];

async function gr001(request: APIRequestContext): Promise<string> {
  const ref = await (await request.get("/api/v1/references/GR-001")).json();
  const run = await (await request.post("/api/v1/analyses", { data: ref.request })).json();
  return run.run_id as string;
}

async function ready(page: Page, id: string) {
  await page.goto(`/runs/${id}`);
  await expect(page.getByRole("region", { name: /Result state/ }).first()).toBeVisible({ timeout: 240_000 });
}

async function tabTo(page: Page, target: Locator, max = 80) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`not reachable with Tab: ${target}`);
}

function routes(id: string): [string, string][] {
  const run = `/runs/${id}`;
  return [
    ["home", "/"], ["analyze", "/analyze"], ["why", "/why-the-south-pole-is-hard"], ["run", run],
    ["timeline", `${run}/timeline/rule-89.5S-E0`], ["sky", `${run}/sky/rule-89.5S-E0`], ["compare", `${run}/compare`],
    ["time-machine", `${run}/time-machine`], ["evidence", `${run}/evidence`],
  ];
}

test("no page scrolls sideways from 320 to 1440 px, and standalone targets are at least 24 px", async ({ page, request }) => {
  test.setTimeout(480_000);
  const id = await gr001(request);
  await ready(page, id);
  const sideways: string[] = [];
  const small: string[] = [];
  for (const [name, path] of routes(id)) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(path);
    await page.waitForLoadState("load");
    await page.waitForTimeout(name === "sky" || name === "timeline" || name === "compare" || name === "time-machine" ? 2500 : 900);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(150);
      const m = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, w: window.innerWidth }));
      if (m.s > m.w + 1) sideways.push(`${name} at ${w}px is ${m.s}px wide`);
    }
    // target size (WCAG 2.5.8) at phone width; links inside a sentence and visually hidden skip links are exempt
    await page.setViewportSize({ width: 375, height: 900 });
    await page.waitForTimeout(150);
    const tiny = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll("a[href], button, select, summary, input:not([type=checkbox]):not([type=radio])")) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (cs.visibility === "hidden" || cs.display === "none" || r.width === 0 || r.height === 0) continue;
        if (el.tagName === "A" && cs.display === "inline") continue; // inside running text
        if (el.closest("details:not([open])") && !el.matches("summary")) continue; // not rendered
        if (r.width < 24 || r.height < 24) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return out.filter((x) => !x.includes("Skip to content"));
    });
    if (tiny.length) small.push(`${name}: ${[...new Set(tiny)].slice(0, 4).join("; ")}`);
  }
  expect(sideways, "pages wider than the window").toEqual([]);
  expect(small, "interactive targets under 24 x 24 px").toEqual([]);
});

test("reduced motion: nothing runs longer than a few milliseconds, and the page is complete without it", async ({ page, request }) => {
  const id = await gr001(request);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, id);
  for (const path of ["/", `/runs/${id}/sky/rule-89.5S-E0`, `/runs/${id}/timeline/rule-89.5S-E0`]) {
    await page.goto(path);
    await page.waitForTimeout(700);
    const long = await page.evaluate(() =>
      document.getAnimations().filter((a) => (a.effect?.getTiming().duration as number) > 5 || a.effect?.getTiming().iterations === Infinity).length);
    expect(long, `running animations on ${path}`).toBe(0);
  }
  // the hero's lines of sight are drawn in their final state straight away
  await page.goto("/");
  const opacity = await page.locator(".hero-in").first().evaluate((el) => getComputedStyle(el).opacity);
  expect(opacity).toBe("1");
});

test("keyboard: disclosures open with Enter and Space, and the status pill closes with Escape", async ({ page, request }) => {
  const id = await gr001(request);
  await ready(page, id);

  // a disclosure on the run page
  const summary = page.locator("summary", { hasText: "Full comparison table" });
  await tabTo(page, summary);
  const details = summary.locator("xpath=ancestor::details[1]");
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await page.keyboard.press("Space");
  await expect(details).not.toHaveAttribute("open", "");

  // the status pill: Enter opens the full sentence, Escape closes it and returns focus to the pill
  const pill = page.locator("header summary").first();
  await tabTo(page, pill);
  await page.keyboard.press("Enter");
  await expect(page.locator("header details").first()).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(page.locator("header details").first()).not.toHaveAttribute("open", "");
  await expect(pill).toBeFocused();

  // Advanced settings on the analysis form
  await page.goto("/analyze");
  const adv = page.locator("summary", { hasText: "Advanced settings" });
  await tabTo(page, adv);
  await page.keyboard.press("Enter");
  await expect(page.getByLabel(/Horizon radius/)).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByLabel(/Horizon radius/)).toBeHidden();
});

test("keyboard: every tab of a run is reachable in order, and the current one is announced", async ({ page, request }) => {
  const id = await gr001(request);
  await ready(page, id);
  const nav = page.getByRole("navigation", { name: "Analysis views" });
  await expect(nav.getByRole("link", { name: "Matrix" })).toHaveAttribute("aria-current", "page");
  const names = ["Matrix", "Timeline", "Sky", "Compare", "Time Machine", "Evidence"];
  await tabTo(page, nav.getByRole("link", { name: "Matrix" }));
  for (const name of names.slice(1)) {
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link", { name })).toBeFocused();
  }
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/evidence$/);
  await expect(page.getByRole("navigation", { name: "Analysis views" }).getByRole("link", { name: "Evidence" }))
    .toHaveAttribute("aria-current", "page");
});

test("screen reader semantics: names, descriptions and one h1 with no skipped heading level", async ({ page, request }) => {
  test.setTimeout(240_000);
  const id = await gr001(request);
  await ready(page, id);

  // the status pill reads as its state and says it opens details; the hero drawing has a name and a description
  await page.goto("/analyze");
  await expect(page.locator("header summary").first()).toHaveAccessibleName(/(Synthetic demonstration data|Real data, unverified).*show details/);
  await page.goto("/");
  const hero = page.getByRole("img", { name: /Sketch: a ridge hides the Sun/ });
  await expect(hero).toHaveAccessibleDescription(/not to scale, and not taken from any data/);

  for (const [name, path] of routes(id)) {
    await page.goto(path);
    await page.waitForLoadState("load");
    await page.waitForTimeout(name === "home" || name === "analyze" || name === "why" ? 600 : 2500);
    const levels = await page.evaluate(() => [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => Number(h.tagName[1])));
    expect(levels.filter((l) => l === 1), `${name} should have exactly one h1`).toHaveLength(1);
    expect(levels[0], `${name} should start with its h1`).toBe(1);
    const jumps = levels.flatMap((l, i) => (i > 0 && l > levels[i - 1] + 1 ? [`h${levels[i - 1]} to h${l}`] : []));
    expect(jumps, `${name} skips a heading level`).toEqual([]);
  }
});
