import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { watchGPUDeviceLoss } from '../../../src/physics/gpuCompute.js';

test('GPU loss monitor reports one device loss and can be cancelled', async () => {
  let resolveLost;
  const lost = new Promise(resolve => { resolveLost = resolve; });
  const seen = [];
  const cancel = watchGPUDeviceLoss({ lost }, status => seen.push(status));
  resolveLost({ reason: 'destroyed', message: 'test device destroyed' });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(seen, [{ reason: 'destroyed', message: 'test device destroyed' }]);
  cancel();
});

test('GPU loss monitor converts monitor rejection into a fallback reason', async () => {
  const seen = [];
  watchGPUDeviceLoss({ lost: Promise.reject(new Error('monitor rejected')) }, status => seen.push(status));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(seen, [{ reason: 'device-loss-monitor', message: 'monitor rejected' }]);
});

test('worker routes the shared device-loss monitor into the CPU fallback message', () => {
  const worker = readFileSync(new URL('../../../src/worker/physics.worker.js', import.meta.url), 'utf8');
  assert.match(worker, /watchGPUDeviceLoss\(gpuContext/);
  assert.match(worker, /type: 'GPU_FALLBACK'/);
  assert.match(worker, /gpuReady = false/);
  assert.match(worker, /gpuContext = null/);
});
