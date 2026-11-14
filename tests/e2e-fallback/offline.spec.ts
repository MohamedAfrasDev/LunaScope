import { expect, test } from "@playwright/test";

/**
 * Case 16 (spec 15.3): the fallback opens the demo. The service is in REPLAY mode on the packaged
 * runs; the page must say so, open GR-001 and the packaged Time Machine shift, and refuse (in plain
 * words) anything that would need computing. Nothing here may reach an external host.
 */
test("the fallback opens the demo and says it is a replay", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["localhost", "127.0.0.1"].includes(u.hostname) && !u.protocol.startsWith("data")) external.push(r.url());
  });

  await page.goto("/");
  await expect(page.getByText("Replay mode").first()).toBeVisible();
  await expect(page.getByText(/offline copy: it shows saved runs only/)).toBeVisible();

  await page.getByRole("button", { name: "Start the reference mission" }).click();
  await page.waitForURL(/\/runs\/[0-9a-f]{64}$/);
  await expect(page.getByRole("table").first()).toBeVisible({ timeout: 30_000 }); // no waiting: it is packaged
  await expect(page.getByText("Replay mode").first()).toBeVisible();

  await page.getByRole("link", { name: /Open the Time Machine/ }).click();
  await page.getByRole("button", { name: "Shift and recompute" }).click(); // 5 days: packaged
  await expect(page.getByText(/Shifted by \+5 d, compared in elapsed time/)).toBeVisible({ timeout: 30_000 });

  // an unpackaged shift is refused in plain words, not computed
  await page.getByLabel("Shift the start by (days)").fill("3");
  await page.getByRole("button", { name: "Shift and recompute" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "offline copy" })).toBeVisible();

  await page.goto(page.url().replace("time-machine", "evidence"));
  await expect(page.getByRole("heading", { name: "Validation cards" })).toBeVisible();
  expect(external, `requests to other hosts: ${external.join(", ")}`).toEqual([]);
});
