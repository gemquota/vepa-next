import { describe, it, expect } from 'vitest';
import {
  LAW_INDEXES,
  PARTICLE_STRIDE,
  STRIDE_INDEXES as S,
  MAX_PARTICLES,
  DNA_RANGES,
} from '../../src/constants.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createDNABuffer, loadDefaults, getDNAFloat } from '../../src/dna/dnaBuffer.js';
import { solve } from '../../src/physics/solver.js';
import {
  setBuffer,
  applyMetricForce,
  applyPredictForce,
  applyCodeBlend,
  applyProtocolSync,
} from '../../src/physics/laws.js';

const WORLD = 2000;
const DT = 0.25;

function buf(n) {
  const b = new Float32Array(n * PARTICLE_STRIDE);
  setBuffer(b);
  return b;
}

function lawsOn(...names) {
  const st = createLawState();
  for (const name of names) set(st, LAW_INDEXES[name]);
  return st;
}

function makeWorld(count, opts = {}) {
  const pb = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  const v = pb.view;
  const dna = createDNABuffer();
  loadDefaults(dna, DNA_RANGES);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    v[b + S.POS_X] = 100 + (i % 4) * 50;
    v[b + S.POS_Y] = 100 + Math.floor(i / 4) * 50;
    v[b + S.POS_Z] = 100;
    v[b + S.VEL_X] = opts.velX ?? 0;
    v[b + S.VEL_Y] = 0;
    v[b + S.VEL_Z] = 0;
    v[b + S.MASS] = opts.mass ?? 1.5;
    v[b + S.SPECIES_ID] = opts.species ?? i % 3;
    v[b + S.DEAD] = 0;
    v[b + S.ENERGY] = opts.energy ?? 100;
    v[b + S.TEMPERATURE] = opts.temperature ?? 0;
    v[b + S.CHARGE] = opts.charge ?? 0;
    v[b + S.MEMORY] = opts.memory ?? 0;
    v[b + S.SIGNAL] = opts.signal ?? 0;
    v[b + S.RADIUS] = 0.6;
    v[b + S.BOND_PARTNER_1] = -1;
    v[b + S.BOND_PARTNER_2] = -1;
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      v[b + S.DNA_CACHE_START + d] = getDNAFloat(dna, i % 3, d, r.min, r.max);
    }
  }
  return { view: v, dna };
}

