import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The 3D sky view (three.js, loaded on demand): it draws frames, answers the time player, has words for what it
 * shows, passes axe, and does not make the page scroll sideways on a phone.
 */
async function open3d(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start the reference mission" }).click();
  await page.waitForURL(/\/runs\/[0-9a-f]{64}$/);
  const skyLink = page.getByRole("link", { name: "Local sky" }).first(); // a table on a desktop, cards on a phone
  await expect(skyLink).toBeVisible({ timeout: 90_000 });
  const sky = await skyLink.getAttribute("href");
  await page.goto(sky!);
  await page.getByRole("radio", { name: "3D (look around)" }).check();
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
}

const frames = (page: import("@playwright/test").Page) =>
  page.locator("[data-frames]").first().evaluate((el) => Number(el.getAttribute("data-frames")));

test("the 3D view draws, follows the time player, and is described in words", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await open3d(page);
  await expect.poll(() => frames(page), { timeout: 20_000 }).toBeGreaterThan(0);

  // it is described in words, state included
  await expect(page.getByRole("list", { name: "Where the Sun and Earth are at the cursor" })).toContainText(/Sun.*azimuth.*elevation/);
  await expect(page.getByRole("group", { name: /^3D sky from .* at .* UTC: Sun at azimuth/ })).toBeVisible();

  // the time player moves it: the words and a new frame follow the cursor
  const before = await frames(page);
  const textBefore = await page.getByRole("list", { name: "Where the Sun and Earth are at the cursor" }).innerText();
  await page.getByRole("button", { name: "Next event" }).click();
  await expect.poll(async () => await page.getByRole("list", { name: "Where the Sun and Earth are at the cursor" }).innerText()).not.toBe(textBefore);
  await expect.poll(() => frames(page)).toBeGreaterThan(before);

  // the view controls are real buttons; the camera responds
  const f1 = await frames(page);
  await page.getByRole("button", { name: "Face south" }).click();
  await expect.poll(() => frames(page)).toBeGreaterThan(f1);
  await page.getByRole("button", { name: "From outside" }).click();
  await expect(page.getByRole("button", { name: "From outside" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Exaggerate heights ×3" }).click();
  await expect(page.getByText(/exaggerated ×3 for legibility/).first()).toBeVisible();

  expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
});

test("the 3D view passes axe and the keyboard turns it", async ({ page }) => {
  await open3d(page);
  await expect.poll(() => frames(page), { timeout: 20_000 }).toBeGreaterThan(0);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  const f = await frames(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => frames(page)).toBeGreaterThan(f);
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("the 3D view fits a phone without sideways scroll", async ({ page }) => {
    await open3d(page);
    await expect.poll(() => frames(page), { timeout: 20_000 }).toBeGreaterThan(0);
    const m = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, w: window.innerWidth }));
    expect(m.scrollW).toBeLessThanOrEqual(m.w + 1);
    const box = await page.locator("canvas").boundingBox();
    expect(box!.width).toBeLessThanOrEqual(m.w);
    expect(box!.width).toBeGreaterThan(200);
  });
});
