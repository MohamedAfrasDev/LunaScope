// Starts the service in REPLAY mode on a throwaway copy of fallback/data (rehearsal use).
//   node scripts/serve-fallback.mjs <python> <stack>
import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
const [pyArg, stack = "synthetic"] = process.argv.slice(2);
const py = resolve(pyArg); // resolved against the repo root, before the child changes directory
if (!existsSync("fallback/data")) { console.error("fallback/data is missing: build the package first"); process.exit(2); }
rmSync("var/replay-rehearsal", { recursive: true, force: true });
cpSync("fallback/data", "var/replay-rehearsal", { recursive: true });
const child = spawn(py, ["-m", "uvicorn", "lunascope.main:create_app", "--factory", "--host", "127.0.0.1", "--port", "8000"], {
  stdio: "inherit", cwd: "science",
  env: { ...process.env, LUNASCOPE_STACK: stack, LUNASCOPE_MODE: "replay", LUNASCOPE_DATA_DIR: "../var/replay-rehearsal" },
});
child.on("exit", (c) => process.exit(c ?? 0));
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => child.kill());
