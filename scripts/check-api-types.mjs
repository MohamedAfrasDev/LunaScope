// Fails when lib/api/generated.ts is stale relative to docs/openapi.json (run in CI and before commit).
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "api-types-"));
const out = join(dir, "generated.ts");
execFileSync("npx", ["openapi-typescript", "docs/openapi.json", "-o", out], { stdio: "ignore", shell: true });
const norm = (s) => s.replace(/\r\n/g, "\n");
if (norm(readFileSync(out, "utf8")) !== norm(readFileSync("lib/api/generated.ts", "utf8"))) {
  console.error("lib/api/generated.ts is STALE: run `npm run gen:api`");
  process.exit(1);
}
console.log("lib/api/generated.ts is current");
