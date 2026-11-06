import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LAW_INDEXES, PARTICLE_STRIDE, STRIDE_INDEXES, WORLD_SIZE } from '../src/constants.js';
import { createLawState, set, serialize } from '../src/state/lawState.js';
import { runtimeConfig } from '../src/state/runtimeConfig.js';
import { solve, drainOffspring, resetOffspringRing } from '../src/physics/solver.js';

const SEED = 0x005eed31;
const SAMPLE_TICKS = new Set([1, 2, 4, 8, 16]);
const FIXTURE = Object.freeze([
  [72, 78, 83, 0.00, 0.01, 0.00, 1.00],
  [104, 80, 84, -0.01, 0.00, 0.00, 1.50],
  [84, 111, 80, 0.00, -0.01, 0.01, 0.75],
  [88, 86, 116, 0.01, 0.00, -0.01, 2.00],
]);

function hashBuffer(view) {
  return createHash('sha256').update(Buffer.from(view.buffer, view.byteOffset, view.byteLength)).digest('hex');
}
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
function runFixture() {
  const view = new Float32Array(FIXTURE.length * PARTICLE_STRIDE);
  for (let i = 0; i < FIXTURE.length; i++) {
    const [x, y, z, vx, vy, vz, mass] = FIXTURE[i];
    const b = i * PARTICLE_STRIDE;
    view[b + STRIDE_INDEXES.POS_X] = x;
    view[b + STRIDE_INDEXES.POS_Y] = y;
    view[b + STRIDE_INDEXES.POS_Z] = z;
    view[b + STRIDE_INDEXES.VEL_X] = vx;
    view[b + STRIDE_INDEXES.VEL_Y] = vy;
    view[b + STRIDE_INDEXES.VEL_Z] = vz;
    view[b + STRIDE_INDEXES.MASS] = mass;
    view[b + STRIDE_INDEXES.RADIUS] = 0.25;
    view[b + STRIDE_INDEXES.ENERGY] = 10 + i;
    for (let d = 0; d < 42; d++) view[b + STRIDE_INDEXES.DNA_CACHE_START + d] = 0.5;
  }
  const laws = createLawState();
  set(laws, LAW_INDEXES.GRAV);
  const dna = new Uint16Array(64 * 64);
  const rng = makeRandom(SEED);
  const previous = {
    gravEngine: runtimeConfig.gravEngine,
    computeEngine: runtimeConfig.computeEngine,
    worldParams: runtimeConfig.worldParams,
  };
  runtimeConfig.gravEngine = 'exact';
  runtimeConfig.computeEngine = 'cpu';
  runtimeConfig.worldParams = { ...previous.worldParams, GLOBAL_G: 1, MAX_INTERACTIONS: 500, QUALITY_MODE: 0, AUTO_TUNE: 0, GRID_DIM: 12, CELL_CAP: 100 };
  resetOffspringRing();
  const samples = [];
  try {
    for (let tick = 1; tick <= 16; tick++) {
      solve(view, FIXTURE.length, PARTICLE_STRIDE, laws, dna, WORLD_SIZE, 0.025, rng, null);
      const offspring = drainOffspring();
      if (SAMPLE_TICKS.has(tick)) {
        let kineticEnergy = 0, px = 0, py = 0, pz = 0, aliveCount = 0;
        for (let i = 0; i < FIXTURE.length; i++) {
          const b = i * PARTICLE_STRIDE;
          const mass = view[b + STRIDE_INDEXES.MASS];
          if (view[b + STRIDE_INDEXES.DEAD] >= 0.5 || mass <= 0) continue;
          const vx = view[b + STRIDE_INDEXES.VEL_X], vy = view[b + STRIDE_INDEXES.VEL_Y], vz = view[b + STRIDE_INDEXES.VEL_Z];
          kineticEnergy += 0.5 * mass * (vx * vx + vy * vy + vz * vz);
          px += mass * vx; py += mass * vy; pz += mass * vz;
          aliveCount++;
        }
        samples.push(Object.freeze({
          tick,
          stateSha256: hashBuffer(view),
          kineticEnergy,
          momentum: [px, py, pz],
          aliveCount,
          offspringCount: offspring.length,
        }));
      }
    }
  } finally {
    resetOffspringRing();
    runtimeConfig.gravEngine = previous.gravEngine;
    runtimeConfig.computeEngine = previous.computeEngine;
    runtimeConfig.worldParams = previous.worldParams;
  }
  return Object.freeze({ seed: SEED, worldSize: WORLD_SIZE, dt: 0.025, ticks: 16,
    lawMask: serialize(laws), particleCount: FIXTURE.length, samples: Object.freeze(samples) });
}

export function captureProductGolden() {
  const first = runFixture();
  const second = runFixture();
  const firstHashes = first.samples.map(sample => sample.stateSha256);
  const secondHashes = second.samples.map(sample => sample.stateSha256);
  if (JSON.stringify(firstHashes) !== JSON.stringify(secondHashes)) {
    throw new Error('Product solver is not repeatable for the fixed golden fixture');
  }
  return Object.freeze({
    schema: 'vepa.product-golden-fixture',
    version: 1,
    repeatability: 'bit-identical-within-this-runtime-and-commit',
    seed: first.seed,
    worldSize: first.worldSize,
    dt: first.dt,
    ticks: first.ticks,
    lawMask: first.lawMask,
    particleCount: first.particleCount,
    samples: first.samples,
    trajectorySha256: createHash('sha256').update(firstHashes.join(':')).digest('hex'),
    caveat: 'This is a product-runtime golden capture, not a cross-engine or cross-platform floating-point guarantee.',
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const record = captureProductGolden();
  const output = resolve(process.cwd(), '.artifacts/product-golden.json');
  await mkdir(resolve(process.cwd(), '.artifacts'), { recursive: true });
  await writeFile(output, JSON.stringify(record, null, 2) + '\n');
  process.stdout.write(JSON.stringify(record, null, 2) + '\n');
}
