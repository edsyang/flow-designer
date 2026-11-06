import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: { index: "src/index.ts", definitions: "src/definitions.ts" },
      formats: ["es", "cjs"],
      fileName: (format, name) => `${name}.${format === "es" ? "mjs" : "cjs"}`,
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
