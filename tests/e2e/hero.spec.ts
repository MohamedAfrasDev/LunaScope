import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Galaxy G8: the hero picture is optimised, labelled, behind the text, and Home stays accessible in both themes. */
for (const scheme of ["dark", "light"] as const) {
  test(`home with the hero image passes axe in the ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/Background: illustration only/)).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}

test("the picture is served small and modern, and does not push the page sideways", async ({ page }) => {
  const sizes: { url: string; bytes: number; type: string }[] = [];
  page.on("response", async (r) => {
    if (r.url().includes("/_next/image")) {
      const b = await r.body().catch(() => Buffer.alloc(0));
      sizes.push({ url: r.url(), bytes: b.length, type: r.headers()["content-type"] ?? "" });
    }
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });
  expect(sizes.length).toBeGreaterThan(0);
  for (const s of sizes) {
    expect(s.bytes, s.url).toBeLessThan(450 * 1024); // never the 22.7 MB original
    expect(s.type).toMatch(/avif|webp|jpeg/);
  }
  for (const w of [320, 768, 1440]) {
    await page.setViewportSize({ width: w, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
  }
});
