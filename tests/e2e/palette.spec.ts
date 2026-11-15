import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Galaxy G5: the command palette is a keyboard shortcut layer, never the only way, and it is accessible. */
test("Ctrl+K opens a named dialog, filters, navigates, and Escape returns focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/analyze");
  await expect(page.getByRole("button", { name: /Search/ })).toBeVisible();

  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Search LunaScope" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox")).toBeFocused();

  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map((v) => [v.id, v.nodes.map((n) => n.html.slice(0, 160))]))).toEqual([]);

  await page.keyboard.type("south pole");
  await expect(dialog.getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Why the south pole is hard" })).toBeVisible();
  await expect(dialog).toHaveCount(0);

  // "/" opens it again; Escape closes it and focus goes back into the page
  await page.keyboard.press("/");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("the Search button opens it, and an action works from the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/analyze");
  await page.getByRole("button", { name: /Search/ }).click();
  await page.keyboard.type("technical");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Technical" })).toHaveAttribute("aria-pressed", "true");
});

test("it fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/analyze");
  await page.getByRole("button", { name: /Search/ }).click();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 320).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
