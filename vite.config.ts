import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // The demo page lives in demo/ (index.html there), the library in src/.
  root: 'demo',
  server: {
    // cavijs is linked from ../cavijs, and cavi from its node_modules —
    // or from ../cavi/pkg, while cavijs is linked to a local engine build.
    fs: { allow: ['..', '../../cavijs', '../../cavi'] },
  },
  // Pre-bundling `cavi` would move its JS away from cavi_bg.wasm, which it
  // finds next to itself (new URL(..., import.meta.url)).
  optimizeDeps: { exclude: ['cavi', 'cavijs'] },
  build: { outDir: '../dist', emptyOutDir: true },
  test: { root: '.', include: ['src/**/*.test.ts'], environment: 'node' },
});