describe('Batch 19 audit — METRIC / PREDICT / CODE / PROTOCOL', () => {
  describe('METRIC (72)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('METRIC'), LAW_INDEXES.METRIC)).toBe(true);
    });

    it('pulls the poorer particle toward the richer neighbour (dE 50, k 0.2 → ax 1.0)', () => {
      const b = buf(2);
      b[S.ENERGY] = 50;
      b[PARTICLE_STRIDE + S.ENERGY] = 100;
      const f = applyMetricForce(0, PARTICLE_STRIDE, 3, 4, 0, 5, 0.2);
      expect(f.ax).toBeCloseTo(1.0, 3);
      expect(f.ay).toBeCloseTo(1.3333, 3);
    });

    it('is inert on an energy plateau (dE 0 → null)', () => {
      const b = buf(2);
      b[S.ENERGY] = 50;
      b[PARTICLE_STRIDE + S.ENERGY] = 50;
      expect(applyMetricForce(0, PARTICLE_STRIDE, 3, 0, 0, 5, 0.2)).toBeNull();
    });

    it('integration: solve() accelerates a poor particle toward the rich one', () => {
      const world = makeWorld(2);
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 103;
      world.view[S.ENERGY] = 50;
      world.view[PARTICLE_STRIDE + S.ENERGY] = 100;
      solve(world.view, 2, PARTICLE_STRIDE, lawsOn('METRIC'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[S.VEL_X]).toBeGreaterThan(0);
    });
  });

  describe('PREDICT (73)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('PREDICT'), LAW_INDEXES.PREDICT)).toBe(true);
    });

    it('aims at the neighbour extrapolated position (v2 1 over t 3)', () => {
      const b = buf(2);
      b[PARTICLE_STRIDE + S.VEL_X] = 1;
      const f = applyPredictForce(0, PARTICLE_STRIDE, 3, 4, 0, 5, 0.3);
      const pdx = 6;   // 3 + 1·3
      const pdy = 4;
      const pd = Math.sqrt(pdx * pdx + pdy * pdy);
      expect(f.ax).toBeCloseTo((pdx / pd) * (0.3 / 6), 4);
      expect(f.ay).toBeCloseTo((pdy / pd) * (0.3 / 6), 4);
    });

    it('integration: solve() steers toward the neighbour future position', () => {
      const world = makeWorld(2);
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 103;
      world.view[PARTICLE_STRIDE + S.VEL_X] = 1;
      solve(world.view, 2, PARTICLE_STRIDE, lawsOn('PREDICT'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[S.VEL_X]).toBeGreaterThan(0);
    });
  });

  describe('CODE (74)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('CODE'), LAW_INDEXES.CODE)).toBe(true);
    });

    it('blends sampled DNA loci on contact (distSq 9 → both move toward average)', () => {
      const b = buf(2);
      b[S.DNA_CACHE_START] = 0;
      b[PARTICLE_STRIDE + S.DNA_CACHE_START] = 1;
      applyCodeBlend(0, PARTICLE_STRIDE, 9, 0.05);
      expect(b[S.DNA_CACHE_START]).toBeCloseTo(0.0005, 6);
      expect(b[PARTICLE_STRIDE + S.DNA_CACHE_START]).toBeCloseTo(0.9995, 6);
    });

    it('does not blend beyond contact range (distSq 25 → no change)', () => {
      const b = buf(2);
      b[S.DNA_CACHE_START] = 0;
      b[PARTICLE_STRIDE + S.DNA_CACHE_START] = 1;
      applyCodeBlend(0, PARTICLE_STRIDE, 25, 0.05);
      expect(b[S.DNA_CACHE_START]).toBe(0);
      expect(b[PARTICLE_STRIDE + S.DNA_CACHE_START]).toBe(1);
    });

    it('integration: solve() converges DNA at sampled loci for touching particles', () => {
      const world = makeWorld(2);
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 102;
      world.view[S.DNA_CACHE_START] = 0;
      world.view[PARTICLE_STRIDE + S.DNA_CACHE_START] = 1;
      solve(world.view, 2, PARTICLE_STRIDE, lawsOn('CODE'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[S.DNA_CACHE_START]).toBeGreaterThan(0);
      expect(world.view[PARTICLE_STRIDE + S.DNA_CACHE_START]).toBeLessThan(1);
    });
  });

  describe('PROTOCOL (75)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('PROTOCOL'), LAW_INDEXES.PROTOCOL)).toBe(true);
    });

    it('entrains signal phase (s1 0, s2 1, k 0.1 → 0.1 / 0.9)', () => {
      const b = buf(2);
      b[S.SIGNAL] = 0;
      b[PARTICLE_STRIDE + S.SIGNAL] = 1;
      applyProtocolSync(0, PARTICLE_STRIDE, 0.1);
      expect(b[S.SIGNAL]).toBeCloseTo(0.1, 5);
      expect(b[PARTICLE_STRIDE + S.SIGNAL]).toBeCloseTo(0.9, 5);
    });

    it('integration: solve() converges neighbour signal phases', () => {
      const world = makeWorld(2);
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 102;
      world.view[S.SIGNAL] = 0;
      world.view[PARTICLE_STRIDE + S.SIGNAL] = 1;
      const gap0 = Math.abs(world.view[S.SIGNAL] - world.view[PARTICLE_STRIDE + S.SIGNAL]);
      solve(world.view, 2, PARTICLE_STRIDE, lawsOn('PROTOCOL'), world.dna, WORLD, DT, () => 0.5);
      const gap1 = Math.abs(world.view[S.SIGNAL] - world.view[PARTICLE_STRIDE + S.SIGNAL]);
      expect(gap1).toBeLessThan(gap0);
    });
  });
});
