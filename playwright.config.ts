import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:3000",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath:
        process.env.CHROME_BIN ||
        (existsSync("/usr/bin/google-chrome")
          ? "/usr/bin/google-chrome"
          : undefined),
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    extraHTTPHeaders: { "x-demo-test": "true" },
  },
});
