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
  applyTrailWrite,
  applyStigmergyForce,
  applySignalBoost,
  applyLearnAlign,
  applySymbolForce,
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

describe('Batch 18 audit — STIGMERGY / SIGNAL_BOOST / LEARN / SYMBOL', () => {
  describe('STIGMERGY (68)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('STIGMERGY'), LAW_INDEXES.STIGMERGY)).toBe(true);
    });

    it('writes a predicted-path trail marker (pos + vel × 8)', () => {
      const b = buf(1);
      applyTrailWrite(0, 100, 100, 100, 1, 0, 0);
      expect(b[S.TRAIL_X]).toBe(108);
      expect(b[S.TRAIL_Y]).toBe(100);
      expect(b[S.TRAIL_Z]).toBe(100);
    });

    it('evaporates a stopped particle\'s trail back toward it', () => {
      const b = buf(1);
      b[S.POS_X] = 100;
      b[S.TRAIL_X] = 108;
      applyTrailWrite(0, 100, 100, 100, 0, 0, 0); // stopped → no new marker
      expect(b[S.TRAIL_X]).toBeCloseTo(107.36, 5); // 108 + (100−108)·0.08
    });

    it('follows a fresh trail marker along the pheromone gradient', () => {
      const b = buf(2);
      b[S.POS_X] = 100;
      b[PARTICLE_STRIDE + S.POS_X] = 100; // owner here → marker 8 ahead is fresh
      b[PARTICLE_STRIDE + S.TRAIL_X] = 108;
      const f = applyStigmergyForce(0, PARTICLE_STRIDE, 0.3);
      expect(f.ax).toBeGreaterThan(0);
      expect(f.ax).toBeLessThan(0.3); // gradient falloff, not constant strength
    });

    it('stale markers (far from their owner) pull weaker than fresh ones', () => {
      const fresh = buf(2);
      fresh[S.POS_X] = 100;
      fresh[PARTICLE_STRIDE + S.POS_X] = 100; // owner here → marker 8 ahead is fresh
      fresh[PARTICLE_STRIDE + S.TRAIL_X] = 108;
      const fFresh = applyStigmergyForce(0, PARTICLE_STRIDE, 0.3);
      const stale = buf(2);
      stale[S.POS_X] = 100;
      stale[PARTICLE_STRIDE + S.POS_X] = 0; // marker 108 units from owner = evaporated
      stale[PARTICLE_STRIDE + S.TRAIL_X] = 108;
      const fStale = applyStigmergyForce(0, PARTICLE_STRIDE, 0.3);
      expect(fFresh.ax).toBeGreaterThan(fStale.ax);
    });

    it('integration: solve() steers toward a pre-existing trail marker', () => {
      const world = makeWorld(2);
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.TRAIL_X] = 108; // pre-seeded trail east of both
      solve(world.view, 2, PARTICLE_STRIDE, lawsOn('STIGMERGY'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[S.VEL_X]).toBeGreaterThan(0); // follower pulled toward trail
    });
  });

  describe('SIGNAL_BOOST (69)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('SIGNAL_BOOST'), LAW_INDEXES.SIGNAL_BOOST)).toBe(true);
    });

    it('relays a strong signal scaled by SIGNAL_STRENGTH (s1 0.5, strength 0.5, k 0.08 → +0.03)', () => {
      const b = buf(2);
      b[S.SIGNAL] = 0.5;
      b[S.DNA_CACHE_START + D.SIGNAL_STRENGTH] = 0.5; // default → ×0.75
      applySignalBoost(0, PARTICLE_STRIDE, 0.08);
      expect(b[PARTICLE_STRIDE + S.SIGNAL]).toBeCloseTo(0.03, 5);
    });

    it('stronger emitters relay more (strength 1.0 → ×1.0, strength 0 → ×0.5)', () => {
      const strong = buf(2);
      strong[S.SIGNAL] = 0.5;
      strong[S.DNA_CACHE_START + D.SIGNAL_STRENGTH] = 1.0;
      applySignalBoost(0, PARTICLE_STRIDE, 0.08);
      const weak = buf(2);
      weak[S.SIGNAL] = 0.5;
      weak[S.DNA_CACHE_START + D.SIGNAL_STRENGTH] = 0.0;
      applySignalBoost(0, PARTICLE_STRIDE, 0.08);
      expect(strong[PARTICLE_STRIDE + S.SIGNAL]).toBeCloseTo(0.04, 5);
      expect(weak[PARTICLE_STRIDE + S.SIGNAL]).toBeCloseTo(0.02, 5);
    });

    it('does nothing for silent particles', () => {
      const b = buf(2);
      applySignalBoost(0, PARTICLE_STRIDE, 0.08);
      expect(b[PARTICLE_STRIDE + S.SIGNAL]).toBe(0);
    });

    it('integration: solve() propagates a signal to a quiet neighbour', () => {
      const world = makeWorld(2);
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 102;
      world.view[S.SIGNAL] = 0.5;
      solve(world.view, 2, PARTICLE_STRIDE, lawsOn('SIGNAL_BOOST'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[PARTICLE_STRIDE + S.SIGNAL]).toBeGreaterThan(0);
    });
  });

  describe('LEARN (70)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('LEARN'), LAW_INDEXES.LEARN)).toBe(true);
    });

    it('aligns velocity toward the neighbour (v1 0 → 10, k 0.05 → +0.05)', () => {
      const b = buf(2);
      b[PARTICLE_STRIDE + S.VEL_X] = 10;
      applyLearnAlign(0, PARTICLE_STRIDE, 0.05);
      expect(b[S.VEL_X]).toBeCloseTo(0.05, 5);
    });

    it('integration: solve() steers a stationary particle toward its neighbour velocity', () => {
      const world = makeWorld(2);
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 102;
      world.view[PARTICLE_STRIDE + S.VEL_X] = 10;
      solve(world.view, 2, PARTICLE_STRIDE, lawsOn('LEARN'), world.dna, WORLD, DT, () => 0.5);
      expect(world.view[S.VEL_X]).toBeGreaterThan(0);
      expect(world.view[S.VEL_X]).toBeLessThan(10);
    });
  });

  describe('SYMBOL (71)', () => {
    it('is flagged when the law is set', () => {
      expect(isSet(lawsOn('SYMBOL'), LAW_INDEXES.SYMBOL)).toBe(true);
    });

    it('attracts same-token pairs by shared meaning (dx 3, dist 5 → ax ≈ 0.0045)', () => {
      const b = buf(2);
      b[S.SYMBOL_TOKEN] = 0.5;   // bin 4
      b[PARTICLE_STRIDE + S.SYMBOL_TOKEN] = 0.5; // bin 4
      const f = applySymbolForce(0, PARTICLE_STRIDE, 3, 0, 0, 5, 0.3);
      // force = 0.15·k/(dist+1) = 0.0075; ax = dx/dist · force ≈ 0.0045
      expect(f.ax).toBeCloseTo(0.0045, 4);
    });

    it('repels different-token pairs weakly (dx 3, dist 5 → ax ≈ −0.0015)', () => {
      const b = buf(2);
      b[S.SYMBOL_TOKEN] = 0;     // bin 0
      b[PARTICLE_STRIDE + S.SYMBOL_TOKEN] = 1; // bin 7
      const f = applySymbolForce(0, PARTICLE_STRIDE, 3, 0, 0, 5, 0.3);
      // force = −0.05·k/(dist+1) = −0.0025; ax = dx/dist · force ≈ −0.0015
      expect(f.ax).toBeCloseTo(-0.0015, 4);
    });

    it('imprints the higher-MEMORY partner’s token on contact', () => {
      const b = buf(2);
      b[S.MEMORY] = 1;
      b[PARTICLE_STRIDE + S.MEMORY] = 0;
      b[S.SYMBOL_TOKEN] = 0.5;   // bin 4 — the teacher
      b[PARTICLE_STRIDE + S.SYMBOL_TOKEN] = 0;
      applySymbolForce(0, PARTICLE_STRIDE, 1, 0, 0, 1, 1); // dist 1 < rSum + 0.5
      expect(b[PARTICLE_STRIDE + S.SYMBOL_TOKEN]).toBeCloseTo(4 / 7 * 0.2, 5); // learn = |1−0|·0.2
    });

    it('integration: solve() pulls same-species flockmates together', () => {
      const world = makeWorld(2, { species: 0 });
      world.view[S.POS_X] = 100;
      world.view[PARTICLE_STRIDE + S.POS_X] = 110;
      world.view[S.DNA_CACHE_START + D.SPECIES_AFFINITY] = 1;
      world.view[PARTICLE_STRIDE + S.DNA_CACHE_START + D.SPECIES_AFFINITY] = 1;
      const d0 = world.view[PARTICLE_STRIDE + S.POS_X] - world.view[S.POS_X];
      for (let t = 0; t < 40; t++) {
        solve(world.view, 2, PARTICLE_STRIDE, lawsOn('SYMBOL'), world.dna, WORLD, DT, () => 0.5);
      }
      const d1 = world.view[PARTICLE_STRIDE + S.POS_X] - world.view[S.POS_X];
      expect(d1).toBeLessThan(d0);
    });
  });
});
