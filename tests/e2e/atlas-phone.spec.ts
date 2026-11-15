import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Atlas phase I: phone and tablet. From 320 px up nothing scrolls sideways; on a phone the bar folds behind a Menu, one panel at a
 * time is a bottom sheet, and the dock keeps play, the scrubber, the time, the data label and the imagery credit in view.
 */
const TILE = readFileSync(join(process.cwd(), "public", "explore", "moon-2k.jpg"));

async function open(page: Page, width: number, height: number) {
  await page.route("**/trek.nasa.gov/tiles/**", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: TILE }));
  await page.setViewportSize({ width, height });
  await page.goto("/atlas");
  await expect(page.getByTestId("explore")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  await expect(page.getByTestId("dock-status")).toContainText("Paused", { timeout: 200_000 });
}

const sideways = (page: Page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
const inside = async (page: Page, testId: string) => {
  const b = (await page.getByTestId(testId).boundingBox())!;
  const v = page.viewportSize()!;
  return b.x >= -1 && b.y >= -1 && b.x + b.width <= v.width + 1 && b.y + b.height <= v.height + 1;
};

for (const [w, h] of [[320, 640], [375, 812], [414, 896]] as const) {
  test(`phone ${w}px: nothing scrolls sideways, and the first screen is the Moon with a bar, a time and a dock`, async ({ page }) => {
    test.setTimeout(300_000);
    await open(page, w, h);
    const m = await sideways(page);
    expect(m.sw).toBeLessThanOrEqual(m.w);
    await expect(page.getByTestId("phone-layout")).toBeVisible();
    // nothing opens on its own, so the globe is not covered
    await expect(page.getByRole("region", { name: "Sites" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("run-chip")).toBeVisible();
    await expect(page.getByTestId("atlas-readout")).toBeVisible();
    const dock = page.getByTestId("time-dock");
    await expect(dock.getByRole("button", { name: "Play" })).toBeVisible();
    await expect(dock.getByRole("slider", { name: "Time (UTC)" })).toBeVisible();
    await expect(dock.getByText(/Not endorsed by NASA/)).toBeVisible(); // the imagery credit stays in view
    expect(await inside(page, "time-dock")).toBe(true);
    const box = (await dock.boundingBox())!;
    expect(box.height).toBeLessThan(h * 0.45); // the dock leaves more than half of the screen to the Moon
  });
}

test("phone: the Menu opens the groups, a panel is one bottom sheet, and choosing closes the menu", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, 375, 812);
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Sites", exact: true }).click();
  await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  const sites = page.getByRole("region", { name: "Sites" });
  await expect(sites).toBeVisible();
  expect(await inside(page, "phone-layout")).toBe(true);

  // choosing a site replaces the list with its card (one sheet at a time)
  await sites.getByRole("button", { name: /^-89\.5 deg, 0 E/ }).click();
  await expect(page.getByRole("region", { name: "Selected site" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sites" })).toHaveCount(0);
  await expect(page.getByTestId("site-cursor")).toBeVisible();

  // a result panel replaces the card
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Metrics", exact: true }).click();
  await expect(page.getByRole("region", { name: "Metrics", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Selected site" })).toHaveCount(0);
  await expect(page.getByTestId("availability-sun_center")).toBeVisible();
  const m = await sideways(page);
  expect(m.sw).toBeLessThanOrEqual(m.w);
  // the sheet and the dock both fit, and the dock is still reachable
  const sheet = (await page.getByRole("region", { name: "Metrics", exact: true }).boundingBox())!;
  const dock = (await page.getByTestId("time-dock").boundingBox())!;
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(dock.y + 1);
  expect(sheet.y).toBeGreaterThan(60); // below the bar
});

test("phone: More reveals speed, direction, events and go-to; the clock still works from the sheet", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, 375, 812);
  const dock = page.getByTestId("time-dock");
  await expect(dock.getByRole("button", { name: "Next event" })).toHaveCount(0);
  await dock.getByRole("button", { name: "More", exact: true }).click();
  await expect(dock.getByRole("button", { name: "Next event" })).toBeVisible();
  await expect(dock.getByLabel("Go to (UTC)")).toBeVisible();
  await dock.getByRole("button", { name: "Next event" }).click();
  await expect(page.getByTestId("dock-elapsed")).not.toHaveText("T+ 0 D 0 H");
  expect(await inside(page, "time-dock")).toBe(true);
});

test("phone: Site sky keeps Return to Moon and the heading in view, with the other controls behind Controls", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, 375, 812);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Sites", exact: true }).click();
  await page.getByRole("region", { name: "Sites" }).getByRole("button", { name: /^-89\.5 deg, 0 E/ }).click();
  await page.getByRole("region", { name: "Selected site" }).getByRole("button", { name: "Enter site sky" }).click();
  await expect(page.getByTestId("site-sky")).toBeVisible({ timeout: 60_000 });
  const controls = page.getByTestId("sky-controls");
  await expect(controls.getByRole("button", { name: /Return to Moon/ })).toBeVisible();
  await expect(page.getByTestId("sky-heading")).toBeVisible();
  await expect(controls.getByRole("button", { name: "Face the Sun" })).toHaveCount(0);
  await controls.getByRole("button", { name: "Controls", exact: true }).click();
  await expect(controls.getByRole("button", { name: "Face the Sun" })).toBeVisible();
  const m = await sideways(page);
  expect(m.sw).toBeLessThanOrEqual(m.w);
});

test("tablet 768px: nothing scrolls sideways and the desktop columns are used", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, 768, 1024);
  const m = await sideways(page);
  expect(m.sw).toBeLessThanOrEqual(m.w);
  await expect(page.getByTestId("phone-layout")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Sites" })).toBeVisible();
});

test("phone: the Atlas with the menu open, a sheet and the dock expanded passes axe", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, 375, 812);
  const check = async () => {
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  };
  await check();
  await page.getByRole("button", { name: "Menu" }).click();
  await check();
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await page.getByTestId("time-dock").getByRole("button", { name: "More", exact: true }).click();
  await check();
});
