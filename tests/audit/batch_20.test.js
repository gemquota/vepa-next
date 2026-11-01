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
  applyFeedback,
  applyLanguage,
  applyCulture,
  applySingularityForce,
  applySingularityAbsorb,
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

describe('Batch 20 audit — FEEDBACK / LANGUAGE / CULTURE / SINGULARITY', () => {
  describe('FEEDBACK (76)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('FEEDBACK'), LAW_INDEXES.FEEDBACK)).toBe(true);
    });

    it('recharges memory from motion and boosts along velocity (mem 0.5, v 2, k 0.5 → ax 0.05)', () => {
      const b = buf(1);
      b[S.MEMORY] = 0.5;
      b[S.VEL_X] = 2;
      const f = applyFeedback(0, 0.5);
      expect(b[S.MEMORY]).toBeCloseTo(0.52, 5); // 0.5 + speed·k·0.02
      expect(f.ax).toBeCloseTo(0.05, 5);        // vx · mem · k · 0.1
    });

    it('is inert for stationary particles (speed < 0.001 → null)', () => {
      const b = buf(1);
      b[S.MEMORY] = 0.5;
      expect(applyFeedback(0, 0.5)).toBeNull();
    });

    it('integration: solve() accelerates a moving particle with a memory trace', () => {
      const world = makeWorld(1, { memory: 0.5 });
      world.view[S.VEL_X] = 2;
      const v0 = world.view[S.VEL_X];
      solve(world.view, 1, PARTICLE_STRIDE, lawsOn('FEEDBACK'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[S.VEL_X]).toBeGreaterThan(v0);
      expect(world.view[S.MEMORY]).toBeGreaterThan(0.5);
    });
  });

  describe('LANGUAGE (77)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('LANGUAGE'), LAW_INDEXES.LANGUAGE)).toBe(true);
    });

    it('converges memory traces and relays signal for a signaling pair', () => {
      const b = buf(2);
      b[S.SIGNAL] = 0.5;
      b[PARTICLE_STRIDE + S.SIGNAL] = 0;
      b[S.MEMORY] = 1;
      b[PARTICLE_STRIDE + S.MEMORY] = 0;
      applyLanguage(0, PARTICLE_STRIDE, 0.25);
      expect(b[S.MEMORY]).toBeCloseTo(0.875, 5);
      expect(b[PARTICLE_STRIDE + S.MEMORY]).toBeCloseTo(0.125, 5);
      expect(b[PARTICLE_STRIDE + S.SIGNAL]).toBeCloseTo(0.0125, 5);
    });

    it('does nothing when neither particle is signaling', () => {
      const b = buf(2);
      b[S.MEMORY] = 1;
      b[PARTICLE_STRIDE + S.MEMORY] = 0;
      applyLanguage(0, PARTICLE_STRIDE, 0.25);
      expect(b[S.MEMORY]).toBe(1);
      expect(b[PARTICLE_STRIDE + S.MEMORY]).toBe(0);
    });

    it('integration: solve() shares memory between signaling neighbours', () => {
      const world = makeWorld(2);
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 102;
      world.view[S.SIGNAL] = 0.5;
      world.view[S.MEMORY] = 1;
      world.view[PARTICLE_STRIDE + S.MEMORY] = 0;
      const gap0 = Math.abs(world.view[S.MEMORY] - world.view[PARTICLE_STRIDE + S.MEMORY]);
      solve(world.view, 2, PARTICLE_STRIDE, lawsOn('LANGUAGE'), world.dna, WORLD, DT, () => 0.5);
      const gap1 = Math.abs(world.view[S.MEMORY] - world.view[PARTICLE_STRIDE + S.MEMORY]);
      expect(gap1).toBeLessThan(gap0);
      expect(world.view[PARTICLE_STRIDE + S.SIGNAL]).toBeGreaterThan(0);
    });
  });

  describe('CULTURE (78)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('CULTURE'), LAW_INDEXES.CULTURE)).toBe(true);
    });

    it('converges DNA cache of same-species contacts (k 0.5 → rate 0.01)', () => {
      const b = buf(2);
      b[S.SPECIES_ID] = 0;
      b[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
      b[S.DNA_CACHE_START] = 0;
      b[PARTICLE_STRIDE + S.DNA_CACHE_START] = 1;
      applyCulture(0, PARTICLE_STRIDE, 0.5);
      expect(b[S.DNA_CACHE_START]).toBeCloseTo(0.01, 5);
      expect(b[PARTICLE_STRIDE + S.DNA_CACHE_START]).toBeCloseTo(0.99, 5);
    });

    it('leaves different-species pairs untouched', () => {
      const b = buf(2);
      b[S.SPECIES_ID] = 0;
      b[PARTICLE_STRIDE + S.SPECIES_ID] = 1;
      b[S.DNA_CACHE_START] = 0;
      b[PARTICLE_STRIDE + S.DNA_CACHE_START] = 1;
      applyCulture(0, PARTICLE_STRIDE, 0.5);
      expect(b[S.DNA_CACHE_START]).toBe(0);
      expect(b[PARTICLE_STRIDE + S.DNA_CACHE_START]).toBe(1);
    });

    it('integration: solve() converges traits within a species but not across', () => {
      const same = makeWorld(2, { species: 0 });
      same.view[S.POS_X] = 100;
      same.view[PARTICLE_STRIDE + S.POS_X] = 102;
      same.view[S.DNA_CACHE_START] = 0;
      same.view[PARTICLE_STRIDE + S.DNA_CACHE_START] = 1;
      solve(same.view, 2, PARTICLE_STRIDE, lawsOn('CULTURE'), same.dna, WORLD, DT, () => 0.5);
      expect(same.view[S.DNA_CACHE_START]).toBeGreaterThan(0);
      expect(same.view[PARTICLE_STRIDE + S.DNA_CACHE_START]).toBeLessThan(1);

      const cross = makeWorld(2);
      cross.view[S.SPECIES_ID] = 0;
      cross.view[PARTICLE_STRIDE + S.SPECIES_ID] = 1;
      cross.view[S.POS_X] = 100;
      cross.view[PARTICLE_STRIDE + S.POS_X] = 102;
      cross.view[S.DNA_CACHE_START] = 0;
      cross.view[PARTICLE_STRIDE + S.DNA_CACHE_START] = 1;
      solve(cross.view, 2, PARTICLE_STRIDE, lawsOn('CULTURE'), cross.dna, WORLD, DT, () => 0.5);
      expect(cross.view[S.DNA_CACHE_START]).toBe(0);
      expect(cross.view[PARTICLE_STRIDE + S.DNA_CACHE_START]).toBe(1);
    });
  });

  describe('SINGULARITY (79)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('SINGULARITY'), LAW_INDEXES.SINGULARITY)).toBe(true);
    });

    it('pulls matter toward a supermassive neighbour (m2 20, dist 10, k 0.5)', () => {
      const b = buf(2);
      b[PARTICLE_STRIDE + S.MASS] = 20;
      const f = applySingularityForce(0, PARTICLE_STRIDE, 10, 0, 0, 10, 0.5);
      const force = 0.5 * 400 / (100 + 0.5);
      expect(f.ax).toBeCloseTo(10 * (1 / 10.001) * force, 3);
      expect(f.ay).toBe(0);
    });

    it('is inert around sub-critical masses (m2 5 → null)', () => {
      const b = buf(2);
      b[PARTICLE_STRIDE + S.MASS] = 5;
      expect(applySingularityForce(0, PARTICLE_STRIDE, 10, 0, 0, 10, 0.5)).toBeNull();
    });

    it('absorbs particles inside the event horizon (mass transfers, victim dies)', () => {
      const b = buf(2);
      b[S.MASS] = 1.5;
      b[PARTICLE_STRIDE + S.MASS] = 25;
      const absorbed = applySingularityAbsorb(0, PARTICLE_STRIDE, 2, 1);
      expect(absorbed).toBe(true);
      expect(b[S.MASS]).toBe(0);
      expect(b[S.DEAD]).toBe(1);
      expect(b[PARTICLE_STRIDE + S.MASS]).toBeCloseTo(26.5, 5);
    });

    it('does not absorb beyond the horizon', () => {
      const b = buf(2);
      b[S.MASS] = 1.5;
      b[PARTICLE_STRIDE + S.MASS] = 25;
      expect(applySingularityAbsorb(0, PARTICLE_STRIDE, 10, 1)).toBe(false);
      expect(b[S.DEAD]).toBe(0);
    });

    it('integration: solve() pulls matter in and absorbs it on contact', () => {
      const world = makeWorld(2);
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 101;
      world.view[S.MASS] = 1.5;
      world.view[PARTICLE_STRIDE + S.MASS] = 25;
      solve(world.view, 2, PARTICLE_STRIDE, lawsOn('SINGULARITY'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[S.DEAD]).toBe(1);
      expect(world.view[S.MASS]).toBe(0);
      expect(world.view[PARTICLE_STRIDE + S.MASS]).toBeCloseTo(26.5, 3);
    });
  });
});
