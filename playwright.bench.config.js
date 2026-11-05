import { defineConfig, devices } from '@playwright/test';

// Renderer benchmark runner: separate from the e2e suite (testDir tests/e2e
// in playwright.config.js) so `npx playwright test` never runs benchmarks.
// Benchmarks force a single worker — parallel pages would contaminate timings.
export default defineConfig({
  testDir: './tests/bench',
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    // Chrome ≥137 blocks SwiftShader WebGL by default (--enable-unsafe-
    // swiftshader re-enables it), and the container's GPU-process sandbox
    // denies dlopen of libGLESv2.so (--disable-gpu-sandbox lifts that).
    // Together they give a real WebGL 2.0 context backed by ANGLE/SwiftShader
    // so the pixi backend engages its WebGL renderer, not pixi's Canvas
    // fallback (rendererType 4), which would invalidate the comparison.
    launchOptions: {
      args: [
        '--enable-unsafe-swiftshader',
        '--disable-gpu-sandbox',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--ignore-gpu-blocklist',
      ],
    },
  },
  webServer: {
    command: 'npm run dev -- --host 0.0.0.0 --port 4173',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
