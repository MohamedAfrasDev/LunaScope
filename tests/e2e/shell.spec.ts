import { expect, test, type APIRequestContext } from "@playwright/test";

/** Galaxy G4: the app shell. Side navigation on desktop, a sheet on phones, breadcrumbs, and recent runs kept in this browser. */
async function gr001(request: APIRequestContext): Promise<string> {
  const ref = await (await request.get("/api/v1/references/GR-001")).json();
  const run = await (await request.post("/api/v1/analyses", { data: ref.request })).json();
  return run.run_id as string;
}

test("desktop: side navigation, breadcrumbs, and a run you open is remembered", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const id = await gr001(request);
  await page.goto(`/runs/${id}/evidence`);
  await expect(page.getByRole("region", { name: /Result state/ }).first()).toBeVisible({ timeout: 240_000 });

  const main = page.getByRole("navigation", { name: "Main" });
  await expect(main.getByRole("link", { name: "New analysis" })).toBeVisible();
  const crumbs = page.getByRole("navigation", { name: "breadcrumb" });
  await expect(crumbs.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(crumbs.getByText("Evidence")).toHaveAttribute("aria-current", "page");

  // the run is now in the list, and survives a reload
  await expect(main.locator(`a[href="/runs/${id}"]`)).toBeVisible();
  await page.goto("/analyze");
  await expect(main.locator(`a[href="/runs/${id}"]`)).toBeVisible();
  await page.getByRole("button", { name: "Clear recent runs" }).click();
  await expect(main.locator(`a[href="/runs/${id}"]`)).toHaveCount(0);
});

test("phone: the navigation is a sheet that closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/analyze");
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0); // closed, not in the page
  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link", { name: "New analysis" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  // the data status stays in view on a phone too
  await expect(page.getByText(/Checking the science service|Synthetic demonstration data|Real data, unverified/).first()).toBeVisible();
});
