import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";

/** Galaxy G7: the key terms and the one-time page tour, on a real finished run. */
async function gr001(request: APIRequestContext): Promise<string> {
  const ref = await (await request.get("/api/v1/references/GR-001")).json();
  const run = await (await request.post("/api/v1/analyses", { data: ref.request })).json();
  return run.run_id as string;
}

test("terms open from the keyboard; the tour is offered once, walks the page, and is not forced on anyone", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const id = await gr001(request);
  await page.goto(`/runs/${id}`);
  await expect(page.getByRole("region", { name: /Result state/ }).first()).toBeVisible({ timeout: 240_000 });

  // a term: a button with its meaning one press away, closed by Escape
  const term = page.getByRole("button", { name: "Flat horizon", exact: true });
  await term.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/What a level horizon would say/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByText(/What a level horizon would say/)).toHaveCount(0);

  // the tour: offered, started, five steps, finished
  const offer = page.getByRole("region", { name: "Page tour offer" });
  await expect(offer).toBeVisible();
  await offer.getByRole("button", { name: "Take the tour" }).click();
  const tour = page.getByRole("region", { name: "Page tour" });
  await expect(tour).toContainText("Step 1 of 5");
  await expect(page.locator("[data-tour-active]")).toHaveCount(1);
  const tourAxe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(tourAxe.violations.map((v) => v.id)).toEqual([]);
  for (let i = 0; i < 4; i++) await tour.getByRole("button", { name: "Next" }).click();
  await expect(tour).toContainText("Step 5 of 5");
  await tour.getByRole("button", { name: "Done" }).click();
  await expect(tour).toHaveCount(0);
  await expect(page.locator("[data-tour-active]")).toHaveCount(0);

  // never offered again, but available from the palette
  await page.reload();
  await expect(page.getByRole("region", { name: /Result state/ }).first()).toBeVisible({ timeout: 240_000 });
  await expect(page.getByRole("region", { name: "Page tour offer" })).toHaveCount(0);
  // the shortcut works once the page has hydrated; retry until the dialog is there
  await expect(async () => {
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Search LunaScope" })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.keyboard.type("tour");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Page tour" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Page tour" })).toHaveCount(0);
});

test("the explainer lists the key terms", async ({ page }) => {
  await page.goto("/why-the-south-pole-is-hard#key-terms");
  await expect(page.getByRole("heading", { level: 2, name: "Key terms" })).toBeVisible();
  await expect(page.getByText("Terrain-aware", { exact: true })).toBeVisible();
});
