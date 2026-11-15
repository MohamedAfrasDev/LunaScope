import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Galaxy explorer E1: the Moon globe. NASA's tile server is replaced by a local picture (or blocked) so the tests
 * are deterministic and work offline.
 */
const TILE = readFileSync(join(process.cwd(), "public", "explore", "moon-2k.jpg"));
const TILES = "**/trek.nasa.gov/tiles/**";

async function open(page: Page, tiles: "local" | "blocked" = "local") {
  await page.route(TILES, (route) =>
    tiles === "local" ? route.fulfill({ status: 200, contentType: "image/jpeg", body: TILE }) : route.abort(),
  );
  await page.goto("/explore");
  const stage = page.getByTestId("explore");
  await expect(stage).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  await expect(page.getByTestId("explore-readout")).toContainText("Height");
  return stage;
}

const heightKm = async (page: Page) => {
  const t = (await page.getByTestId("explore-readout").innerText()).match(/Height ([\d,]+) (km|m)/);
  return t ? Number(t[1].replace(/,/g, "")) * (t[2] === "km" ? 1000 : 1) : NaN;
};

test("the Moon globe starts, is sized to its frame and credits its imagery", async ({ page }) => {
  await open(page);
  const size = await page.locator("canvas").first().evaluate((c) => ({ w: c.clientWidth, h: c.clientHeight, cw: (c as HTMLCanvasElement).width }));
  expect(size.w).toBeGreaterThan(400);
  expect(size.h).toBeGreaterThan(300);
  expect(size.cw).toBeGreaterThan(300); // the drawing surface follows the frame (not the 300x150 default)
  await expect(page.getByRole("heading", { level: 1, name: "Explore the Moon" })).toBeVisible();
  await expect(page.getByText(/NASA\/GSFC\/Arizona State University/)).toBeVisible();
  await expect(page.getByText(/not an analysis result/).first()).toBeVisible();
  await expect(page.getByTestId("explore")).toHaveAttribute("data-low-res", "false");
});

test("the controls work: south pole, whole Moon, zoom, keyboard", async ({ page }) => {
  await open(page);
  const readout = page.getByTestId("explore-readout");

  await page.getByRole("button", { name: "South pole" }).click();
  await expect(readout).toContainText("90.0° S", { timeout: 15_000 });
  await page.getByRole("button", { name: "Whole Moon" }).click();
  await expect(readout).toContainText("0.0° N", { timeout: 15_000 });

  const before = await heightKm(page);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => heightKm(page)).toBeLessThan(before);
  await page.getByRole("button", { name: "Zoom out" }).click();
  await page.getByRole("button", { name: "Zoom out" }).click();
  await expect.poll(() => heightKm(page)).toBeGreaterThan(before);

  // keyboard: the globe is a focusable application region; arrows turn it, Home returns to the whole Moon
  await page.getByRole("application", { name: /Moon globe/ }).focus();
  const centre = await readout.innerText();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await readout.innerText()).split("\n")[0]).not.toBe(centre.split("\n")[0]);
  await page.keyboard.press("Home");
  await expect(readout).toContainText("4,800 km", { timeout: 15_000 });
});

test("without the tile server the page says so and keeps a picture of the Moon", async ({ page }) => {
  const stage = await open(page, "blocked");
  await expect(stage).toHaveAttribute("data-low-res", "true", { timeout: 60_000 });
  await expect(page.getByText(/bundled low-resolution picture/)).toBeVisible();
});

test("only the explorer loads the globe library", async ({ page }) => {
  const seen: string[] = [];
  page.on("request", (r) => {
    if (/cesium/i.test(r.url())) seen.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.goto("/analyze");
  await page.getByRole("heading", { level: 1 }).waitFor();
  expect(seen).toEqual([]);
});

for (const scheme of ["dark", "light"] as const) {
  test(`axe: the explorer, ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await open(page);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}
