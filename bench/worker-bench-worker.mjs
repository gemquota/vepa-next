import { parentPort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { solve, enableBenchMode, getLastTickUs, resetOffspringRing } from '../src/physics/solver.js';
import { deserialize } from '../src/state/lawState.js';
import { runtimeConfig } from '../src/state/runtimeConfig.js';
import { PARTICLE_STRIDE, DNA_COUNT, DNA_RANGES, WORLD_SIZE } from '../src/constants.js';
import { SplitMix32 } from '../src/core/prng.js';

function createParticleBuffer(count) {
  const buf = new Float32Array(count * PARTICLE_STRIDE);
  const rng = new SplitMix32(42);
  for (let i = 0; i < count; i++) {
    const base = i * PARTICLE_STRIDE;
    buf[base] = rng.nextFloat(0, WORLD_SIZE);
    buf[base + 1] = rng.nextFloat(0, WORLD_SIZE);
    buf[base + 2] = rng.nextFloat(0, WORLD_SIZE);
    buf[base + 3] = rng.nextFloat(-1, 1);
    buf[base + 4] = rng.nextFloat(-1, 1);
    buf[base + 5] = rng.nextFloat(-1, 1);
    buf[base + 6] = rng.nextFloat(0.5, 3);
    buf[base + 7] = Math.floor(rng.nextFloat(0, 5));
    for (let d = 0; d < 42; d++) buf[base + 8 + d] = rng.nextFloat(0, 1);
    buf[base + 50] = rng.nextFloat(20, 80);
    buf[base + 52] = 0;
    buf[base + 53] = rng.nextFloat(0.3, 1);
    buf[base + 54] = rng.nextFloat(0.3, 1);
    buf[base + 55] = rng.nextFloat(0.3, 1);
    buf[base + 56] = 1 + buf[base + 6] * 0.5;
    buf[base + 57] = rng.nextFloat(0, 0.5);
    buf[base + 66] = rng.nextFloat(20, 30);
    buf[base + 67] = rng.nextFloat(-1, 1);
  }
  return buf;
}

function createDnaBuffer() {
  const buf = new Uint16Array(DNA_COUNT * DNA_COUNT);
  for (let species = 0; species < DNA_COUNT; species++) {
    for (let d = 0; d < DNA_COUNT; d++) {
      const range = DNA_RANGES[d];
      const max = range ? range.max : 1;
      const value = range ? range.default : 0.5;
      buf[species * DNA_COUNT + d] = Math.round((value / max) * 65535) || 32768;
    }
  }
  return buf;
}

parentPort.on('message', ({ count, lawState: serialized, ticks = 3 }) => {
  const state = deserialize(serialized);
  const dna = createDnaBuffer();
  const particles = createParticleBuffer(count);
  const splitmix = new SplitMix32(123);
  const rng = () => splitmix.next();
  const warmup = 3;
  for (let i = 0; i < warmup; i++) {
    solve(particles, count, PARTICLE_STRIDE, state, dna, WORLD_SIZE, 1, rng);
    resetOffspringRing();
  }

  enableBenchMode(true);
  const started = performance.now();
  let solverUs = 0;
  for (let i = 0; i < ticks; i++) {
    solve(particles, count, PARTICLE_STRIDE, state, dna, WORLD_SIZE, 1, rng);
    solverUs += getLastTickUs();
    resetOffspringRing();
  }
  const elapsedMs = performance.now() - started;
  enableBenchMode(false);
  parentPort.postMessage({
    count,
    ticks,
    solverUs: +(solverUs / ticks).toFixed(2),
    wallUs: +(elapsedMs * 1000 / ticks).toFixed(2),
    startupMs: 0,
  });
});
