import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: { index: "src/index.ts", react: "src/react.tsx" },
      formats: ["es", "cjs"],
      fileName: (format, name) => `${name}.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: { external: ["i18next", "react", "react/jsx-runtime"] },
    sourcemap: true,
    minify: false,
  },
});
