import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [react(), dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        i18n: "src/i18n.ts",
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) => `${entryName}.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "mobx",
        "mobx-react-lite",
        /^@flow-designer\//,
        /^@antv\//,
      ],
    },
    sourcemap: true,
    minify: false,
  },
});
