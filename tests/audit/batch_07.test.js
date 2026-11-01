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
  applyCrystallization,
  applyHeatTransfer,
  applyThermalJitter,
  applyColdDamping,
  applyConvection,
} from '../../src/physics/laws.js';

const WORLD = 2000;
const DT = 0.25;

function view(n) {
  return new Float32Array(n * PARTICLE_STRIDE);
}

function lawsOn(...names) {
  const st = createLawState();
  for (const name of names) set(st, LAW_INDEXES[name]);
  return st;
}

function makeWorld(count, opts = {}) {
  const buf = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  const v = buf.view;
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
    v[b + S.MASS] = 1.5;
    v[b + S.SPECIES_ID] = i % 3;
    v[b + S.DEAD] = 0;
    v[b + S.ENERGY] = opts.energy ?? 100;
    v[b + S.TEMPERATURE] = opts.temperature ?? 0;
    v[b + S.CHARGE] = opts.charge ?? 0;
    v[b + S.SOUL] = opts.soul ?? 0;
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

describe('Batch 07 audit — CRYSTALLIZATION / HEAT / COLD / CONVECTION', () => {
  describe('CRYSTALLIZATION (24)', () => {
    it('gates: returns null without the law', () => {
      const buf = view(2);
      expect(applyCrystallization(createLawState(), buf, 0, PARTICLE_STRIDE, 4, 4, 0, 5.657, 1)).toBeNull();
    });

    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('CRYSTALLIZATION'), LAW_INDEXES.CRYSTALLIZATION)).toBe(true);
    });

    it('pulls cross-species neighbours toward the 8-unit lattice grid', () => {
      const buf = view(2);
      buf[S.SPECIES_ID] = 0;
      buf[PARTICLE_STRIDE + S.SPECIES_ID] = 1;
      const f = applyCrystallization(lawsOn('CRYSTALLIZATION'), buf, 0, PARTICLE_STRIDE, 4, 4, 0, 5.657, 1);
      // round(4/8)*8 = 8 → pull = (8−4)*0.05 = 0.2
      expect(f.ax).toBeCloseTo(0.2, 5);
      expect(f.ay).toBeCloseTo(0.2, 5);
      expect(f.az).toBe(0);
    });

    it('gives same-species pairs a 3x crystallization bonus (0.2 → 0.6)', () => {
      const buf = view(2);
      buf[S.SPECIES_ID] = 2;
      buf[PARTICLE_STRIDE + S.SPECIES_ID] = 2;
      const f = applyCrystallization(lawsOn('CRYSTALLIZATION'), buf, 0, PARTICLE_STRIDE, 4, 4, 0, 5.657, 1);
      expect(f.ax).toBeCloseTo(0.6, 5);
      expect(f.ay).toBeCloseTo(0.6, 5);
      expect(f.az).toBe(0);
    });

    it('is a no-op beyond 150 units', () => {
      const buf = view(2);
      expect(applyCrystallization(lawsOn('CRYSTALLIZATION'), buf, 0, PARTICLE_STRIDE, 160, 0, 0, 160, 1)).toBeNull();
    });
  });

  describe('HEAT (25)', () => {
    it('gates: temperatures unchanged without the law', () => {
      const buf = view(2);
      buf[S.TEMPERATURE] = 1;
      buf[PARTICLE_STRIDE + S.TEMPERATURE] = 0;
      applyHeatTransfer(createLawState(), buf, 0, PARTICLE_STRIDE, 5, 1, 1);
      expect(buf[S.TEMPERATURE]).toBe(1);
      expect(buf[PARTICLE_STRIDE + S.TEMPERATURE]).toBe(0);
    });

    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('HEAT'), LAW_INDEXES.HEAT)).toBe(true);
    });

    it('conducts temperature from the hot particle to the cold one (1.0 → 0.99 / 0.01)', () => {
      const buf = view(2);
      buf[S.TEMPERATURE] = 1;
      buf[PARTICLE_STRIDE + S.TEMPERATURE] = 0;
      applyHeatTransfer(lawsOn('HEAT'), buf, 0, PARTICLE_STRIDE, 5, 1, 1);
      expect(buf[S.TEMPERATURE]).toBeCloseTo(0.99, 5);
      expect(buf[PARTICLE_STRIDE + S.TEMPERATURE]).toBeCloseTo(0.01, 5);
    });

    it('integration: solve() conducts heat between neighbours', () => {
      const world = makeWorld(2);
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 102;
      world.view[S.TEMPERATURE] = 1;
      world.view[PARTICLE_STRIDE + S.TEMPERATURE] = 0;
      solve(world.view, 2, PARTICLE_STRIDE, lawsOn('HEAT'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[S.TEMPERATURE]).toBeLessThan(1);
      expect(world.view[PARTICLE_STRIDE + S.TEMPERATURE]).toBeGreaterThan(0);
    });

    it('adds kinetic-theory jitter to hot particles (temp 1, prng 0.75, dt 1 → ±0.005)', () => {
      const buf = view(1);
      buf[S.TEMPERATURE] = 1;
      applyThermalJitter(lawsOn('HEAT'), buf, 0, 1, 1, () => 0.75);
      expect(buf[S.VEL_X]).toBeCloseTo(0.005, 6);
      expect(buf[S.VEL_Y]).toBeCloseTo(0.005, 6);
      expect(buf[S.VEL_Z]).toBeCloseTo(0.005, 6);
    });

    it('does not jitter particles at or below 0.5 temperature', () => {
      const buf = view(1);
      buf[S.TEMPERATURE] = 0.5;
      applyThermalJitter(lawsOn('HEAT'), buf, 0, 1, 1, () => 0.75);
      expect(buf[S.VEL_X]).toBe(0);
    });

    it('gates: no jitter without the law', () => {
      const buf = view(1);
      buf[S.TEMPERATURE] = 1;
      applyThermalJitter(createLawState(), buf, 0, 1, 1, () => 0.75);
      expect(buf[S.VEL_X]).toBe(0);
    });

    it('integration: solve() kicks hot particles with thermal noise', () => {
      const world = makeWorld(1, { temperature: 1 });
      solve(world.view, 1, PARTICLE_STRIDE, lawsOn('HEAT'), world.dna, WORLD, DT, () => 0.75);
      expect(world.view[S.VEL_X]).toBeGreaterThan(0);
    });
  });

  describe('COLD (26)', () => {
    it('gates: temperatures unchanged without the law', () => {
      const buf = view(2);
      buf[S.TEMPERATURE] = 0;
      buf[PARTICLE_STRIDE + S.TEMPERATURE] = 1;
      applyHeatTransfer(createLawState(), buf, 0, PARTICLE_STRIDE, 5, 1, 1);
      expect(buf[S.TEMPERATURE]).toBe(0);
      expect(buf[PARTICLE_STRIDE + S.TEMPERATURE]).toBe(1);
    });

    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('COLD'), LAW_INDEXES.COLD)).toBe(true);
    });

    it('equalises temperature by cooling the hotter particle (1.0 → 0.985 / 0.015)', () => {
      const buf = view(2);
      buf[S.TEMPERATURE] = 0;
      buf[PARTICLE_STRIDE + S.TEMPERATURE] = 1;
      applyHeatTransfer(lawsOn('COLD'), buf, 0, PARTICLE_STRIDE, 5, 1, 1);
      expect(buf[PARTICLE_STRIDE + S.TEMPERATURE]).toBeCloseTo(0.985, 5);
      expect(buf[S.TEMPERATURE]).toBeCloseTo(0.015, 5);
    });

    it('integration: solve() cools the hotter neighbour toward equilibrium', () => {
      const world = makeWorld(2);
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 102;
      world.view[S.TEMPERATURE] = 0;
      world.view[PARTICLE_STRIDE + S.TEMPERATURE] = 1;
      solve(world.view, 2, PARTICLE_STRIDE, lawsOn('COLD'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[PARTICLE_STRIDE + S.TEMPERATURE]).toBeLessThan(1);
      expect(world.view[PARTICLE_STRIDE + S.TEMPERATURE]).toBeGreaterThan(world.view[S.TEMPERATURE]);
    });

    it('damps cold particle velocity (temp 0, dt 1 → × 0.95)', () => {
      const buf = view(1);
      buf[S.TEMPERATURE] = 0;
      buf[S.VEL_X] = 1;
      buf[S.VEL_Y] = 1;
      buf[S.VEL_Z] = 1;
      applyColdDamping(lawsOn('COLD'), buf, 0, 1, 1);
      expect(buf[S.VEL_X]).toBeCloseTo(0.95, 5);
      expect(buf[S.VEL_Y]).toBeCloseTo(0.95, 5);
      expect(buf[S.VEL_Z]).toBeCloseTo(0.95, 5);
    });

    it('does not damp particles at or above 0.5 temperature', () => {
      const buf = view(1);
      buf[S.TEMPERATURE] = 1;
      buf[S.VEL_X] = 1;
      applyColdDamping(lawsOn('COLD'), buf, 0, 1, 1);
      expect(buf[S.VEL_X]).toBe(1);
    });

    it('gates: no damping without the law', () => {
      const buf = view(1);
      buf[S.TEMPERATURE] = 0;
      buf[S.VEL_X] = 10;
      applyColdDamping(createLawState(), buf, 0, 1, 1);
      expect(buf[S.VEL_X]).toBe(10);
    });

    it('integration: solve() slows cold particles', () => {
      const world = makeWorld(1, { temperature: 0 });
      world.view[S.VEL_X] = 10;
      solve(world.view, 1, PARTICLE_STRIDE, lawsOn('COLD'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[S.VEL_X]).toBeLessThan(10);
    });
  });

  describe('CONVECTION (27)', () => {
    it('gates: VEL_Y unchanged without the law', () => {
      const buf = view(1);
      buf[S.TEMPERATURE] = 1;
      applyConvection(createLawState(), buf, 0, 1, 1);
      expect(buf[S.VEL_Y]).toBe(0);
    });

    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('CONVECTION'), LAW_INDEXES.CONVECTION)).toBe(true);
    });

    it('adds buoyancy to hot particles (temp 1, dt 1 → VEL_Y +0.0005)', () => {
      const buf = view(1);
      buf[S.TEMPERATURE] = 1;
      applyConvection(lawsOn('CONVECTION'), buf, 0, 1, 1);
      expect(buf[S.VEL_Y]).toBeCloseTo(0.0005, 6);
    });

    it('integration: solve() makes hot particles rise', () => {
      const world = makeWorld(1, { temperature: 1 });
      solve(world.view, 1, PARTICLE_STRIDE, lawsOn('CONVECTION'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[S.VEL_Y]).toBeGreaterThan(0);
    });
  });
});
