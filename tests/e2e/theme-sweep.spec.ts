import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Galaxy G10: axe (WCAG 2.0/2.1 A and AA) on every route, in the dark and the light theme, on a desktop and a phone,
 * including the 3D sky, the open command palette, the open term popover, the tour and the 404.
 */
async function gr001(request: APIRequestContext): Promise<string> {
  const ref = await (await request.get("/api/v1/references/GR-001")).json();
  const run = await (await request.post("/api/v1/analyses", { data: ref.request })).json();
  return run.run_id as string;
}

async function axe(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")}`);
}

for (const scheme of ["dark", "light"] as const) {
  for (const [name, width, height] of [["desktop", 1440, 900], ["phone", 375, 812]] as const) {
    test(`axe: every route, ${scheme} theme, ${name}`, async ({ page, request }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "no-preference" });
      const id = await gr001(request);
      const site = "rule-89.5S-E0";
      const found: string[] = [];

      const visit = async (path: string, ready: () => Promise<unknown>, label: string) => {
        await page.goto(path);
        await ready();
        found.push(...(await axe(page, `${label} [${scheme}/${name}]`)));
      };

      await visit("/", () => page.getByRole("heading", { level: 1 }).waitFor(), "home");
      await visit("/analyze", () => page.getByRole("heading", { level: 1, name: "New analysis" }).waitFor(), "analyze");
      await visit("/why-the-south-pole-is-hard", () => page.getByRole("heading", { level: 1 }).waitFor(), "explainer");
      await visit("/no-such-page", () => page.getByRole("heading", { level: 1, name: "This page is not here" }).waitFor(), "404");
      await visit(`/runs/${id}`, () => page.getByRole("region", { name: /Result state/ }).first().waitFor({ timeout: 240_000 }), "run");
      await visit(`/runs/${id}/timeline/${site}`, () => page.getByRole("heading", { level: 1 }).waitFor(), "timeline");
      await visit(`/runs/${id}/compare`, () => page.getByRole("heading", { level: 1 }).waitFor(), "compare");
      await visit(`/runs/${id}/time-machine`, () => page.getByRole("heading", { level: 1 }).waitFor(), "time machine");
      await visit(`/runs/${id}/evidence`, () => page.getByRole("heading", { name: "Validation cards" }).waitFor(), "evidence");

      // the sky in its three views
      await visit(`/runs/${id}/sky/${site}`, () => page.getByRole("radio", { name: /Polar/ }).waitFor(), "sky polar");
      for (const [view, label] of [[/Unrolled/, "sky unrolled"], [/3D/, "sky 3d"]] as const) {
        await page.getByRole("radio", { name: view }).check();
        await page.waitForTimeout(1500);
        found.push(...(await axe(page, `${label} [${scheme}/${name}]`)));
      }

      // overlays: a term popover, the tour, the palette
      await page.goto(`/runs/${id}`);
      await page.getByRole("region", { name: /Result state/ }).first().waitFor({ timeout: 240_000 });
      await page.getByRole("button", { name: "Flat horizon", exact: true }).click();
      await page.getByText(/What a level horizon would say/).waitFor();
      found.push(...(await axe(page, `term popover [${scheme}/${name}]`)));
      await page.keyboard.press("Escape");
      const offer = page.getByRole("region", { name: "Page tour offer" });
      if (await offer.isVisible()) {
        await offer.getByRole("button", { name: "Take the tour" }).click();
        await page.getByRole("region", { name: "Page tour" }).waitFor();
        found.push(...(await axe(page, `tour [${scheme}/${name}]`)));
        await page.keyboard.press("Escape");
      }
      await expect(async () => {
        await page.getByRole("button", { name: /Search/ }).click();
        await page.getByRole("dialog", { name: "Search LunaScope" }).waitFor({ timeout: 1500 });
      }).toPass();
      found.push(...(await axe(page, `palette [${scheme}/${name}]`)));

      expect(found).toEqual([]);
    });
  }
}
