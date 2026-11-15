import { expect, test, type Page } from "@playwright/test";

/** Galaxy G3: the star drift runs only without reduced motion and unless paused; the backdrop never blocks the page. */
const drift = (page: Page) => page.locator(".backdrop-stars").evaluate((el) => getComputedStyle(el).animationName);

test("the backdrop drifts by default, stops when paused, and is inert", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "no-preference" });
  await page.goto("/");
  expect(await drift(page)).toBe("star-drift");
  await expect(page.locator(".backdrop")).toHaveAttribute("aria-hidden", "true");
  expect(await page.locator(".backdrop").evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  await page.getByRole("button", { name: "Pause background motion" }).click();
  expect(await drift(page)).toBe("none");
  await page.reload();
  await expect(page.getByRole("button", { name: "Resume background motion" })).toBeVisible();
  expect(await drift(page)).toBe("none");
  await page.getByRole("button", { name: "Resume background motion" }).click();
  expect(await drift(page)).toBe("star-drift");
});

test("reduced motion: no drift at all", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  expect(await drift(page)).toBe("none");
});
