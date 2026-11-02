import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ['source'],
  },
  optimizeDeps: {
    exclude: [
      '@flow-designer/model',
      '@flow-designer/core',
      '@flow-designer/skeleton',
      '@flow-designer/graph',
      '@flow-designer/plugins',
      '@flow-designer/setters',
      '@flow-designer/react',
      '@flow-designer/engine',
      '@flow-designer/bpmn-model',
      '@flow-designer/bpmn-nodes',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
