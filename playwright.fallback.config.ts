import { defineConfig, devices } from "@playwright/test";

/**
 * Case 16: with the network off, the fallback opens the demo. Runs the service in REPLAY mode on a
 * COPY of ./fallback/data (the service writes SQLite files; the package itself is never touched).
 * Build the package first: science/.venv/Scripts/python science/scripts/build_fallback.py build
 * Use a stopped normal service: this config needs port 8000 for itself.
 */
const PY = process.env.LUNASCOPE_PYTHON ?? (process.platform === "win32" ? "science/.venv/Scripts/python.exe" : "science/.venv/bin/python");
const STACK = process.env.LUNASCOPE_FALLBACK_STACK ?? "synthetic";

export default defineConfig({
  testDir: "tests/e2e-fallback",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `node scripts/serve-fallback.mjs "${PY}" ${STACK}`,
      url: "http://127.0.0.1:8000/api/v1/health",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    { command: "npm run dev -- --port 3000", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
  ],
});
