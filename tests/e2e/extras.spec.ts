import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Phase 3 features in a real browser, on the synthetic stack: explainer, guided/technical, date search. */
async function axe(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary, `axe violations on ${name}`).toEqual([]);
}

async function gr001(request: import("@playwright/test").APIRequestContext): Promise<string> {
  const ref = await (await request.get("/api/v1/references/GR-001")).json();
  const run = await (await request.post("/api/v1/analyses", { data: ref.request })).json();
  return run.run_id as string;
}

test("the explainer is one click from Home and passes axe", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Why the south pole is hard" }).first().click();
  await page.waitForURL(/why-the-south-pole-is-hard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Why the south pole is hard" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Schematic/ })).toBeVisible();
  await expect(page.getByText(/not to scale and not computed from data/)).toBeVisible();
  await axe(page, "explainer");
});

test("guided and technical views, and the sensitivity panel", async ({ page, request }) => {
  test.setTimeout(300_000);
  const id = await gr001(request);
  await page.goto(`/runs/${id}`);
  await expect(page.getByRole("table").first()).toBeVisible({ timeout: 240_000 });
  await page.goto(`/runs/${id}/timeline/rule-89.5S-E0`);

  const sun = page.getByRole("region", { name: "Sun summary" });
  await expect(page.getByRole("button", { name: "Guided" })).toHaveAttribute("aria-pressed", "true"); // the default
  await expect(sun.getByText("In plain words")).toBeVisible();
  await axe(page, "timeline, guided");

  await page.getByRole("button", { name: "Technical" }).click();
  await expect(sun.getByText("Facts from the service")).toBeVisible();
  await expect(sun.getByText("In plain words")).toHaveCount(0);
  await page.reload(); // the choice is remembered
  await expect(page.getByRole("button", { name: "Technical" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Guided" }).click();

  const sens = page.getByRole("region", { name: "Sensitivity" });
  await expect(sens.getByRole("heading", { name: /Half the azimuth step/ })).toBeVisible(); // GR-001 asks for sensitivity checks
  await expect(sens.getByText(/Within tolerance|Result changes beyond tolerance/).first()).toBeVisible();
  await axe(page, "timeline, sensitivity");
});

test("which dates pass: a three-date search fills the strip and opens a comparison", async ({ page, request }) => {
  test.setTimeout(420_000);
  const id = await gr001(request);
  await page.goto(`/runs/${id}`);
  await expect(page.getByRole("table").first()).toBeVisible({ timeout: 240_000 });
  await page.goto(`/runs/${id}/time-machine`);

  await page.getByLabel("From (days)").fill("-1");
  await page.getByLabel("To (days)").fill("1");
  await page.getByRole("button", { name: "Test 3 dates" }).click();
  await expect(page.getByText(/3 of 3\s+dates tested/)).toBeVisible({ timeout: 360_000 });
  const strip = page.getByRole("list", { name: "Tested dates" });
  await expect(strip.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText(/Objective, stated:/)).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(/\b(best date|winner|recommended)\b/i);

  await page.getByText("View the tested dates as a table").click();
  await page.getByRole("button", { name: "Compare" }).first().click();
  await expect(page.getByText(/compared in elapsed time/)).toBeVisible({ timeout: 60_000 });
  await axe(page, "time machine with the strip");
});
