import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Galaxy G6: calm, honest states: a missing page, a missing run, short toasts, and loading blocks that stop under reduced motion. */
test("an unknown address shows the calm not-found page inside the shell, and passes axe", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "This page is not here" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Home" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map((v) => v.id))).toEqual([]);
});

test("a run id that does not exist says so, with a way forward", async ({ page }) => {
  await page.goto(`/runs/${"0".repeat(64)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Run not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a new analysis" })).toHaveAttribute("href", "/analyze");
});

test("a palette action confirms with a short toast", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/analyze");
  await page.getByRole("button", { name: /Search/ }).click();
  await page.keyboard.type("technical");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Technical view on")).toBeVisible();
  await page.getByRole("button", { name: "Guided" }).click(); // leave the browser as it was
});

test("loading blocks pulse slowly, and stop under reduced motion", async ({ page }) => {
  // use the real stylesheet: load a page, then add a skeleton to it
  for (const [motion, expected] of [["no-preference", "soft-pulse"], ["reduce", "none"]] as const) {
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto("/analyze");
    const name = await page.evaluate(() => {
      const d = document.createElement("div");
      d.setAttribute("data-slot", "skeleton");
      document.body.appendChild(d);
      const n = getComputedStyle(d).animationName;
      d.remove();
      return n;
    });
    // reduced motion shortens durations (see globals.css) and defines no pulse at all
    expect(name).toBe(expected);
  }
});
