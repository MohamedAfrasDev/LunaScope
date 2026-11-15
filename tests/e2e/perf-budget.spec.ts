import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Galaxy G10: a budget for what the interface costs. Measured on the production build (see docs/ui/GALAXY-PLAN.md,
 * Appendix K): JavaScript and image bytes transferred per page, and layout shift (CLS) while a page loads.
 * The byte budgets sit about 30 % above the measured values, so they catch a real regression and not noise.
 */
async function gr001(request: APIRequestContext): Promise<string> {
  const ref = await (await request.get("/api/v1/references/GR-001")).json();
  const run = await (await request.post("/api/v1/analyses", { data: ref.request })).json();
  return run.run_id as string;
}

const KB = 1024;

async function measure(page: Page, path: string, ready: () => Promise<unknown>) {
  let js = 0;
  let img = 0;
  page.on("requestfinished", async (req) => {
    const res = await req.response();
    const s = await req.sizes().catch(() => null);
    if (!res || !s) return;
    const bytes = s.responseBodySize + s.responseHeadersSize;
    const type = res.headers()["content-type"] ?? "";
    if (/javascript/.test(type)) js += bytes;
    else if (/image/.test(type)) img += bytes;
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { hadRecentInput: boolean; value: number }[]) if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    localStorage.setItem("lunascope.tour", "seen");
  });
  await page.goto(path, { waitUntil: "load" });
  await ready();
  await page.waitForTimeout(1500);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  return { js, img, cls };
}

const PAGES: { name: string; path: (id: string) => string; ready: (p: Page) => Promise<unknown>; jsKB: number }[] = [
  // the landing carries the Moon: three.js (loaded on demand) and the 458 KB surface picture. Measured on the production build: JS 430 KB, images 459 KB
  { name: "home", path: () => "/", ready: (p) => p.getByRole("heading", { level: 1 }).waitFor(), jsKB: 560 },
  // the Atlas carries CesiumJS (loaded on this route only). Measured on the production build: JS 1710 KB
  { name: "atlas", path: () => "/atlas", ready: (p) => p.getByTestId("explore").waitFor(), jsKB: 2200 },
];

for (const [label, width, height] of [["desktop", 1440, 900], ["phone", 375, 812]] as const) {
  test(`budget: JavaScript, images and layout shift, ${label}`, async ({ browser, request }) => {
    test.setTimeout(240_000);
    const id = await gr001(request);
    const over: string[] = [];
    for (const pg of PAGES) {
      const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      const m = await measure(page, pg.path(id), () => pg.ready(page));
      if (m.js > pg.jsKB * KB) over.push(`${pg.name}: JS ${Math.round(m.js / KB)} KB > ${pg.jsKB} KB`);
      if (m.cls > 0.1) over.push(`${pg.name}: layout shift ${m.cls.toFixed(3)} > 0.1`);
      if (pg.name === "home" && m.img > 600 * KB) over.push(`home: images ${Math.round(m.img / KB)} KB > 600 KB`);
      await ctx.close();
    }
    expect(over, label).toEqual([]);
  });
}
