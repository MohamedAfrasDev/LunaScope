import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Atlas phase D: the time dock. The reference run GR-001 (synthetic stack) is loaded, and the clock moves a cursor through it.
 * Every Sun and Earth value that follows the clock comes from the service's series and intervals.
 */
const TILE = readFileSync(join(process.cwd(), "public", "explore", "moon-2k.jpg"));

async function open(page: Page, path = "/atlas") {
  await page.route("**/trek.nasa.gov/tiles/**", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: TILE }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(path);
  await expect(page.getByTestId("explore")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  // the run is submitted, polled and its series fetched; the dock says Paused once it is ready
  await expect(page.getByTestId("dock-status")).toContainText("Paused", { timeout: 200_000 });
}

const readoutTime = (page: Page) => page.getByTestId("atlas-readout").getByText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/);
const elapsed = (page: Page) => page.getByTestId("dock-elapsed");

test("the reference run loads and the dock shows its window, the run and the data label", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  const dock = page.getByTestId("time-dock");
  await expect(page.getByTestId("run-chip")).toHaveText("Run GR-001");
  await expect(dock.locator('.atlas-tag[data-kind="synthetic"]')).toBeVisible();
  await expect(readoutTime(page)).toBeVisible();
  await expect(elapsed(page)).toHaveText("T+ 0 D 0 H");
  const slider = dock.getByRole("slider", { name: "Time (UTC)" });
  expect(Number(await slider.getAttribute("max"))).toBeGreaterThan(3600);
  await dock.getByRole("button", { name: "Go to time" }).click(); // the window, start to end, sits in the folded go-to row
  await expect(dock.getByText(/→/)).toBeVisible();
});

test("play moves the cursor, pause stops it, and the controls report their state", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  const dock = page.getByTestId("time-dock");
  await dock.getByRole("button", { name: "6 hours" }).click();
  await expect(dock.getByRole("button", { name: "6 hours" })).toHaveAttribute("aria-pressed", "true");
  await dock.getByRole("button", { name: "Play" }).click();
  await expect(page.getByTestId("dock-status")).toContainText("Playing · 6 hours per second");
  await expect(elapsed(page)).not.toHaveText("T+ 0 D 0 H", { timeout: 10_000 });
  await dock.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByTestId("dock-status")).toContainText("Paused");
  const stopped = await elapsed(page).innerText();
  await page.waitForTimeout(800);
  expect(await elapsed(page).innerText()).toBe(stopped);

  await dock.getByRole("button", { name: "Reverse" }).click();
  await expect(dock.getByRole("button", { name: "Reverse" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("dock-status")).toContainText("reverse");
  await dock.getByRole("button", { name: "Loop" }).click();
  await expect(dock.getByRole("button", { name: "Loop" })).toHaveAttribute("aria-pressed", "false");
});

test("a selected site shows where the Sun and Earth are at the clock time, from the service, and follows the clock", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await page.getByRole("region", { name: "Sites" }).getByRole("button", { name: /^-89\.5 deg, 0 E/ }).click();
  const cursor = page.getByTestId("site-cursor");
  await expect(cursor).toContainText("Sun");
  await expect(cursor).toContainText("Earth");
  await expect(cursor).toContainText(/AZ \d+\.\d° · EL [+−]\d+\.\d{2}°/);
  await expect(cursor).toContainText(/terrain-aware/);
  const before = await cursor.innerText();
  await page.getByTestId("time-dock").getByRole("button", { name: "Next event" }).click();
  await expect.poll(async () => cursor.innerText()).not.toBe(before);
});

test("a site that is not in the run says so instead of showing numbers", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await page.getByRole("region", { name: "Sites" }).getByRole("button", { name: /^Shackleton/ }).click();
  await expect(page.getByRole("region", { name: "Selected site" }).getByText(/not in the loaded run \(GR-001\)/)).toBeVisible();
  await expect(page.getByTestId("site-cursor")).toHaveCount(0);
});

