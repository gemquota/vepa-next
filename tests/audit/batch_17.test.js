import { describe, it, expect } from 'vitest';
import {
  LAW_INDEXES,
  PARTICLE_STRIDE,
  STRIDE_INDEXES as S,
  DNA_INDEXES as D,
  MAX_PARTICLES,
  DNA_RANGES,
} from '../../src/constants.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createDNABuffer, loadDefaults, getDNAFloat } from '../../src/dna/dnaBuffer.js';
import { solve } from '../../src/physics/solver.js';
import {
  setBuffer,
  applyPlasma,
  applySuperconductivity,
  applyMemoryRefresh,
  applyMemoryDecay,
  applyPatternForce,
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
    v[b + S.VEL_X] = 0;
    v[b + S.VEL_Y] = 0;
    v[b + S.VEL_Z] = 0;
    v[b + S.MASS] = opts.mass ?? 1.5;
    v[b + S.SPECIES_ID] = i % 3;
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

describe('Batch 17 audit — PLASMA / SUPERCONDUCTIVITY / MEMORY / PATTERN', () => {
  describe('PLASMA (64)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('PLASMA'), LAW_INDEXES.PLASMA)).toBe(true);
    });

    it('converts surplus heat to stored charge and cools (temp 1, k 0.02 → charge +0.008)', () => {
      const b = buf(1);
      b[S.TEMPERATURE] = 1;
      applyPlasma(0, 0.02);
      expect(b[S.CHARGE]).toBeCloseTo(0.008, 5);
      expect(b[S.TEMPERATURE]).toBeCloseTo(0.996, 5);
    });

    it('is inert below the 0.6 temperature threshold', () => {
      const b = buf(1);
      b[S.TEMPERATURE] = 0.5;
      applyPlasma(0, 0.02);
      expect(b[S.CHARGE]).toBe(0);
      expect(b[S.TEMPERATURE]).toBe(0.5);
    });

    it('recombines cooled plasma: stored charge releases as heat below 0.5', () => {
      const b = buf(1);
      b[S.TEMPERATURE] = 0.4;
      b[S.CHARGE] = 1.0;
      applyPlasma(0, 0.02);
      expect(b[S.CHARGE]).toBe(0);
      expect(b[S.TEMPERATURE]).toBeCloseTo(0.44, 5); // 0.4 + 1.0·0.02·2
    });

    it('keeps charge in the 0.5–0.6 hysteresis band (no ionize, no recombine)', () => {
      const b = buf(1);
      b[S.TEMPERATURE] = 0.55;
      b[S.CHARGE] = 1.0;
      applyPlasma(0, 0.02);
      expect(b[S.CHARGE]).toBe(1.0);
      expect(b[S.TEMPERATURE]).toBeCloseTo(0.55, 5);
    });

    it('integration: solve() ionizes a hot particle', () => {
      const world = makeWorld(1, { temperature: 1 });
      solve(world.view, 1, PARTICLE_STRIDE, lawsOn('PLASMA'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[S.CHARGE]).toBeGreaterThan(0);
      expect(world.view[S.TEMPERATURE]).toBeLessThan(1);
    });
  });

  describe('SUPERCONDUCTIVITY (65)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('SUPERCONDUCTIVITY'), LAW_INDEXES.SUPERCONDUCTIVITY)).toBe(true);
    });

    it('equalises charge and damps relative velocity for cold pairs', () => {
      const b = buf(2);
      b[S.TEMPERATURE] = 0;
      b[PARTICLE_STRIDE + S.TEMPERATURE] = 0;
      b[S.CHARGE] = 1;
      b[PARTICLE_STRIDE + S.CHARGE] = -1;
      b[S.VEL_X] = 0;
      b[PARTICLE_STRIDE + S.VEL_X] = 10;
      const f = applySuperconductivity(0, PARTICLE_STRIDE, 0.05);
      expect(b[S.CHARGE]).toBeCloseTo(0.96, 5);
      expect(b[PARTICLE_STRIDE + S.CHARGE]).toBeCloseTo(-0.96, 5);
      expect(f.ax).toBeCloseTo(0.5, 5); // (v2 − v1) · k
    });

    it('refuses to couple warm particles (temp > 0.35 → null)', () => {
      const b = buf(2);
      b[S.TEMPERATURE] = 0.5;
      b[PARTICLE_STRIDE + S.TEMPERATURE] = 0;
      expect(applySuperconductivity(0, PARTICLE_STRIDE, 0.05)).toBeNull();
    });

    it('integration: solve() couples a cold pair (charge diff shrinks, relative speed drops)', () => {
      const world = makeWorld(2, { temperature: 0 });
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 102;
      world.view[S.CHARGE] = 1;
      world.view[PARTICLE_STRIDE + S.CHARGE] = -1;
      world.view[S.VEL_X] = 5;
      world.view[PARTICLE_STRIDE + S.VEL_X] = 0;
      const chargeGap0 = Math.abs(world.view[S.CHARGE] - world.view[PARTICLE_STRIDE + S.CHARGE]);
      const relSpeed0 = Math.abs(world.view[S.VEL_X] - world.view[PARTICLE_STRIDE + S.VEL_X]);
      solve(world.view, 2, PARTICLE_STRIDE, lawsOn('SUPERCONDUCTIVITY'), world.dna, WORLD, DT, () => 0.5);
      const chargeGap1 = Math.abs(world.view[S.CHARGE] - world.view[PARTICLE_STRIDE + S.CHARGE]);
      const relSpeed1 = Math.abs(world.view[S.VEL_X] - world.view[PARTICLE_STRIDE + S.VEL_X]);
      expect(chargeGap1).toBeLessThan(chargeGap0);
      expect(relSpeed1).toBeLessThan(relSpeed0);
    });
  });

  describe('MEMORY (66)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('MEMORY'), LAW_INDEXES.MEMORY)).toBe(true);
    });

    it('refresh writes a memory trace on contact (+0.05 both, capped at 1)', () => {
      const b = buf(2);
      b[S.MEMORY] = 0.99;
      applyMemoryRefresh(0, PARTICLE_STRIDE);
      expect(b[S.MEMORY]).toBe(1);
      expect(b[PARTICLE_STRIDE + S.MEMORY]).toBeCloseTo(0.05, 5);
    });

    it('decay fades the trace and amplifies momentum (mem 1, decay 0.995 → ×1.00995)', () => {
      const b = buf(1);
      b[S.MEMORY] = 1;
      b[S.VEL_X] = 1;
      applyMemoryDecay(0, 0.995, 0.5);
      expect(b[S.MEMORY]).toBeLessThan(1);            // trace fades
      expect(b[S.MEMORY]).toBeGreaterThan(0.9);
      expect(b[S.VEL_X]).toBeGreaterThan(1);          // momentum amplified
    });

    it('integration: solve() refreshes memory for contacting particles and then decays it', () => {
      const world = makeWorld(2);
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 102;
      solve(world.view, 2, PARTICLE_STRIDE, lawsOn('MEMORY'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[S.MEMORY]).toBeGreaterThan(0);
      expect(world.view[PARTICLE_STRIDE + S.MEMORY]).toBeGreaterThan(0);
    });
  });

  describe('PATTERN (67)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('PATTERN'), LAW_INDEXES.PATTERN)).toBe(true);
    });

    it('produces a cohesion force toward the neighbour (dx 3, dy 4, dist 5, k 0.2)', () => {
      const b = buf(2);
      const f = applyPatternForce(0, PARTICLE_STRIDE, 3, 4, 0, 5, 0.2);
      expect(f.ax).toBeCloseTo(0.02, 5);
      expect(f.ay).toBeCloseTo(0.026667, 5);
    });

    it('is inert for overlapping particles (dist < 1 → null)', () => {
      const b = buf(2);
      expect(applyPatternForce(0, PARTICLE_STRIDE, 0.5, 0, 0, 0.5, 0.2)).toBeNull();
    });

    it('integration: solve() pulls a close pair together over ticks', () => {
      const world = makeWorld(2);
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 110;
      const d0 = world.view[PARTICLE_STRIDE + S.POS_X] - world.view[S.POS_X];
      for (let t = 0; t < 40; t++) {
        solve(world.view, 2, PARTICLE_STRIDE, lawsOn('PATTERN'), world.dna, WORLD, DT, () => 0.5);
      }
      const d1 = world.view[PARTICLE_STRIDE + S.POS_X] - world.view[S.POS_X];
      expect(d1).toBeLessThan(d0);
    });
  });
});
