import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Atlas phase C: sites on the Moon. NASA's tile server is replaced by a local picture so the test is deterministic and
 * works offline. The science service (synthetic stack) supplies the site list and checks custom points.
 */
const TILE = readFileSync(join(process.cwd(), "public", "explore", "moon-2k.jpg"));

async function open(page: Page) {
  await page.route("**/trek.nasa.gov/tiles/**", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: TILE }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/atlas");
  await expect(page.getByTestId("explore")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  await expect(row(page, /Haworth/)).toBeVisible({ timeout: 30_000 }); // the site list loaded
}

/** A site's row in the Sites list (the pins are buttons too, so the list is addressed by its panel). */
const row = (page: Page, name: RegExp) => page.getByRole("region", { name: "Sites" }).getByRole("button", { name });

/** Every pin label that is showing, as a rectangle. */
const labelBoxes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="pin-layer"] .atlas-pin-label')]
      .filter((l) => !l.hidden && (l.closest("button") as HTMLElement).style.display !== "none")
      .map((l) => {
        const r = l.getBoundingClientRect();
        return { t: l.textContent ?? "", x: r.x, y: r.y, w: r.width, h: r.height };
      }),
  );

test("the sites are pins on the Moon, and choosing one selects it", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1); // one h1, named, for screen readers
  const pins = page.locator('[data-testid="pin-layer"] button[data-site]');
  expect(await pins.count()).toBeGreaterThanOrEqual(15);

  // choose from the list (the keyboard route to every pin)
  await row(page, /^Haworth/).click();
  const panel = page.getByRole("region", { name: "Selected site" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Haworth" })).toBeVisible();
  await expect(panel.getByText(/87\.\d{3}° S/)).toBeVisible();
  await expect(panel.getByText(/No run is loaded/)).toBeVisible();
  await expect(panel.getByRole("link", { name: "Analyse this site" })).toHaveAttribute("href", /\/analyze\?d=/);

  // the selected pin is on screen and marked
  const pin = page.locator('button[data-site="iau-haworth"]');
  await expect(pin).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => pin.evaluate((el) => (el as HTMLElement).style.display), { timeout: 15_000 }).toBe("");
});

test("no two showing labels overlap, at the pole view and after zooming in on a site", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "South pole" }).click();
  await page.waitForTimeout(2500);
  const check = async (name: string) => {
    const b = await labelBoxes(page);
    for (const p of b) for (const q of b) if (p !== q) expect(p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h, `${name}: "${p.t}" overlaps "${q.t}"`).toBe(false);
    return b.length;
  };
  expect(await check("pole view")).toBeGreaterThan(0);
  await row(page, /^Shackleton/).click();
  await page.waitForTimeout(3000);
  expect(await check("on a site")).toBeGreaterThan(0);
});

test("a point added by coordinates is checked by the service, selected, and can be removed", async ({ page }) => {
  await open(page);
  await page.getByLabel("Latitude (°)").fill("-70");
  await page.getByLabel("East longitude (°)").fill("10");
  await page.getByRole("button", { name: "Check coverage and add" }).click();
  await expect(page.getByRole("status").filter({ hasText: /covers 80° S to the pole/ })).toBeVisible(); // refused before anything is sent

  await page.getByLabel("Latitude (°)").fill("-88");
  await page.getByRole("button", { name: "Check coverage and add" }).click();
  await expect(page.getByText("Point added and selected.")).toBeVisible();
  const panel = page.getByRole("region", { name: "Selected site" });
  await expect(panel.getByRole("heading", { name: "Custom point 1" })).toBeVisible();
  await expect(panel.getByText("Terrain data", { exact: true })).toBeVisible();
  await expect(panel.getByText("ASSUMPTION")).toBeVisible();

  await panel.getByRole("button", { name: "Remove point" }).click();
  await expect(page.getByRole("region", { name: "Selected site" })).toHaveCount(0);
  await expect(page.locator('button[data-site="custom-1"]')).toHaveCount(0);
});

test("Place a point turns a click on the Moon into a checked point", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Place a point" }).click();
  await expect(page.getByText(/Click the Moon to place a point/)).toBeVisible();
  // the pole view is centred on the pole, so the middle of the screen is inside the terrain data
  await page.mouse.click(720, 520);
  await expect(page.getByRole("region", { name: "Selected site" }).getByRole("heading", { name: "Custom point 1" })).toBeVisible({ timeout: 20_000 });
});

test("the Atlas with sites passes axe", async ({ page }) => {
  await open(page);
  await row(page, /^Haworth/).click();
  await expect(page.getByRole("region", { name: "Selected site" })).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});
