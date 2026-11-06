import { test, expect } from '@playwright/test';

async function waitForRunningApp(page) {
  await page.goto('./');
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__VEPA_DEBUG__?._active));
  await expect.poll(() => page.locator('#hud-tick').textContent()).toMatch(/\d[\d,]*\n\d+\.\d/);
}

test('built Pages payload boots under its project base path and runs an isolated worker tick', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await waitForRunningApp(page);
  const capabilities = await page.evaluate(() => ({
    isolated: crossOriginIsolated,
    shared: typeof SharedArrayBuffer === 'function',
    worker: typeof Worker === 'function',
    canvasWidth: document.querySelector('canvas')?.width ?? 0,
    canvasHeight: document.querySelector('canvas')?.height ?? 0,
  }));
  expect(capabilities).toMatchObject({ isolated: true, shared: true, worker: true });
  expect(capabilities.canvasWidth).toBeGreaterThan(0);
  expect(capabilities.canvasHeight).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('pages-desktop.png'), fullPage: true });
});

test('built application completes physics on the main thread when Worker is unavailable', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Worker', { configurable: true, value: undefined });
  });
  await waitForRunningApp(page);
  const result = await page.evaluate(() => ({
    workerUnavailable: typeof Worker === 'undefined',
    tickText: document.querySelector('#hud-tick')?.textContent ?? '',
    active: Boolean(window.__VEPA_DEBUG__?._active),
  }));
  expect(result.workerUnavailable).toBe(true);
  expect(result.active).toBe(true);
  expect(result.tickText).toMatch(/\d[\d,]*\n\d+\.\d/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pages-mobile.png'), fullPage: true });
});
