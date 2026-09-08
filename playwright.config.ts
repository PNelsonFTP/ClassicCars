import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.MUSCLESCOUT_E2E_URL || "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "npm run dev:web",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: "node --import tsx scripts/e2e-api.ts",
      url: "http://127.0.0.1:4411/health",
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
