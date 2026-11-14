import { expect, test, type Page } from "@playwright/test";

/**
 * Phone width (390 px): no page may scroll sideways. A wide table belongs in its own scroll box. A grid
 * item defaults to min-width:auto, so without min-width:0 one table's minimum width widened the whole page
 * (found on the hosted site: run, Time Machine, Evidence and Timeline pages were 640 to 884 px wide).
 */
test.use({ viewport: { width: 390, height: 844 } });

async function noSidewaysScroll(page: Page, name: string) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(800); // let the page settle; the dev server keeps a socket open, so not networkidle
  const m = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(m.scrollW, `${name} is ${m.scrollW}px wide in a ${m.w}px window`).toBeLessThanOrEqual(m.w + 1);
}

test("no page scrolls sideways at phone width", async ({ page }) => {
  await page.goto("/");
  await noSidewaysScroll(page, "home");
  await page.getByRole("button", { name: "Start the reference mission" }).click();
  await page.waitForURL(/\/runs\/[0-9a-f]{64}$/);
  const run = page.url();
  await expect(page.getByRole("table").first()).toBeVisible({ timeout: 90_000 });
  await noSidewaysScroll(page, "run");

  const sky = await page.getByRole("link", { name: "Local sky" }).first().getAttribute("href");
  const timeline = await page.getByRole("link", { name: /Timeline and evidence/ }).first().getAttribute("href");
  for (const [name, path] of [["sky", sky], ["timeline", timeline], ["time-machine", `${new URL(run).pathname}/time-machine`], ["evidence", `${new URL(run).pathname}/evidence`]] as const) {
    await page.goto(path!);
    await noSidewaysScroll(page, name);
  }
});
