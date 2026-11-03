export function generatePackageJson(name: string): string {
  const pkg = {
    name,
    version: "0.1.0",
    type: "module",
    main: "./dist/index.cjs",
    module: "./dist/index.mjs",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.mjs",
        require: "./dist/index.cjs",
      },
    },
    files: ["dist"],
    sideEffects: false,
    scripts: {
      build: "vite build",
      test: "vitest run",
      lint: "eslint src/",
    },
    peerDependencies: {
      "@flow-designer/model": "^0.1.0",
      "@flow-designer/setters": "^0.1.0",
      react: "^18.3.1",
    },
    devDependencies: {
      vite: "^5.4.0",
      "@vitejs/plugin-react": "^4.3.0",
      "vite-plugin-dts": "^4.0.0",
      vitest: "^2.1.0",
      typescript: "^5.5.0",
    },
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}
