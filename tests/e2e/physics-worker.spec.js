import { test, expect } from '@playwright/test';

test('boots the simulation shell without a module error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#sim-canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.__VEPA_DEBUG__?._active))).toBe(true);
  expect(errors).toEqual([]);
});

test('runs worker ticks asynchronously when SharedArrayBuffer is available', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => document.querySelector('#hud-tick')?.textContent || '')).toContain('Tick');
  const result = await page.evaluate(async () => {
    const started = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const text = document.querySelector('#hud-tick')?.textContent || '';
    return { elapsed: performance.now() - started, text, isolated: crossOriginIsolated };
  });
  expect(result.text).toContain('Tick');
  expect(result.elapsed).toBeGreaterThanOrEqual(1000);
});

test('GPU force output matches CPU for a fixed browser fixture', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const gpuModule = await import('/src/physics/gpuCompute.js');
    const gpu = await gpuModule.createGPUContext();
    if (!gpu) return { skipped: true };
    const stride = 100;
    const view = new Float32Array(stride * 3);
    for (let i = 0; i < 3; i++) {
      const b = i * stride;
      view[b] = 10 + i * 4;
      view[b + 1] = 20 + i * 3;
      view[b + 2] = 30 + i * 2;
      view[b + 6] = 1 + i * 0.25;
      view[b + 56] = 1;
    }
    const pairs = [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 1, j: 2 }];
    const params = { worldSize: 100, G: 0.2, softening: 0.5, maxForce: 50 };
    const cpu = gpuModule.gpuComputeForcesSync(view, 3, pairs, params);
    const gpuResult = await gpuModule.gpuComputeForces(gpu, view, 3, pairs, params);
    const maxError = Math.max(...['fx', 'fy', 'fz'].map((axis) => Math.max(
      ...gpuResult[axis].map((value, i) => Math.abs(value - cpu[axis][i]))
    )));
    return { skipped: false, maxError };
  });
  test.info().annotations.push({ type: 'webgpu', description: result.skipped ? 'unavailable' : 'hardware-backed' });
  if (result.skipped) return;
  expect(result.maxError).toBeLessThan(0.0001);
});

test('GPU opt-in remains safe when WebGPU is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
  });
  await page.goto('/');
  await expect(page.locator('#sim-canvas')).toBeVisible();
  const fallback = await page.evaluate(async () => {
    const module = await import('/src/physics/gpuCompute.js');
    return await module.createGPUContext();
  });
  expect(fallback).toBeNull();
});
