import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./__tests__/svg-polyfill.ts", "./__tests__/i18n-setup.ts"],
  },
});
