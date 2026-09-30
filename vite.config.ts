import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const web = resolve(import.meta.dirname, 'src/web')

export default defineConfig({
  root: 'src/web',
  plugins: [react()],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: { input: { main: resolve(web, 'index.html'), overlay: resolve(web, 'overlay.html') } },
  },
  server: { host: '127.0.0.1', port: 5173, proxy: { '/api': 'http://127.0.0.1:4317' } },
  test: { root: import.meta.dirname, include: ['test/**/*.test.ts'] },
})
