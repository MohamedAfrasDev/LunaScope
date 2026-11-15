import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Atlas phase F: Site sky. The 3D sky of the run pages, full-bleed, with the Atlas supplying the controls and readouts. The
 * skyline, the Sun and Earth positions and their states are the service's; the clock moves the markers.
 */
const TILE = readFileSync(join(process.cwd(), "public", "explore", "moon-2k.jpg"));
const SITE_ROW = /^-89\.5 deg, 0 E/;

async function open(page: Page) {
  await page.route("**/trek.nasa.gov/tiles/**", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: TILE }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/atlas");
  await expect(page.getByTestId("explore")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  await expect(page.getByTestId("dock-status")).toContainText("Paused", { timeout: 200_000 });
}

const scaleButton = (page: Page, name: string) => page.getByRole("group", { name: "Scale" }).getByRole("button", { name });

async function enterSky(page: Page) {
  await page.getByRole("region", { name: "Sites" }).getByRole("button", { name: SITE_ROW }).click();
  await expect(page.getByTestId("site-cursor")).toBeVisible();
  await scaleButton(page, "Site sky").click();
  await expect(page.getByTestId("site-sky")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("sky3d").locator("canvas")).toBeVisible({ timeout: 30_000 });
}

const frames = (page: Page) => page.getByTestId("sky3d").evaluate((el) => Number(el.getAttribute("data-frames")));
const heading = (page: Page) => page.getByTestId("sky-heading");

test("Site sky is off until a site in the run is selected, and then enters the 3D sky", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await expect(scaleButton(page, "Site sky")).toBeDisabled();
  await enterSky(page);
  await expect(page.getByTestId("atlas")).toHaveAttribute("data-scale", "sky");
  await expect.poll(() => frames(page)).toBeGreaterThan(0);
  await expect(page.getByTestId("atlas-readout")).toContainText("SITE SKY (1× TRUE)");
  await expect(page.getByRole("region", { name: "Mission window" })).toBeVisible();
  await expect(page.getByTestId("mission-day")).toContainText(/Day 1 of \d+/);
  // the pins belong to the Moon, not the sky
  await expect(page.getByTestId("pin-layer")).toHaveCount(0);
});

test("the Sun and Earth readouts follow the clock, from the service", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await enterSky(page);
  const readout = page.getByTestId("atlas-readout");
  await expect(readout).toContainText(/AZ \d+\.\d° · EL [+−]\d+\.\d{2}°/);
  const before = await readout.innerText();
  const f0 = await frames(page);
  await page.getByTestId("time-dock").getByRole("button", { name: "Next event" }).click();
  await expect.poll(async () => readout.innerText()).not.toBe(before);
  await expect.poll(() => frames(page)).toBeGreaterThan(f0); // the markers moved: the scene drew again
});

test("Face the Sun points the view at the Sun's azimuth, and the compass says so", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await enterSky(page);
  await page.getByRole("button", { name: "Face north" }).click();
  await expect(heading(page)).toContainText("0° N");
  const sun = (await page.getByTestId("atlas-readout").innerText()).match(/AZ (\d+\.\d)° · EL/)!;
  await page.getByRole("button", { name: "Face the Sun" }).click();
  await expect.poll(async () => Number((await heading(page).innerText()).match(/(\d+)°/)![1])).toBe(Math.round(Number(sun[1])) % 360);
  await page.getByRole("button", { name: "Face east" }).click();
  await expect(heading(page)).toContainText("90° E");
  await expect(heading(page)).toContainText("Facing east");
});

test("exaggeration is stated on screen and in the scale readout; the paths toggle", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await enterSky(page);
  await page.getByRole("button", { name: "Exaggerate heights ×3" }).click();
  await expect(page.getByTestId("sky-controls").getByText(/exaggerated ×3/)).toBeVisible();
  await expect(page.getByTestId("atlas-readout")).toContainText("SITE SKY (3× HEIGHTS)");
  await expect(page.getByTestId("sky3d").locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Exaggerate heights ×3" }).click();
  await expect(page.getByTestId("atlas-readout")).toContainText("SITE SKY (1× TRUE)");

  const sun = page.getByRole("button", { name: "Sun path" });
  await expect(sun).toHaveAttribute("aria-pressed", "true");
  const f0 = await frames(page);
  await sun.click();
  await expect(sun).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => frames(page)).toBeGreaterThan(f0);
  await page.getByRole("button", { name: "All paths" }).click();
  await expect(sun).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "From outside" }).click();
  await expect(page.getByRole("button", { name: "From outside" })).toHaveAttribute("aria-pressed", "true");
});

test("Return to Moon brings the pins back, and entering from the Selected site card works", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await enterSky(page);
  await page.getByRole("button", { name: /Return to Moon/ }).click();
  await expect(page.getByTestId("atlas")).toHaveAttribute("data-scale", "moon");
  await expect(page.getByTestId("pin-layer")).toBeVisible();
  await expect(page.getByTestId("site-sky")).toHaveCount(0);
  await page.getByRole("region", { name: "Selected site" }).getByRole("button", { name: "Enter site sky" }).click();
  await expect(page.getByTestId("atlas")).toHaveAttribute("data-scale", "sky");
  // closing the selected site leaves Site sky, and selecting again does not jump back into it
  await page.getByRole("button", { name: "Close Selected site" }).click();
  await expect(page.getByTestId("atlas")).toHaveAttribute("data-scale", "moon");
  await page.getByRole("region", { name: "Sites" }).getByRole("button", { name: SITE_ROW }).click();
  await expect(page.getByTestId("atlas")).toHaveAttribute("data-scale", "moon");
});

test("a site that is not in the run cannot enter Site sky", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await page.getByRole("region", { name: "Sites" }).getByRole("button", { name: /^Shackleton/ }).click();
  await expect(scaleButton(page, "Site sky")).toBeDisabled();
  await expect(page.getByRole("region", { name: "Selected site" }).getByRole("button", { name: "Enter site sky" })).toBeDisabled();
});

test("Site sky with its controls and the Mission window passes axe", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await enterSky(page);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});
