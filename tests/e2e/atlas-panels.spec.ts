import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Atlas phase E: the result panels. The key check is parity: a number on an Atlas panel is the same text as the same number on
 * the run pages, because both are worded from the service's values by the same formatters.
 */
const TILE = readFileSync(join(process.cwd(), "public", "explore", "moon-2k.jpg"));
const SITE = "rule-89.5S-E0";
const SITE_ROW = /^-89\.5 deg, 0 E/;

async function gr001(request: APIRequestContext): Promise<string> {
  const ref = await (await request.get("/api/v1/references/GR-001")).json();
  const run = await (await request.post("/api/v1/analyses", { data: ref.request })).json();
  return run.run_id as string;
}

async function open(page: Page) {
  await page.route("**/trek.nasa.gov/tiles/**", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: TILE }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/atlas");
  await expect(page.getByTestId("explore")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  await expect(page.getByTestId("dock-status")).toContainText("Paused", { timeout: 200_000 });
}

const panelButton = (page: Page, name: string) => page.getByRole("navigation", { name: "Atlas" }).getByRole("button", { name, exact: true });
async function select(page: Page) {
  await page.getByRole("region", { name: "Sites" }).getByRole("button", { name: SITE_ROW }).click();
  await expect(page.getByTestId("site-cursor")).toBeVisible();
}
const value = (scope: Locator, label: string) => scope.getByText(label, { exact: true }).locator("xpath=following-sibling::dd[1]").innerText();

test("Metrics shows the same numbers as the Timeline page for the same site", async ({ page, request }) => {
  test.setTimeout(300_000);
  const id = await gr001(request);
  await open(page);
  await select(page);
  await panelButton(page, "Metrics").click();

  const atlas: Record<string, { availability: string; longest: string; total: string; clearance: string; start: string }> = {};
  for (const [key, name] of [["sun_center", "Sun"], ["earth_center", "Earth"]] as const) {
    const card = page.getByRole("region", { name: `${name} metrics` });
    atlas[key] = {
      availability: (await page.getByTestId(`availability-${key}`).innerText()).trim(),
      longest: await value(card, "Longest hidden"),
      total: await value(card, "Total hidden"),
      clearance: await value(card, "Best clearance"),
      start: await value(card, "At the start"),
    };
  }

  await page.goto(`/runs/${id}/timeline/${SITE}`);
  for (const [key, name] of [["sun_center", "Sun"], ["earth_center", "Earth"]] as const) {
    const old = page.getByRole("region", { name: `${name} summary` });
    await expect(old).toBeVisible({ timeout: 60_000 });
    expect(await value(old, "Availability, terrain")).toContain(atlas[key].availability);
    expect(await value(old, "Longest known hidden")).toBe(atlas[key].longest);
    expect(await value(old, "Total known hidden")).toBe(atlas[key].total);
    expect(await value(old, "Best clearance over the skyline")).toBe(atlas[key].clearance);
    expect(await value(old, "At the start")).toBe(atlas[key].start);
  }
});

test("the Timeline panel draws the service's intervals, follows the clock, and seeks", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await select(page);
  await panelButton(page, "Timeline").click();
  const panel = page.getByRole("region", { name: "Timeline" });
  await expect(panel.getByRole("img", { name: /Visibility timeline for/ })).toBeVisible();
  await expect(panel.getByTestId("timeline-summary")).toContainText(/Sun above the terrain skyline for [\d.]+(–[\d.]+)?% of the window/);
  await expect(panel.getByText(/^BOTH$/)).toHaveCount(0);

  const cursorX = async () => Number(await panel.getByTestId("timeline-cursor").getAttribute("x1"));
  const x0 = await cursorX();
  await page.getByTestId("time-dock").getByRole("button", { name: "Next event" }).click();
  await expect.poll(cursorX).toBeGreaterThan(x0);

  // click inside the bars: the clock moves there
  const box = (await panel.getByTestId("timeline-svg").boundingBox())!;
  const before = await page.getByTestId("dock-elapsed").innerText();
  await page.mouse.click(box.x + box.width * 0.9, box.y + 30);
  await expect(page.getByTestId("dock-elapsed")).not.toHaveText(before);

  await panel.getByLabel("Compare to a flat horizon").check();
  await expect(panel.getByText("SUN FLAT")).toBeVisible();
  await panel.getByRole("button", { name: "Show as table" }).click();
  await expect(panel.getByRole("table", { name: /Sun intervals/ })).toBeVisible();
});

