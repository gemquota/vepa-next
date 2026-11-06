import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['pages-baseline.spec.js', 'physics-worker.spec.js'],
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/vepa-next/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/vepa-next/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
