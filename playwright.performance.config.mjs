import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'performance.spec.ts', timeout: 180000, preserveOutput: 'always',
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? process.env.PERF_BASE_URL ?? 'http://127.0.0.1:5179', channel: process.env.PLAYWRIGHT_CHANNEL ?? process.env.PERF_BROWSER_CHANNEL ?? 'chrome', headless: true, viewport: { width: 1440, height: 900 } },
});
