import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Redesign phase B: the landing is the Moon, a wordmark and one button. It is accessible, it enters the Atlas, and it never pushes the page sideways. */
test("the landing passes axe", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "LunaScope" })).toBeVisible();
  await expect(page.getByText(/Lighting is illustrative/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});

test("Enter opens the Atlas", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Enter" }).click();
  await page.waitForURL(/\/atlas$/);
  await expect(page.getByTestId("atlas")).toBeVisible();
});

test("the Moon is drawn (or a still picture stands in), and the page does not scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const moon = page.getByTestId("landing-moon");
  await expect(moon).toBeVisible();
  await expect(moon.locator("canvas, [role=img]").first()).toBeAttached({ timeout: 15_000 });
  for (const w of [320, 768, 1440]) {
    await page.setViewportSize({ width: w, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
  }
});

test("reduced motion: the Moon is drawn once and does not turn", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("landing-moon").locator("canvas, [role=img]").first()).toBeAttached({ timeout: 15_000 });
  const long = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity).length);
  expect(long).toBe(0);
});