test("Clearance loads the skyline, draws the curves and prints the service's clearance", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await select(page);
  await panelButton(page, "Clearance").click();
  const panel = page.getByRole("region", { name: "Clearance" });
  await expect(panel.getByTestId("clearance-svg")).toBeVisible();
  await expect(panel.getByTestId("clearance-summary")).toContainText(/Sun: from [+−][\d.]+° to [+−][\d.]+° above the terrain skyline/);
  await expect(panel.getByRole("alert")).toHaveCount(0); // the skyline loaded
  expect(await panel.locator('path[stroke-dasharray="5 4"]').count()).toBeGreaterThan(0); // the skyline curves were drawn
  const x0 = Number(await panel.getByTestId("clearance-cursor").getAttribute("x1"));
  await page.getByTestId("time-dock").getByRole("button", { name: "Next event" }).click();
  await expect.poll(async () => Number(await panel.getByTestId("clearance-cursor").getAttribute("x1"))).toBeGreaterThan(x0);
});

test("Sky path shows the same position as the Selected site readout at the clock time", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await select(page);
  await page.getByTestId("time-dock").getByRole("button", { name: "Next event" }).click();
  await panelButton(page, "Sky path").click();
  const panel = page.getByRole("region", { name: "Sky path" });
  await expect(panel.getByTestId("sky-path")).toBeVisible({ timeout: 30_000 });
  const now = await panel.getByTestId("sky-path-now").innerText();
  const sun = now.match(/Sun at azimuth ([\d.]+)°, elevation ([+−][\d.]+)°/)!;
  const cursor = await page.getByTestId("site-cursor").innerText();
  expect(cursor).toContain(`AZ ${sun[1]}° · EL ${sun[2]}°`);
  await panel.getByRole("button", { name: "Polar (north up)" }).click();
  await expect(panel.getByRole("img", { name: /Sun and Earth over the terrain skyline/ })).toBeVisible();
});

test("Compare asks the service about the run's sites, shows its facts, and never ranks", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await panelButton(page, "Compare").click();
  const panel = page.getByRole("region", { name: "Compare" });
  await expect(panel.getByTestId("compare-facts")).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByText(/Sites are not ranked or scored/)).toBeVisible();
  await expect(panel.getByRole("region", { name: "Sun above the terrain skyline" }).getByRole("listitem").first()).toContainText(/Flat horizon would give/);
  // fewer than two sites asks for more, without calling the service
  const boxes = panel.getByRole("checkbox");
  const n = await boxes.count();
  for (let i = 1; i < n; i++) await boxes.nth(i).uncheck();
  await expect(panel.getByRole("alert")).toContainText("Choose at least two sites.");
});

test("a site panel with nothing to show says why, and the right-hand panels share one column", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await panelButton(page, "Metrics").click();
  await expect(page.getByRole("region", { name: "Metrics", exact: true })).toContainText("Select a site");
  await panelButton(page, "Clearance").click();
  await expect(page.getByTestId("right-panel")).toHaveAttribute("data-panel", "clearance");
  await expect(page.getByRole("region", { name: "Metrics", exact: true })).toHaveCount(0);

  // a site that is not in the run
  await page.getByRole("region", { name: "Sites" }).getByRole("button", { name: /^Shackleton/ }).click();
  await panelButton(page, "Metrics").click();
  await expect(page.getByRole("region", { name: "Metrics", exact: true })).toContainText(/is not in the loaded run/);
});

test("the Atlas with the timeline, metrics and compare passes axe", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await select(page);
  await panelButton(page, "Timeline").click();
  await panelButton(page, "Metrics").click();
  await expect(page.getByRole("region", { name: "Metrics", exact: true })).toBeVisible();
  const check = async () => {
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  };
  await check();
  await panelButton(page, "Compare").click();
  await expect(page.getByTestId("compare-facts")).toBeVisible({ timeout: 60_000 });
  await check();
  await panelButton(page, "Sky path").click();
  await expect(page.getByTestId("sky-path")).toBeVisible({ timeout: 30_000 });
  await check();
});
