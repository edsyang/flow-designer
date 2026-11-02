import { defineConfig } from 'vite'
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
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'mobx',
        'mobx-react-lite',
        /^@flow-designer\//,
        /^@antv\//,
        /^antd/,
        /^@ant-design\//,
      ],
    },
    sourcemap: true,
    minify: false,
  },
})
