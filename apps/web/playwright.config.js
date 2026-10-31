import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8799",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build -- --mode development && npx wrangler dev --compatibility-date 2026-10-19 --port 8799",
    url: "http://127.0.0.1:8799/en",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
