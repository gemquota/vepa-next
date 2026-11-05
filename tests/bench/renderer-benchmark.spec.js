import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RESULTS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'bench', 'results', 'renderer-benchmark.json',
);

test.describe('renderer backend benchmark', () => {
  test('compares Canvas2D and PixiJS across population scales', async ({ page }) => {
    await page.goto('/tests/bench/harness.html');
    await expect.poll(() => page.evaluate(() => Boolean(window.__VEPA_BENCH__))).toBe(true);

    const report = await page.evaluate(async () => {
      // 0.1k / 0.5k / 1k / 10k alive slots (fixture marks ~2% dead).
      return await window.__VEPA_BENCH__.run({
        scales: [100, 500, 1000, 10000],
        frameSamples: 30,
        seed: 0x9e3779b9,
      });
    });

    mkdirSync(dirname(RESULTS_PATH), { recursive: true });
    writeFileSync(RESULTS_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`renderer benchmark → ${RESULTS_PATH}`);
    for (const row of report.results) {
      console.log(
        `${row.mode.padEnd(8)} n=${String(row.count).padEnd(6)} ` +
        `submit=${row.submit.mean}ms (fps ${row.submit.fps}) ` +
        `frame=${row.frame.mean}ms (fps ${row.frame.fps})`,
      );
    }

    // Sanity: every row produced finite, positive timings; the pixi rows
    // either ran in pixi mode or recorded an explicit fallback reason.
    for (const row of report.results) {
      expect(Number.isFinite(row.submit.mean)).toBe(true);
      expect(Number.isFinite(row.frame.mean)).toBe(true);
      expect(row.submit.mean).toBeGreaterThan(0);
      expect(row.frame.mean).toBeGreaterThan(0);
      expect(row.frame.mean).toBeGreaterThanOrEqual(row.submit.mean * 0.5);
      if (row.requestedBackend === 'pixi' && row.mode !== 'pixi') {
        expect(row.backendError).toBeTruthy();
      }
    }
    expect(report.results).toHaveLength(8);
  });

  test('boots the full application with the PixiJS backend selected', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('vepa-render-backend', 'pixi'); } catch { /* noop */ }
    });
    await page.goto('/');
    // _active only proves module load; the renderer hook appears after the
    // async boot() resolves.
    await page.waitForFunction(() => Boolean(window.__VEPA_RENDERER__), null, { timeout: 30_000 });

    const backend = await page.evaluate(() => ({
      mode: window.__VEPA_RENDERER__?.mode || null,
      requested: window.__VEPA_RENDERER__?.requestedBackend || null,
      error: window.__VEPA_RENDERER__?.backendError || null,
    }));
    // Either the GPU renderer engaged or an explicit fallback was recorded —
    // a silent canvas2d boot with pixi requested would be a wiring bug.
    console.log(`app boot backend: ${JSON.stringify(backend)}`);
    expect(backend.mode).toBe('pixi');

    // Simulation must still tick with the selected backend.
    await expect.poll(
      () => page.evaluate(() => document.querySelector('#hud-tick')?.textContent || ''),
      { timeout: 15_000 },
    ).toMatch(/\d[\d,]*\n\d+\.\d/);
  });
});
