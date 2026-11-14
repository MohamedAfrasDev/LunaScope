// Smoke test for a running LunaScope deployment, through the web app (so it exercises the BFF and
// the service together). Usage:
//   node scripts/smoke.mjs [baseUrl] [--mode live|replay] [--stack synthetic|live] [--timeout 300]
// Exit code 0 only if every step passed. Nothing here needs the service token: the BFF adds it.
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const base = (args.find((a) => /^https?:/.test(a)) ?? "http://localhost:3000").replace(/\/+$/, "");
const wantMode = flag("mode", null);
const wantStack = flag("stack", null);
const timeoutS = Number(flag("timeout", "300"));

const results = [];
async function step(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, ms: Date.now() - t0, detail });
    console.log(`PASS ${name} (${Date.now() - t0} ms)${detail ? `: ${detail}` : ""}`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, detail: String(e.message ?? e) });
    console.log(`FAIL ${name}: ${e.message ?? e}`);
    return false;
  }
  return true;
}
const get = async (p, init) => { const r = await fetch(base + p, { cache: "no-store", ...init }); return r; };
const json = async (p, init) => { const r = await get(p, init); const b = await r.json().catch(() => null); return { r, b }; };
const need = (c, m) => { if (!c) throw new Error(m); };

let runId = null;
let health = null;
await step("web home loads", async () => { const r = await get("/"); need(r.ok, `status ${r.status}`); });
await step("service health through the BFF", async () => {
  const { r, b } = await json("/api/v1/health"); need(r.ok, `status ${r.status}`); health = b;
  need(b.status === "ok", "status is not ok");
  if (wantMode) need(b.mode === wantMode, `mode is ${b.mode}, expected ${wantMode}`);
  if (wantStack) need(b.stack === wantStack, `stack is ${b.stack}, expected ${wantStack}`);
  return `${b.stack}/${b.mode}, ${b.result_state}, resources_ok=${b.resources_ok}`;
});
let ref = null;
await step("reference definition GR-001", async () => {
  const { r, b } = await json("/api/v1/references/GR-001"); need(r.ok, `status ${r.status}`); ref = b;
  return `${b.status}, ${b.request.sites.length} sites`;
});
if (ref) {
  await step("reference run is available or admitted", async () => {
    const { r, b } = await json("/api/v1/analyses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ref.request) });
    if (health?.mode === "replay") need(r.status === 200, `replay mode does not hold GR-001 (status ${r.status}, ${b?.error?.code})`);
    else need(r.status === 200 || r.status === 202, `status ${r.status} ${b?.error?.code ?? ""}`);
    runId = b.run_id; return `${runId.slice(0, 12)} (${r.status})`;
  });
}
if (runId) {
  await step("run completes", async () => {
    const t0 = Date.now();
    for (;;) {
      const { b } = await json(`/api/v1/analyses/${runId}`);
      if (b.status === "complete" || b.status === "complete_with_warnings") return `${b.status} after ${Math.round((Date.now() - t0) / 1000)} s`;
      need(b.status !== "failed", `failed: ${b.error?.code} ${b.error?.message}`);
      need((Date.now() - t0) / 1000 < timeoutS, `still ${b.status} after ${timeoutS} s`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  });
  await step("results are labelled and cacheable", async () => {
    const r = await get(`/api/v1/analyses/${runId}/results`); need(r.ok, `status ${r.status}`);
    const b = await r.json(); need(b.result_state !== "validated", "a result claims to be validated");
    const tag = r.headers.get("etag"); need(tag && /immutable/.test(r.headers.get("cache-control") ?? ""), "no immutable ETag");
    const again = await get(`/api/v1/analyses/${runId}/results`, { headers: { "if-none-match": tag } });
    need(again.status === 304, `revalidation gave ${again.status}`);
    return `${b.result_state}, 304 on If-None-Match`;
  });
  await step("evidence export is investigative and its hash matches", async () => {
    const r = await get(`/api/v1/analyses/${runId}/export`); need(r.ok, `status ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const { createHash } = await import("node:crypto");
    need(createHash("sha256").update(buf).digest("hex") === r.headers.get("x-content-sha256"), "hash header does not match the bytes");
    need(r.headers.get("x-bundle-kind") === "investigative", "bundle is not investigative");
    const v = await get(`/api/v1/analyses/${runId}/export?verified=true`);
    need(v.status === 409, `a verified export was not refused (${v.status})`);
    return `${(buf.length / 1024).toFixed(0)} KB`;
  });
  for (const page of [`/runs/${runId}`, `/runs/${runId}/evidence`, `/runs/${runId}/time-machine`])
    await step(`page ${page.replace(runId, "{run}")}`, async () => { const r = await get(page); need(r.ok, `status ${r.status}`); });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
process.exit(failed.length ? 1 : 0);
