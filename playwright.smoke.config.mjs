import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "i18n-regression.spec.ts",
    "edge-edit-persistence.spec.ts",
    "edge-name-inspector.spec.ts",
    "multi-instance.spec.ts",
  ],
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5179",
    channel: process.env.PLAYWRIGHT_CHANNEL,
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    { command: "pnpm dev:e2e:bpmn --strictPort", url: "http://127.0.0.1:5179" },
    { command: "pnpm dev:e2e:comfyui --strictPort", url: "http://127.0.0.1:5180" },
    { command: "pnpm dev:e2e:er --strictPort", url: "http://127.0.0.1:5181" },
  ].map((server) => ({ ...server, reuseExistingServer: !process.env.CI, timeout: 60000 })),
});
