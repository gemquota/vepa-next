import { defineConfig } from 'vite';

export default defineConfig({
  // Vercel builds serve at the root (VERCEL=1); GitHub Pages serves the
  // project page at /vepa/ (the Pages workflow passes VITE_BASE=/vepa/);
  // local dev/preview default to /vepa/vepar/ for the vepa4 launcher.
  base: process.env.VERCEL === '1' ? '/' : (process.env.VITE_BASE || '/vepa/vepar/'),
  root: '.',
  build: {
    outDir: '.dist',
    crossorigin: false,
    rollupOptions: {
      input: './index.html',
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    host: true,
  },
  worker: {
    format: 'es',
  },
});
