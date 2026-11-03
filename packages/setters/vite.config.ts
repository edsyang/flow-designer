import { copyFile } from "node:fs/promises";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    react(),
    dts({
      rollupTypes: true,
      afterBuild: async () => {
        await copyFile("dist/constants.d.ts", "dist/constants.d.cts");
      },
    }),
  ],
  build: {
    lib: {
      entry: { index: "src/index.ts", constants: "src/constants.ts" },
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
        /^antd/,
        /^@ant-design\//,
      ],
    },
    sourcemap: true,
    minify: false,
  },
});