test("Next and Previous event jump between the service's events, and say so at the end", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  const dock = page.getByTestId("time-dock");
  await dock.getByRole("button", { name: "Next event" }).click();
  await expect(elapsed(page)).not.toHaveText("T+ 0 D 0 H");
  const t1 = await readoutTime(page).innerText();
  await dock.getByRole("button", { name: "Next event" }).click();
  await expect.poll(async () => readoutTime(page).innerText()).not.toBe(t1);
  const t2 = await readoutTime(page).innerText();
  await dock.getByRole("button", { name: "Previous event" }).click();
  await expect.poll(async () => readoutTime(page).innerText()).toBe(t1);
  // the first event has nothing before it, and the dock says so
  await dock.getByRole("button", { name: "Previous event" }).click();
  await expect(dock.getByText("No event before this time in the window.")).toBeVisible();
  // keyboard: "." is next event
  await page.keyboard.press(".");
  await expect.poll(async () => readoutTime(page).innerText()).toBe(t2);
  // at the very end there is no next event, and the dock says so
  const slider = dock.getByRole("slider", { name: "Time (UTC)" });
  await slider.focus();
  await page.keyboard.press("End");
  await dock.getByRole("button", { name: "Next event" }).click();
  await expect(dock.getByText("No event before the end of the window.")).toBeVisible();
});

test("go to a UTC time inside the window moves the cursor; outside it, the dock refuses in words", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  const dock = page.getByTestId("time-dock");
  await dock.getByRole("button", { name: "Go to time" }).click(); // the row is folded away by default
  const field = dock.getByLabel("Go to (UTC)");
  const start = await field.inputValue(); // the cursor is at the start, so this is the window start
  const total = Number(await dock.getByRole("slider", { name: "Time (UTC)" }).getAttribute("max"));
  const off = Math.floor(total / 2 / 3600) * 3600; // whole hours, about halfway through the window
  const want = `T+ ${Math.floor(off / 86400)} D ${Math.floor((off % 86400) / 3600)} H`;
  const next = new Date(Date.parse(start + ":00Z") + off * 1000).toISOString().slice(0, 16);
  await field.fill(next);
  await dock.getByRole("button", { name: "Go", exact: true }).click();
  await expect(elapsed(page)).toHaveText(want);
  await field.fill("2035-01-01T00:00");
  await dock.getByRole("button", { name: "Go", exact: true }).click();
  await expect(dock.getByText(/outside the run window/)).toBeVisible();
  await expect(elapsed(page)).toHaveText(want); // unchanged
});

test("the scrubber and the keyboard move the cursor, and Space plays", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  const dock = page.getByTestId("time-dock");
  const slider = dock.getByRole("slider", { name: "Time (UTC)" });
  await slider.focus();
  await page.keyboard.press("End");
  await expect(elapsed(page)).not.toHaveText("T+ 0 D 0 H");
  await page.keyboard.press("Home");
  await expect(elapsed(page)).toHaveText("T+ 0 D 0 H");
  await page.mouse.click(5, 300); // focus leaves the controls
  await page.keyboard.press(" ");
  await expect(page.getByTestId("dock-status")).toContainText("Playing");
  await page.keyboard.press(" ");
  await expect(page.getByTestId("dock-status")).toContainText("Paused");
});

test("reduced motion: play is off and says why, while the scrubber and event buttons still work", async ({ page }) => {
  test.setTimeout(300_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const dock = page.getByTestId("time-dock");
  await expect(dock.getByRole("button", { name: "Play" })).toBeDisabled();
  await expect(dock.getByText(/Playback is off because your system asks for reduced motion/)).toBeVisible();
  await dock.getByRole("button", { name: "Next event" }).click();
  await expect(elapsed(page)).not.toHaveText("T+ 0 D 0 H");
});

test("?run= opens a given run", async ({ page, request }: { page: Page; request: APIRequestContext }) => {
  test.setTimeout(300_000);
  const ref = await (await request.get("/api/v1/references/GR-001")).json();
  const run = (await (await request.post("/api/v1/analyses", { data: ref.request })).json()) as { run_id: string };
  await open(page, `/atlas?run=${run.run_id}`);
  await expect(page.getByTestId("run-chip")).toHaveText(`Run ${run.run_id.slice(0, 12)}`);
});

test("the Atlas with the dock, a run and a selected site passes axe", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await page.getByRole("region", { name: "Sites" }).getByRole("button", { name: /^-89\.5 deg, 0 E/ }).click();
  await expect(page.getByTestId("site-cursor")).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});
