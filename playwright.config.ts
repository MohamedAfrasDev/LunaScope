import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end core flow and axe checks (phase plan 2.3, spec 14: "Playwright, on mock and real
 * providers"). Runs against the SYNTHETIC science stack: offline, fast, and every result it shows is
 * labelled as demonstration data. Reuses servers already running on the same ports.
 */
const PY = process.env.LUNASCOPE_PYTHON ?? (process.platform === "win32" ? "science/.venv/Scripts/python.exe" : "science/.venv/bin/python");

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `"${PY}" -m uvicorn lunascope.main:create_app --factory --host 127.0.0.1 --port 8000`,
      url: "http://127.0.0.1:8000/api/v1/health",
      env: { LUNASCOPE_STACK: "synthetic", LUNASCOPE_DATA_DIR: "var/e2e" },
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm run dev -- --port 3000",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
