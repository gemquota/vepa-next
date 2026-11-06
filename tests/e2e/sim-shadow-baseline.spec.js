import { test, expect } from '@playwright/test';

test('built Pages worker enables the opt-in SIM shadow while product ticks continue', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#sim-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__VEPA_DEBUG__?._active));
  await expect.poll(() => page.locator('#hud-tick').textContent()).toMatch(/\d[\d,]*\n\d+\.\d/);

  const result = await page.evaluate(async () => {
    const deadline = performance.now() + 6000;
    while (typeof window.__VEPA_SIM_SHADOW__ !== 'function' && performance.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    if (typeof window.__VEPA_SIM_SHADOW__ !== 'function') return { status: 'missing' };

    const before = document.querySelector('#hud-tick')?.textContent || '';
    window.__VEPA_SIM_SHADOW__(true);
    while (performance.now() < deadline) {
      const status = window.__VEPA_SIM_SHADOW_STATUS__;
      const tick = document.querySelector('#hud-tick')?.textContent || '';
      if (status === 'ready' || status === 'unsupported' || status === 'error') {
        return { status, before, tick };
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return {
      status: window.__VEPA_SIM_SHADOW_STATUS__ ?? 'timeout',
      before,
      tick: document.querySelector('#hud-tick')?.textContent || '',
    };
  });

  expect(result.status).toBe('ready');
  expect(result.tick).toMatch(/\d[\d,]*\n\d+\.\d/);
  expect(result.tick).not.toBe(result.before);
});
