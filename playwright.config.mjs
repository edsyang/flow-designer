import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.{ts,mjs}',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5179',
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
});
