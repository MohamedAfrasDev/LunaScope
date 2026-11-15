import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Sun and Earth paths for sites the loaded run does not hold (Haworth, Shackleton, custom points): the science service computes a
 * one-site run on request, and everything that works for a site of the run then works for it, including Site sky.
 */
const TILE = readFileSync(join(process.cwd(), "public", "explore", "moon-2k.jpg"));

async function open(page: Page) {
  await page.route("**/trek.nasa.gov/tiles/**", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: TILE }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/atlas");
  await expect(page.getByTestId("explore")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  await expect(page.getByTestId("dock-status")).toContainText("Paused", { timeout: 280_000 });
}

const sites = (page: Page) => page.getByRole("region", { name: "Sites", exact: true });
const card = (page: Page) => page.getByRole("region", { name: "Selected site", exact: true });

test("a catalog site the run does not hold can be computed, and then has paths, metrics and Site sky", async ({ page }) => {
  test.setTimeout(480_000);
  await open(page);
  await sites(page).getByRole("button", { name: /^Haworth/ }).click();
  await expect(card(page).getByTestId("compute-block")).toBeVisible();
  await expect(card(page).getByRole("button", { name: "Enter site sky" })).toBeDisabled();
  await expect(page.getByTestId("site-cursor")).toHaveCount(0);

  await card(page).getByRole("button", { name: "Compute sky for this site" }).click();
  await expect(card(page).getByTestId("compute-status")).toContainText("Computing");
  await expect(page.getByTestId("site-cursor")).toBeVisible({ timeout: 400_000 });
  await expect(card(page).getByTestId("compute-block")).toHaveCount(0);
  await expect(card(page).getByRole("button", { name: "Enter site sky" })).toBeEnabled();

  // the result panels work for it
  await page.getByRole("navigation", { name: "Atlas" }).getByRole("button", { name: "Metrics", exact: true }).click();
  await expect(page.getByTestId("availability-sun_center")).toBeVisible();

  // Site sky works, with the Sun's and Earth's own paths at this site
  await card(page).getByRole("button", { name: "Enter site sky" }).click();
  await expect(page.getByTestId("site-sky")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("sky3d").locator("canvas")).toBeVisible({ timeout: 30_000 });
  const readout = page.getByTestId("atlas-readout");
  const before = await readout.innerText();
  await page.getByTestId("time-dock").getByRole("button", { name: "Next event" }).click();
  await expect.poll(async () => readout.innerText()).not.toBe(before);
});

test("the Earth turns as the clock runs: the side that faces the Moon changes", async ({ page }) => {
  test.setTimeout(480_000);
  await open(page);
  await page.getByRole("region", { name: "Sites", exact: true }).getByRole("button", { name: /^-89\.5 deg, 0 E/ }).click();
  await card(page).getByRole("button", { name: "Enter site sky" }).click();
  const sky = page.getByTestId("sky3d");
  await expect(sky.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expect(sky).toHaveAttribute("data-earth-sublunar", /^-?\d+\.\d,-?\d+\.\d$/, { timeout: 30_000 });
  const lon = async () => Number(((await sky.getAttribute("data-earth-sublunar")) ?? "0,0").split(",")[1]);
  const lon0 = await lon();
  // six hours later, the Earth has turned a quarter of a turn (about 87 degrees west)
  const dock = page.getByTestId("time-dock");
  await dock.getByLabel("Go to (UTC)").evaluate((el: HTMLInputElement) => el.value);
  const start = await dock.getByLabel("Go to (UTC)").inputValue();
  const later = new Date(Date.parse(start + ":00Z") + 6 * 3600_000).toISOString().slice(0, 16);
  await dock.getByLabel("Go to (UTC)").fill(later);
  await dock.getByRole("button", { name: "Go" }).click();
  await expect.poll(async () => Math.abs((((await lon()) - lon0 + 540) % 360) - 180)).toBeGreaterThan(60);
});

test("a custom point can be computed the same way and enters Site sky", async ({ page }) => {
  test.setTimeout(480_000);
  await open(page);
  await sites(page).getByLabel("Latitude (°)").fill("-86");
  await sites(page).getByLabel("East longitude (°)").fill("30");
  await sites(page).getByRole("button", { name: "Check coverage and add" }).click();
  await expect(card(page).getByRole("heading", { name: "Custom point 1" })).toBeVisible({ timeout: 30_000 });
  await expect(card(page).getByTestId("compute-block")).toBeVisible();
  await card(page).getByRole("button", { name: "Compute sky for this site" }).click();
  await expect(page.getByTestId("site-cursor")).toBeVisible({ timeout: 400_000 });
  await card(page).getByRole("button", { name: "Enter site sky" }).click();
  await expect(page.getByTestId("site-sky")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("sky3d").locator("canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("atlas-readout")).toContainText(/AZ \d+\.\d° · EL [+−]\d+\.\d{2}°/);
});

test("the card with the compute block passes axe", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await sites(page).getByRole("button", { name: /^Shackleton/ }).click();
  await expect(card(page).getByTestId("compute-block")).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});
