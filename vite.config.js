import { defineConfig } from 'vite';

export default defineConfig({
  // Hosted root deployments (Freebuff/Vercel) use `/`; GitHub Pages passes
  // VITE_BASE=/vepa/ for its project-site subpath. Keeping `/` as the safe
  // default prevents production assets from being requested below a missing
  // /vepa/vepar/ prefix when the host does not set VERCEL explicitly.
  base: process.env.VITE_BASE || '/',
  root: '.',
  build: {
    outDir: 'dist',
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
