import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const solver = readFileSync(new URL('../../src/physics/solver.js', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../../src/worker/physics.worker.js', import.meta.url), 'utf8');
const mechanicsDoc = readFileSync(new URL('../../docs/MECHANICS_CONSUMER_MATRIX.md', import.meta.url), 'utf8');

describe('backend and mechanics architecture contracts', () => {
  it('keeps approximate backends opt-in and preserves the exact reference path', () => {
    expect(solver).toContain("runtimeConfig.gravEngine === 'fmm'");
    expect(solver).toContain('octreeGravity');
    expect(solver).toContain('gpuComputeForcesSync');
    expect(solver).toContain('const _useGPU = !!gpuForces;');
    expect(solver).toContain('buildNeighborPairs');
    expect(worker).toContain("runtimeConfig.computeEngine === 'gpu'");
    expect(worker).toContain('gpuAvailable');
    expect(worker).toContain('gpuComputeForces');
    expect(worker).toContain('GPU_FALLBACK');
  });

  it('documents every declared Mechanics law and its known consumer boundary', () => {
    for (const law of ['CONTACT correction', 'MOMENTUM', 'WRAP', 'TORQUE', 'CONSTRAINT', 'FRAGMENTATION', 'TOPOLOGY', 'ADHESION']) {
      expect(mechanicsDoc).toContain(`| ${law} |`);
    }
    expect(mechanicsDoc).toContain('CONTACT` performs geometric separation correction');
    expect(mechanicsDoc).toContain('`COLL` performs impact response');
    expect(mechanicsDoc).toContain('must not mutate the particle buffer');
  });
});
