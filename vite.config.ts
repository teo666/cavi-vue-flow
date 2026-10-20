import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ command }) => ({
  plugins: [vue()],
  // The demo page lives in demo/ (index.html there), the library in src/.
  root: 'demo',
  // Built, the demo is served by GitHub Pages at /cavi-vue-flow/ (the router
  // follows: createWebHistory(import.meta.env.BASE_URL)); in dev, at /.
  base: command === 'build' ? '/cavi-vue-flow/' : '/',
  // The project root, above demo/: src/ and node_modules.
  server: { fs: { allow: ['..'] } },
  // Pre-bundling `cavi` (or cavijs, with cavi inside) would move its JS away
  // from cavi_bg.wasm, which it finds next to itself (new URL(..., import.meta.url)).
  optimizeDeps: { exclude: ['cavi', 'cavijs'] },
  build: { outDir: '../dist', emptyOutDir: true },
  test: { root: '.', include: ['src/**/*.test.ts'], environment: 'node' },
}));
