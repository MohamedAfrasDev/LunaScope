import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Atlas phase G: the run tools. Choose a run, start one, test dates, read the evidence, all without leaving the Atlas, and reach
 * the Atlas from the classic run pages.
 */
const TILE = readFileSync(join(process.cwd(), "public", "explore", "moon-2k.jpg"));

async function gr001(request: APIRequestContext): Promise<string> {
  const ref = await (await request.get("/api/v1/references/GR-001")).json();
  const run = await (await request.post("/api/v1/analyses", { data: ref.request })).json();
  return run.run_id as string;
}

async function open(page: Page, path = "/atlas") {
  await page.route("**/trek.nasa.gov/tiles/**", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: TILE }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(path);
  await expect(page.getByTestId("explore")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  await expect(page.getByTestId("dock-status")).toContainText("Paused", { timeout: 280_000 });
}

const panelButton = (page: Page, name: string) => page.getByRole("navigation", { name: "Atlas" }).getByRole("button", { name, exact: true });
const region = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

test("the run chip opens the Runs panel, which lists the reference missions and marks the open one", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await page.getByTestId("run-chip").click();
  const runs = region(page, "Runs");
  await expect(runs).toBeVisible();
  await expect(runs.getByRole("button", { name: /^GR-001/ })).toHaveAttribute("aria-current", "true");
  await expect(runs.getByRole("button", { name: /^GR-002/ })).toBeVisible();
  await expect(runs.getByRole("button", { name: /^GR-003/ })).toBeVisible();
  await expect(runs.getByText(/not landing recommendations/)).toBeVisible();
  await runs.getByLabel("Open a run by its id").fill("not an id");
  await runs.getByRole("button", { name: "Open", exact: true }).click();
  await expect(runs.getByRole("alert")).toContainText("64 characters");
});

test("choosing another reference loads it into the Atlas and puts it in the address", async ({ page }) => {
  test.setTimeout(420_000);
  await open(page);
  await page.getByTestId("run-chip").click();
  await region(page, "Runs").getByRole("button", { name: /^GR-002/ }).click();
  await expect(page.getByTestId("dock-status")).toContainText(/Loading the reference run|Paused/);
  await expect(page.getByTestId("run-chip")).toHaveText("Run GR-002", { timeout: 360_000 });
  await expect(page.getByTestId("dock-status")).toContainText("Paused");
  expect(page.url()).toContain("ref=GR-002");
  // a named place of that run now has results at the clock time
  const sites = region(page, "Sites");
  if (!(await sites.isVisible())) await panelButton(page, "Sites").click();
  await sites.getByRole("button", { name: /^Haworth/ }).click();
  await expect(page.getByTestId("site-cursor")).toBeVisible();
  // and the run is remembered on this device
  if (!(await region(page, "Runs").isVisible())) await page.getByTestId("run-chip").click();
  await expect(region(page, "Runs").getByRole("button", { name: /^GR-002/ })).toHaveAttribute("aria-current", "true");
  await expect(region(page, "Runs").getByText(/Opened on this device/)).toBeVisible();
});

test("an old run address opens the same run in the Atlas", async ({ page, request }) => {
  test.setTimeout(420_000);
  const id = await gr001(request);
  await page.goto(`/runs/${id}`);
  await page.waitForURL(/\/atlas\?run=/);
  await expect(page.getByTestId("dock-status")).toContainText("Paused", { timeout: 280_000 });
  await expect(page.getByTestId("run-chip")).toHaveText(`Run ${id.slice(0, 12)}`);
});

test("Evidence and Dates open inside the Atlas for the loaded run, with one h1", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await panelButton(page, "Evidence").click();
  const ev = region(page, "Evidence");
  await expect(ev.getByRole("heading", { name: "Validation cards" })).toBeVisible({ timeout: 60_000 });
  await expect(ev.getByRole("link", { name: /Download investigative bundle|investigative/ }).or(ev.getByRole("button", { name: /investigative/ })).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

  await panelButton(page, "Dates").click();
  const dates = region(page, "Dates");
  await expect(dates.getByRole("heading", { name: "Mission Time Machine" })).toBeVisible({ timeout: 60_000 });
  await expect(dates.getByLabel(/Shift the start by/)).toBeVisible();
  await expect(region(page, "Evidence")).toHaveCount(0); // one right-hand panel at a time
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});

test("Analyse this site opens the Analyse panel with that site filled in, and starting a run opens it in the Atlas", async ({ page }) => {
  test.setTimeout(480_000);
  await open(page);
  await region(page, "Sites").getByRole("button", { name: /^Haworth/ }).click();
  await region(page, "Selected site").getByRole("button", { name: "Analyse this site" }).click();
  const form = region(page, "Analyse");
  await expect(form).toBeVisible();
  await expect(form.getByRole("button", { name: /Run analysis/ })).toBeEnabled({ timeout: 30_000 });
  await expect(form.getByRole("checkbox", { name: /Haworth/ })).toBeChecked();
  // a short window keeps the run quick
  await form.getByLabel(/Duration \(days\)/).fill("1");
  await form.getByRole("button", { name: /Run analysis/ }).click();
  await expect(page.getByText("Run started. It opens here when it finishes.")).toBeVisible({ timeout: 30_000 });
  await expect(region(page, "Analyse")).toHaveCount(0);
  await expect(page.getByTestId("dock-status")).toContainText("Paused", { timeout: 420_000 });
  await expect(page.getByTestId("run-chip")).not.toHaveText("Run GR-001");
  expect(page.url()).toMatch(/run=[0-9a-f]{64}/);
  await region(page, "Selected site").waitFor();
  await expect(page.getByTestId("site-cursor")).toBeVisible(); // Haworth is in this run
});

test("the Atlas with the Runs, Evidence and Analyse panels passes axe", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  const check = async () => {
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  };
  await page.getByTestId("run-chip").click();
  await expect(region(page, "Runs")).toBeVisible();
  await check();
  await panelButton(page, "Evidence").click();
  await expect(region(page, "Evidence").getByRole("heading", { name: "Validation cards" })).toBeVisible({ timeout: 60_000 });
  await check();
  await panelButton(page, "Analyse").click();
  await expect(region(page, "Analyse").getByRole("button", { name: /Run analysis/ })).toBeVisible({ timeout: 30_000 });
  await check();
});
