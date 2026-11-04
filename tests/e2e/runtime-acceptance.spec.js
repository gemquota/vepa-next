import { test, expect } from '@playwright/test';

async function openRuntime(page) {
  await page.goto('./');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 });
  // Canvas visibility only proves the shell HTML rendered; the law grid and
  // HUD are mounted by initUI after the module bundle boots.
  await page.waitForFunction(() => Boolean(window.__VEPA_DEBUG__?._active), null, { timeout: 30_000 });
}

test.describe('VEPA browser acceptance boundary', () => {
  test('boots the real application with cross-origin isolation', async ({ page }) => {
    await openRuntime(page);
    expect(await page.evaluate(() => ({
      isolated: globalThis.crossOriginIsolated,
      sharedArrayBuffer: typeof globalThis.SharedArrayBuffer === 'function',
      canvasCount: document.querySelectorAll('canvas').length,
    }))).toMatchObject({ isolated: true, sharedArrayBuffer: true });
  });

  test('renders all eight Mechanics law toggles and toggles CONTACT in the browser', async ({ page }) => {
    await openRuntime(page);
    const mechanics = page.locator([
      ...[128, 129, 130, 131, 132, 133, 134, 135].flatMap((idx) => [
        `#law-grid .law-btn[data-law="${idx}"]`,
        `#law-grid .sq-toggle[data-law="${idx}"]`,
      ]),
    ].join(', '));
    await expect(mechanics).toHaveCount(8);

    // Default view mode is icon (`.sq-toggle`); resolve whichever markup the
    // grid currently renders for CONTACT.
    const contact = page.locator('#law-grid [data-law="128"]');
    await expect(contact).not.toHaveClass(/active/);
    await contact.click();
    await expect(contact).toHaveClass(/active/);
    await contact.click();
    await expect(contact).not.toHaveClass(/active/);
  });

  test('reports WebGPU availability without treating fallback as GPU execution', async ({ page }) => {
    await openRuntime(page);
    const capability = await page.evaluate(async () => {
      const gpu = navigator.gpu;
      if (!gpu) return { api: false, adapter: false, device: false };
      const adapter = await gpu.requestAdapter();
      if (!adapter) return { api: true, adapter: false, device: false };
      const device = await adapter.requestDevice();
      return { api: true, adapter: true, device: Boolean(device) };
    });

    expect(typeof capability.api).toBe('boolean');
    test.info().annotations.push({
      type: 'webgpu',
      description: capability.device ? 'WebGPU device available in this browser run.' : 'No WebGPU device; CPU fallback remains the only verified path.',
    });
  });
});
