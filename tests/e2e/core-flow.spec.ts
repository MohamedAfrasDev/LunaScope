import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Core flow by keyboard only (AC-15, NFR-03) and test case 14 in the browser:
 * Home → reference mission → status matrix → Time Machine (5-day shift) → Evidence → export.
 * Every page on the way is checked with axe (WCAG 2 A and AA).
 */

/** Press Tab until `target` has focus; fails if it is not reachable by keyboard. */
async function tabTo(page: Page, target: Locator, max = 80) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`not reachable with Tab: ${target}`);
}

async function axe(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary, `axe violations on ${name}`).toEqual([]);
}

test("core flow is keyboard-complete and every page passes axe", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Reference GR-001/)).toBeVisible();
  await expect(page.getByText(/Synthetic demonstration data/).first()).toBeVisible(); // persistent label
  await axe(page, "home");

  const start = page.getByRole("button", { name: "Start the reference mission" });
  await tabTo(page, start);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/runs\/[0-9a-f]{64}$/);
  const runUrl = page.url();
  await expect(page.getByRole("table").first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("region", { name: /Synthetic demonstration/ }).first()).toBeVisible();
  await axe(page, "run");

  // Time Machine: shift five days, by keyboard
  await tabTo(page, page.getByRole("link", { name: /Open the Time Machine/ }));
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/time-machine$/);
  const days = page.getByLabel("Shift the start by (days)");
  await tabTo(page, days);
  await page.keyboard.press("Control+A");
  await page.keyboard.type("5");
  await page.keyboard.press("Enter"); // submits the form
  await expect(page.getByText(/Shifted by \+5 d, compared in elapsed time/)).toBeVisible({ timeout: 90_000 });

  // case 14: each panel on its own clock
  const base = page.getByRole("article", { name: "Baseline run" });
  const shifted = page.getByRole("article", { name: "Shifted run" });
  await expect(base.getByText("Starts 2027-01-10 00:00:00 UTC")).toBeVisible();
  await expect(shifted.getByText("Starts 2027-01-15 00:00:00 UTC")).toBeVisible();

  // alignment by keyboard: arrow keys move within the radio group
  await tabTo(page, page.getByRole("radio", { name: /Elapsed time/ }));
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: /Calendar time/ })).toBeChecked();
  await expect(page.getByText(/compared in calendar time/)).toBeVisible();
  await expect(page.getByText(/Shared window: 2027-01-15 00:00:00 UTC for 2 d/)).toBeVisible();
  await axe(page, "time machine");

  // Evidence: three cards and the investigative export
  await page.goto(runUrl);
  await tabTo(page, page.getByRole("link", { name: /Open the evidence/ }));
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/evidence$/);
  await expect(page.getByRole("heading", { name: "Validation cards" })).toBeVisible();
  for (const name of ["Sun and Earth geometry", "Terrain horizon", "Numerical convergence"])
    await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Disc size: centre or edge?" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Upper limb" }).first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Whole disc" }).first()).toBeVisible();
  const dl = page.getByRole("link", { name: /Download investigative bundle/ });
  await tabTo(page, dl);
  const [download] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
  expect(download.suggestedFilename()).toMatch(/investigative\.json$/);
  await axe(page, "evidence");
});

test("workspaces for one run pass axe and are reachable from the matrix", async ({ page, request }) => {
  const ref = await (await request.get("/api/v1/references/GR-001")).json();
  const run = await (await request.post("/api/v1/analyses", { data: ref.request })).json();
  await page.goto(`/runs/${run.run_id}`);
  await expect(page.getByRole("table").first()).toBeVisible({ timeout: 90_000 });

  await tabTo(page, page.getByRole("link", { name: "Timeline and evidence" }).first());
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/timeline\//);
  await expect(page.getByRole("img", { name: /requirement at least/ }).first()).toBeVisible();
  await axe(page, "timeline");

  await page.goto(`/runs/${run.run_id}`);
  await tabTo(page, page.getByRole("link", { name: "Local sky" }).first());
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/sky\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await axe(page, "local sky");

  await page.goto(`/runs/${run.run_id}`);
  await tabTo(page, page.getByRole("link", { name: /Compare these sites/ }));
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/compare$/);
  await expect(page.getByText(/Held constant/).first()).toBeVisible();
  await axe(page, "compare");

  await page.goto("/analyze");
  await expect(page.getByRole("button", { name: "Run analysis" })).toBeVisible();
  await axe(page, "new analysis");
});
