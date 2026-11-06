import { test, expect } from '@playwright/test';

test('Pages worker fails closed on unsupported laws and runs SIM shadow on the supported subset', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#sim-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__VEPA_DEBUG__?._active));
  await expect.poll(() => page.locator('#hud-tick').textContent()).toMatch(/\d[\d,]*\n\d+\.\d/);

  const result = await page.evaluate(async () => {
    const terminalStatus = async (wanted, timeoutMs = 8000) => {
      const deadline = performance.now() + timeoutMs;
      while (performance.now() < deadline) {
        const status = window.__VEPA_SIM_SHADOW_STATUS__;
        if (typeof status === 'string' && wanted.includes(status)) return status;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      return window.__VEPA_SIM_SHADOW_STATUS__ ?? 'timeout';
    };

    window.__VEPA_SIM_SHADOW__(true);
    const unsupportedStatus = await terminalStatus(['unsupported', 'ready', 'error']);
    if (unsupportedStatus !== 'unsupported') {
      return { unsupportedStatus, supportedStatus: 'not-tested', disabledLaws: [], remainingUnsupported: [] };
    }

    window.__VEPA_SIM_SHADOW__(false);
    const unsupportedNames = new Set(['LIFE', 'GLOW', 'REPRO', 'PHENOTYPE', 'GENOTYPE']);
    const disabledLaws = [];
    for (const button of document.querySelectorAll('#laws-panel .law-btn.active')) {
      const name = button.textContent.split('·')[0].trim();
      if (unsupportedNames.has(name)) {
        button.click();
        disabledLaws.push(name);
      }
    }

    const restart = document.querySelector('#restart-btn');
    restart.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    restart.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    const tickValue = () => Number((document.querySelector('#hud-tick')?.textContent || '').split('\n')[0].replace(/,/g, '')) || 0;
    const restartDeadline = performance.now() + 10000;
    while (tickValue() <= 0 && performance.now() < restartDeadline) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }

    const remainingUnsupported = [...document.querySelectorAll('#laws-panel .law-btn.active')]
      .map(button => button.textContent.split('·')[0].trim())
      .filter(name => unsupportedNames.has(name));
    const before = document.querySelector('#hud-tick')?.textContent || '';
    window.__VEPA_SIM_SHADOW__(true);
    const supportedStatus = await terminalStatus(['ready', 'unsupported', 'error']);
    const tick = document.querySelector('#hud-tick')?.textContent || '';
    return { unsupportedStatus, supportedStatus, disabledLaws, remainingUnsupported, before, tick };
  });

  expect(result.unsupportedStatus).toBe('unsupported');
  expect(result.disabledLaws.length).toBeGreaterThan(0);
  expect(result.remainingUnsupported).toEqual([]);
  expect(result.supportedStatus).toBe('ready');
  expect(result.tick).toMatch(/\d[\d,]*\n\d+\.\d/);
  expect(result.tick).not.toBe(result.before);
});
