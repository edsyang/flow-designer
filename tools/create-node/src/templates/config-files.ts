export function generateTsconfig(): string {
  const config = {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      jsx: "react-jsx",
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      rootDir: "src",
      outDir: "dist",
      isolatedModules: true,
    },
    include: ["src"],
  };
  return JSON.stringify(config, null, 2) + "\n";
}

export function generateViteConfig(): string {
  return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    react(),
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => \`index.\${format === 'es' ? 'mjs' : 'cjs'}\`,
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'mobx',
        'mobx-react-lite',
        /^@flow-designer\\//,
        /^@antv\\//,
      ],
    },
    sourcemap: true,
    minify: false,
  },
})
`;
}

export function generateVitestConfig(): string {
  return `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
  },
});
`;
}
