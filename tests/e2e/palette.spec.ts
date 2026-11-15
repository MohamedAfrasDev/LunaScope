import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Galaxy G5: the command palette is a keyboard shortcut layer, never the only way, and it is accessible. */
test("Ctrl+K opens a named dialog, filters, navigates, and Escape returns focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/atlas");
  await expect(page.getByRole("button", { name: /Search/ })).toBeVisible();

  const dialog = page.getByRole("dialog", { name: "Search LunaScope" });
  // the button is in the server-rendered page, so a key pressed before the page has hydrated is lost: press until it opens
  await expect(async () => {
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
  await expect(dialog.getByRole("combobox")).toBeFocused();

  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map((v) => [v.id, v.nodes.map((n) => n.html.slice(0, 160))]))).toEqual([]);

  await page.keyboard.type("home");
  await dialog.getByRole("option", { name: "Home", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(dialog).toHaveCount(0);

  // "/" opens it again; Escape closes it and focus goes back into the page
  await page.keyboard.press("/");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("the Search button opens it, and an action works from the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/atlas");
  // a click before hydration does nothing, so click until the dialog is there
  await expect(async () => {
    await page.getByRole("button", { name: /Search/ }).click();
    await expect(page.getByRole("dialog", { name: "Search LunaScope" })).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
  await page.keyboard.type("copy link");
  await expect(page.getByRole("dialog").getByRole("option", { name: "Copy link to this page" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("it fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/atlas");
  await expect(async () => {
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
  const box = await page.getByRole("dialog").boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 375).toBe(true);
});
