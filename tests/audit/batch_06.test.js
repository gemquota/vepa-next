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
  applyOxidationEffect,
  applyPolymer,
  applyIsomerization,
  applyChirality,
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
    v[b + S.BOND_COUNT] = 0;
    v[b + S.BOND_PARTNER_1] = -1;
    v[b + S.BOND_PARTNER_2] = -1;
    v[b + S.BOND_PARTNER_3] = -1;
    v[b + S.BOND_PARTNER_4] = -1;
    v[b + S.BOND_PARTNER_5] = -1;
    v[b + S.BOND_PARTNER_6] = -1;
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      v[b + S.DNA_CACHE_START + d] = getDNAFloat(dna, i % 3, d, r.min, r.max);
    }
  }
  return { view: v, dna };
}

describe('Batch 06 audit — OXIDATION / POLYMER / ISOMERIZATION / CHIRALITY', () => {
  describe('OXIDATION (20)', () => {
    it('gates: mass, charge and energy unchanged without the law', () => {
      const buf = view(1);
      buf[S.CHARGE] = 1;
      buf[S.MASS] = 1.5;
      buf[S.ENERGY] = 50;
      applyOxidationEffect(createLawState(), buf, 0, 1, 1);
      expect(buf[S.MASS]).toBe(1.5);
      expect(buf[S.CHARGE]).toBe(1);
      expect(buf[S.ENERGY]).toBe(50);
    });

    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('OXIDATION'), LAW_INDEXES.OXIDATION)).toBe(true);
    });

    it('degrades mass and decays charge (rust) proportionally (charge 1, dt 1 → −0.001)', () => {
      const buf = view(1);
      buf[S.CHARGE] = 1;
      buf[S.MASS] = 1.5;
      applyOxidationEffect(lawsOn('OXIDATION'), buf, 0, 1, 1);
      expect(buf[S.MASS]).toBeCloseTo(1.499, 5);
      expect(buf[S.CHARGE]).toBeCloseTo(0.999, 5);
    });

    it('is inert below the 0.3 charge threshold', () => {
      const buf = view(1);
      buf[S.CHARGE] = 0.1;
      buf[S.MASS] = 1.5;
      applyOxidationEffect(lawsOn('OXIDATION'), buf, 0, 1, 1);
      expect(buf[S.MASS]).toBe(1.5);
      expect(buf[S.CHARGE]).toBeCloseTo(0.1, 5);
    });

    it('releases heat and flashes brighter when HEAT_OUTPUT DNA is set', () => {
      const buf = view(1);
      buf[S.CHARGE] = 1;
      buf[S.DNA_CACHE_START + 39] = 1.0; // HEAT_OUTPUT
      buf[S.ENERGY] = 50;
      buf[S.TEMPERATURE] = 0;
      buf[S.COLOR_R] = 100; buf[S.COLOR_G] = 100; buf[S.COLOR_B] = 100;
      buf[S.ALPHA] = 0.5;
      applyOxidationEffect(lawsOn('OXIDATION'), buf, 0, 1, 1);
      expect(buf[S.ENERGY]).toBeGreaterThan(50);
      expect(buf[S.TEMPERATURE]).toBeGreaterThan(0);
      expect(buf[S.COLOR_R]).toBeGreaterThan(100); // glow toward white
      expect(buf[S.ALPHA]).toBeGreaterThan(0.5);
    });
  });

  describe('POLYMER (21)', () => {
    it('gates: zero force and no bond without the law', () => {
      const buf = view(2);
      buf[S.POS_X] = 100;
      buf[PARTICLE_STRIDE + S.POS_X] = 105;
      const f = applyPolymer(createLawState(), buf, 0, PARTICLE_STRIDE, 5, 0, 0, 5, 1, PARTICLE_STRIDE);
      expect(f).toEqual({ ax: 0, ay: 0, az: 0 });
      expect(buf[S.BOND_COUNT]).toBe(0);
    });

    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('POLYMER'), LAW_INDEXES.POLYMER)).toBe(true);
    });

    it('forms a MUTUAL bond (both partners record each other) and returns a spring force', () => {
      const buf = view(2);
      buf[S.POS_X] = 100;
      buf[PARTICLE_STRIDE + S.POS_X] = 105;
      buf[S.BOND_COUNT] = 0;
      buf[S.BOND_PARTNER_1] = -1;
      buf[S.BOND_PARTNER_2] = -1;
      buf[PARTICLE_STRIDE + S.BOND_COUNT] = 0;
      buf[PARTICLE_STRIDE + S.BOND_PARTNER_1] = -1;
      buf[PARTICLE_STRIDE + S.BOND_PARTNER_2] = -1;
      buf[S.BOND_PARTNER_3] = -1; buf[S.BOND_PARTNER_4] = -1;
      buf[S.BOND_PARTNER_5] = -1; buf[S.BOND_PARTNER_6] = -1;
      buf[PARTICLE_STRIDE + S.BOND_PARTNER_3] = -1; buf[PARTICLE_STRIDE + S.BOND_PARTNER_4] = -1;
      buf[PARTICLE_STRIDE + S.BOND_PARTNER_5] = -1; buf[PARTICLE_STRIDE + S.BOND_PARTNER_6] = -1;
      const f = applyPolymer(lawsOn('POLYMER'), buf, 0, PARTICLE_STRIDE, 5, 0, 0, 5, 1, PARTICLE_STRIDE);
      expect(buf[S.BOND_COUNT]).toBe(1);
      expect(buf[S.BOND_PARTNER_1]).toBe(1); // i records j
      expect(buf[PARTICLE_STRIDE + S.BOND_COUNT]).toBe(1);
      expect(buf[PARTICLE_STRIDE + S.BOND_PARTNER_1]).toBe(0); // j records i
      expect(f.ax).toBeCloseTo(0.02, 5); // stiffness 0.02 × (5 − restLen 4)
      expect(f.ay).toBe(0);
      expect(f.az).toBe(0);
    });

    it('caps at the documented 6 bonds per particle', () => {
      const buf = view(10);
      buf[S.POS_X] = 100;
      buf[S.BOND_COUNT] = 6;
      const slots = [S.BOND_PARTNER_1, S.BOND_PARTNER_2, S.BOND_PARTNER_3,
        S.BOND_PARTNER_4, S.BOND_PARTNER_5, S.BOND_PARTNER_6];
      for (let s = 0; s < 6; s++) buf[slots[s]] = s + 1;
      // 7th candidate (index 9) at dist 5
      const seventh = 9 * PARTICLE_STRIDE;
      buf[seventh + S.POS_X] = 105;
      applyPolymer(lawsOn('POLYMER'), buf, 0, seventh, 5, 0, 0, 5, 1, PARTICLE_STRIDE);
      expect(buf[S.BOND_COUNT]).toBe(6);
      // No slot was overwritten with the 7th index.
      expect(slots.map((slot) => buf[slot])).not.toContain(9);
    });

    it('integration: solve() wires mutual bond formation between close particles', () => {
      const world = makeWorld(2);
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 105;
      solve(world.view, 2, PARTICLE_STRIDE, lawsOn('POLYMER'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[S.BOND_COUNT]).toBe(1);
      expect(world.view[S.BOND_PARTNER_1]).toBe(1);
      expect(world.view[PARTICLE_STRIDE + S.BOND_COUNT]).toBe(1);
      expect(world.view[PARTICLE_STRIDE + S.BOND_PARTNER_1]).toBe(0);
    });
  });

  describe('ISOMERIZATION (22)', () => {
    // A 3-bond particle: partners 1, 2, 3 (particle 1 records back to 0).
    function threeBondWorld() {
      const buf = view(4);
      buf[S.ENERGY] = 100;
      buf[S.BOND_COUNT] = 3;
      buf[S.BOND_PARTNER_1] = 1;
      buf[S.BOND_PARTNER_2] = 2;
      buf[S.BOND_PARTNER_3] = 3;
      buf[PARTICLE_STRIDE + S.BOND_COUNT] = 1;
      buf[PARTICLE_STRIDE + S.BOND_PARTNER_1] = 0;
      return buf;
    }

    it('gates: bonds unchanged without the law', () => {
      const buf = threeBondWorld();
      applyIsomerization(createLawState(), buf, 0, 1, 1, () => 0.001, PARTICLE_STRIDE);
      expect(buf[S.BOND_COUNT]).toBe(3);
      expect(buf[S.BOND_PARTNER_1]).toBe(1);
    });

    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('ISOMERIZATION'), LAW_INDEXES.ISOMERIZATION)).toBe(true);
    });

    it('rearranges bonds at 3+ bonds: breaks one and clears the reciprocal', () => {
      const buf = threeBondWorld();
      applyIsomerization(lawsOn('ISOMERIZATION'), buf, 0, 1, 1, () => 0.001, PARTICLE_STRIDE);
      expect(buf[S.BOND_COUNT]).toBe(2);
      expect(buf[S.BOND_PARTNER_1]).toBe(-1); // partner 1 was released
      expect(buf[PARTICLE_STRIDE + S.BOND_COUNT]).toBe(0); // reciprocal cleared
      expect(buf[PARTICLE_STRIDE + S.BOND_PARTNER_1]).toBe(-1);
      expect(buf[S.ENERGY]).toBeCloseTo(99.5, 5); // consumes energy
    });

    it('is inert below 3 bonds even when the chance fires', () => {
      const buf = view(2);
      buf[S.ENERGY] = 100;
      buf[S.BOND_COUNT] = 2;
      buf[S.BOND_PARTNER_1] = 1;
      buf[PARTICLE_STRIDE + S.BOND_COUNT] = 1;
      buf[PARTICLE_STRIDE + S.BOND_PARTNER_1] = 0;
      applyIsomerization(lawsOn('ISOMERIZATION'), buf, 0, 1, 1, () => 0.001, PARTICLE_STRIDE);
      expect(buf[S.BOND_COUNT]).toBe(2);
      expect(buf[S.ENERGY]).toBe(100);
    });

    it('integration: solve() breaks a 3-bond chain over time (low PRNG)', () => {
      const world = makeWorld(4);
      world.view[S.ENERGY] = 100;
      world.view[S.BOND_COUNT] = 3;
      world.view[S.BOND_PARTNER_1] = 1;
      world.view[S.BOND_PARTNER_2] = 2;
      world.view[S.BOND_PARTNER_3] = 3;
      world.view[PARTICLE_STRIDE + S.BOND_COUNT] = 1;
      world.view[PARTICLE_STRIDE + S.BOND_PARTNER_1] = 0;
      for (let t = 0; t < 20; t++) solve(world.view, 4, PARTICLE_STRIDE, lawsOn('ISOMERIZATION'), world.dna, WORLD, DT, () => 0.001);
      expect(world.view[S.BOND_COUNT]).toBeLessThan(3);
    });
  });

  describe('CHIRALITY (23)', () => {
    it('gates: returns null without the law', () => {
      const buf = view(2);
      buf[S.DNA_CACHE_START + 2] = 1; // TORQUE
      buf[PARTICLE_STRIDE + S.DNA_CACHE_START + 2] = 1;
      expect(applyChirality(createLawState(), buf, 0, PARTICLE_STRIDE, 3, 4, 0, 5, 1)).toBeNull();
    });

    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('CHIRALITY'), LAW_INDEXES.CHIRALITY)).toBe(true);
    });

    it('deflects same-handedness (TORQUE) pairs perpendicular to the separation', () => {
      const buf = view(2);
      buf[S.DNA_CACHE_START + 2] = 1;
      buf[PARTICLE_STRIDE + S.DNA_CACHE_START + 2] = 1;
      const f = applyChirality(lawsOn('CHIRALITY'), buf, 0, PARTICLE_STRIDE, 3, 4, 0, 5, 1);
      expect(f.ax).toBeCloseTo(-0.008, 5); // −dy·invDist·0.01 · dir(+1)
      expect(f.ay).toBeCloseTo(0.006, 5);  //  dx·invDist·0.01 · dir(+1)
      expect(f.az).toBe(0);
    });

    it('mirror handedness deflects the opposite way (negative TORQUE)', () => {
      const buf = view(2);
      buf[S.DNA_CACHE_START + 2] = -1;
      buf[PARTICLE_STRIDE + S.DNA_CACHE_START + 2] = -1;
      const f = applyChirality(lawsOn('CHIRALITY'), buf, 0, PARTICLE_STRIDE, 3, 4, 0, 5, 1);
      expect(f.ax).toBeCloseTo(0.008, 5);
      expect(f.ay).toBeCloseTo(-0.006, 5);
    });

    it('returns null for opposite-handedness pairs', () => {
      const buf = view(2);
      buf[S.DNA_CACHE_START + 2] = 1;
      buf[PARTICLE_STRIDE + S.DNA_CACHE_START + 2] = -1;
      expect(applyChirality(lawsOn('CHIRALITY'), buf, 0, PARTICLE_STRIDE, 3, 4, 0, 5, 1)).toBeNull();
    });

    it('returns null when either particle has no handedness (torque 0)', () => {
      const buf = view(2);
      buf[S.DNA_CACHE_START + 2] = 0;
      buf[PARTICLE_STRIDE + S.DNA_CACHE_START + 2] = 1;
      expect(applyChirality(lawsOn('CHIRALITY'), buf, 0, PARTICLE_STRIDE, 3, 4, 0, 5, 1)).toBeNull();
    });
  });
});
