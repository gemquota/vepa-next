// Batch 13 (RRP) — CLAIRVOYANCE(48) / PRECOGNITION(49) / ASTRAL(50) / PREDATION(51)
// Confirmed spec (2026-08-06): 1. CLAIRVOYANCE slight energy cost.
// 2. PRECOGNITION ditto (slight cost). 3. ASTRAL keep ghosting + expansions
// (soul-pull on the living + same-species soul blessing). 4. PREDATION keep
// jitter flee, always match docs → cross-species only + PRNG trait sampling.
import { describe, it, expect } from 'vitest';
import {
  LAW_INDEXES,
  PARTICLE_STRIDE,
  MAX_PARTICLES,
  STRIDE_INDEXES as S,
  DNA_INDEXES as D,
  DNA_RANGES,
} from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults, getDNAFloat } from '../../src/dna/dnaBuffer.js';
import { solve } from '../../src/physics/solver.js';
import { applyClairvoyance, applyPrecognition } from '../../src/physics/laws.js';

const WORLD = 2000;
const DT = 0.25;
const rng = () => 0.5; // deterministic PRNG → trait 21 is sampled every time

function makeWorld(count = 2) {
  const buf = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  const view = buf.view;
  const dna = createDNABuffer();
  loadDefaults(dna, DNA_RANGES);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = 100;
    view[b + S.POS_Y] = 100;
    view[b + S.POS_Z] = 100;
    view[b + S.VEL_X] = 0;
    view[b + S.VEL_Y] = 0;
    view[b + S.VEL_Z] = 0;
    view[b + S.MASS] = 1.5;
    view[b + S.SPECIES_ID] = i;
    view[b + S.DEAD] = 0;
    view[b + S.ENERGY] = 100;
    view[b + S.RADIUS] = 0.6;
    view[b + S.SIGNAL] = 0;
    view[b + S.MEMORY] = 0;
    view[b + S.CHARGE] = 0;
    view[b + S.TEMPERATURE] = 0;
    view[b + S.SOUL] = 0;
    view[b + S.ALPHA] = 1;
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      view[b + S.DNA_CACHE_START + d] = getDNAFloat(dna, i, d, r.min, r.max);
    }
  }
  return { view, dna };
}

function setDNA(view, idx, dnaIndex, value) {
  view[idx * PARTICLE_STRIDE + S.DNA_CACHE_START + dnaIndex] = value;
}

describe('Batch 13 — CLAIRVOYANCE / PRECOGNITION / ASTRAL / PREDATION', () => {
  it('CLAIRVOYANCE steers toward the predicted future position at a slight energy cost', () => {
    const { view } = makeWorld(2);
    view[S.POS_X] = 100;
    view[S.POS_Y] = 100;
    view[PARTICLE_STRIDE + S.POS_X] = 100;
    view[PARTICLE_STRIDE + S.POS_Y] = 110; // neighbor directly above (+y)
    view[PARTICLE_STRIDE + S.VEL_X] = 5;   // ...but moving fast in +x
    const state = createLawState();
    set(state, LAW_INDEXES.CLAIRVOYANCE);
    expect(isSet(state, LAW_INDEXES.CLAIRVOYANCE)).toBe(true);

    // Direct call: offset (0,10,0), neighbor vx=5 → force must point +x and
    // the seer pays a slight energy cost (0.02 × synergy × dt).
    const f = applyClairvoyance(state, view, 0, PARTICLE_STRIDE, 0, 10, 0, 10, 1.0, 1.0);
    expect(f).not.toBeNull();
    expect(f.ax).toBeGreaterThan(0);   // toward predicted future x
    expect(Math.abs(f.ay)).toBeLessThan(1e-6);
    expect(view[S.ENERGY]).toBeCloseTo(99.98, 5); // 100 − 0.02×1×1

    // Gate: law off → no force, no drain
    expect(applyClairvoyance(createLawState(), view, 0, PARTICLE_STRIDE, 0, 10, 0, 10, 1.0, 1.0)).toBeNull();

    // Integration: velocity drifts +x across ticks and energy drains
    const w = makeWorld(2);
    w.view[PARTICLE_STRIDE + S.POS_X] = 100;
    w.view[PARTICLE_STRIDE + S.POS_Y] = 110;
    w.view[PARTICLE_STRIDE + S.VEL_X] = 5;
    const st = createLawState();
    set(st, LAW_INDEXES.CLAIRVOYANCE);
    for (let t = 0; t < 40; t++) solve(w.view, 2, PARTICLE_STRIDE, st, w.dna, WORLD, DT, rng);
    expect(w.view[S.VEL_X]).toBeGreaterThan(0.005);
    expect(w.view[S.ENERGY]).toBeLessThan(100);
  });

  it('PRECOGNITION dodges collisions laterally at a slight energy cost', () => {
    const { view } = makeWorld(2);
    view[S.POS_X] = 100; view[S.VEL_X] = 1;        // i moves +x
    view[PARTICLE_STRIDE + S.POS_X] = 110;          // j ahead
    view[PARTICLE_STRIDE + S.VEL_X] = -1;           // j moves -x → closing
    const state = createLawState();
    set(state, LAW_INDEXES.PRECOGNITION);
    expect(isSet(state, LAW_INDEXES.PRECOGNITION)).toBe(true);

    const f = applyPrecognition(state, view, 0, PARTICLE_STRIDE, 10, 0, 0, 10, 1.0, 1.0);
    expect(f).not.toBeNull();
    expect(f.ay).toBeGreaterThan(0);   // lateral (perpendicular) avoidance
    expect(Math.abs(f.ax)).toBeLessThan(1e-6);
    expect(view[S.ENERGY]).toBeCloseTo(99.98, 5); // slight cost

    // Gates: no law → null; moving apart (dot > 0) → null and no drain
    expect(applyPrecognition(createLawState(), view, 0, PARTICLE_STRIDE, 10, 0, 0, 10, 1.0, 1.0)).toBeNull();
    view[PARTICLE_STRIDE + S.VEL_X] = 2; // j moves away faster → dot > 0
    expect(applyPrecognition(state, view, 0, PARTICLE_STRIDE, 10, 0, 0, 10, 1.0, 1.0)).toBeNull();

    // Integration: closing pair acquires lateral velocity and pays energy
    const w = makeWorld(2);
    w.view[S.POS_X] = 100; w.view[S.VEL_X] = 1;
    w.view[PARTICLE_STRIDE + S.POS_X] = 110;
    w.view[PARTICLE_STRIDE + S.VEL_X] = -1;
    const st = createLawState();
    set(st, LAW_INDEXES.PRECOGNITION);
    for (let t = 0; t < 8; t++) solve(w.view, 2, PARTICLE_STRIDE, st, w.dna, WORLD, DT, rng);
    expect(w.view[S.VEL_Y]).toBeGreaterThan(0.001);
    expect(w.view[S.ENERGY]).toBeLessThan(100);
  });

  it('ASTRAL keeps souls as fading ghosts (DEAD=0.5 state preserved)', () => {
    const w = makeWorld(2);
    w.view[S.DEAD] = 0.5;          // soul
    w.view[S.SOUL] = 1.0;
    w.view[S.ALPHA] = 1.0;
    w.view[S.MASS] = 2.0;
    w.view[PARTICLE_STRIDE + S.POS_X] = 110; // living neighbour (other species)
    const state = createLawState();
    set(state, LAW_INDEXES.ASTRAL);
    expect(isSet(state, LAW_INDEXES.ASTRAL)).toBe(true);

    const soul0 = w.view[S.SOUL];
    solve(w.view, 2, PARTICLE_STRIDE, state, w.dna, WORLD, DT, rng);

    expect(w.view[S.DEAD]).toBe(0.5);                    // still a soul
    expect(w.view[S.ALPHA]).toBeCloseTo(soul0 * 0.5, 5); // ghost alpha
    expect(w.view[S.MASS]).toBeCloseTo(soul0 * 0.1, 5);  // ghost mass
    expect(w.view[S.SOUL]).toBeLessThan(soul0);          // fading
    expect(w.view[S.SOUL]).toBeGreaterThan(0.9);
  });

  it('ASTRAL ghosts pull the living and bless same-species kin (soul conserved)', () => {
    const w = makeWorld(2);
    w.view[S.DEAD] = 0.5;          // ghost
    w.view[S.SOUL] = 1.0;
    w.view[S.SPECIES_ID] = 0;
    w.view[PARTICLE_STRIDE + S.SPECIES_ID] = 0;          // living kin, same species
    w.view[PARTICLE_STRIDE + S.POS_X] = 110;             // 10 units away
    w.view[PARTICLE_STRIDE + S.ENERGY] = 100;
    const state = createLawState();
    set(state, LAW_INDEXES.ASTRAL);

    solve(w.view, 2, PARTICLE_STRIDE, state, w.dna, WORLD, DT, rng);

    // Living kin is pulled toward the ghost (ghost at x=100 → −x velocity)
    expect(w.view[PARTICLE_STRIDE + S.VEL_X]).toBeLessThan(0);
    // Same-species blessing: living kin gains soul, ghost gives up a sliver
    expect(w.view[PARTICLE_STRIDE + S.SOUL]).toBeGreaterThan(0);
    expect(w.view[S.SOUL]).toBeLessThan(0.999); // fade + gift
    expect(w.view[S.SOUL]).toBeGreaterThan(0.98);
    // Ghost still persists as a soul
    expect(w.view[S.DEAD]).toBe(0.5);
  });

  it('PREDATION never hunts its own kind (cross-species only)', () => {
    const w = makeWorld(2);
    w.view[S.SPECIES_ID] = 0;                            // same species pair
    w.view[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
    w.view[S.MASS] = 5;
    w.view[PARTICLE_STRIDE + S.MASS] = 1;
    w.view[PARTICLE_STRIDE + S.POS_X] = 100.5;           // at contact
    setDNA(w.view, 0, D.PREDATION_BIAS, 10);
    const state = createLawState();
    set(state, LAW_INDEXES.PREDATION);

    solve(w.view, 2, PARTICLE_STRIDE, state, w.dna, WORLD, DT, rng);

    expect(w.view[S.VEL_X]).toBe(0);                     // no pursuit
    expect(w.view[PARTICLE_STRIDE + S.VEL_X]).toBe(0);   // no flee
    expect(w.view[S.MASS]).toBe(5);                      // no absorption
    expect(w.view[PARTICLE_STRIDE + S.MASS]).toBe(1);
  });

  it('PREDATION pursues lower-mass prey and absorbs PRNG-sampled DNA + mass on contact', () => {
    // Contact absorption: predator mass 5 vs prey mass 1 at dist 0.5
    const w = makeWorld(2);
    w.view[S.MASS] = 5;
    w.view[S.POS_X] = 100;
    w.view[PARTICLE_STRIDE + S.POS_X] = 100.5;
    w.view[PARTICLE_STRIDE + S.MASS] = 1;
    // Fill every predator trait with −1 and every prey trait with +1 so the
    // 5 PRNG-sampled absorbed traits are observable regardless of the locus.
    for (let d = 0; d < 42; d++) {
      w.view[S.DNA_CACHE_START + d] = -1;
      w.view[PARTICLE_STRIDE + S.DNA_CACHE_START + d] = 1;
    }
    setDNA(w.view, 0, D.PREDATION_BIAS, 10);
    const state = createLawState();
    set(state, LAW_INDEXES.PREDATION);
    expect(isSet(state, LAW_INDEXES.PREDATION)).toBe(true);

    const predMass0 = w.view[S.MASS];
    const preyMass0 = w.view[PARTICLE_STRIDE + S.MASS];
    let dnaSum0 = 0;
    for (let d = 0; d < 42; d++) dnaSum0 += w.view[S.DNA_CACHE_START + d];
    solve(w.view, 2, PARTICLE_STRIDE, state, w.dna, WORLD, DT, rng);

    // Gene absorption: 5 sampled traits each blend 5% toward prey (+1)
    let dnaSum1 = 0;
    for (let d = 0; d < 42; d++) dnaSum1 += w.view[S.DNA_CACHE_START + d];
    expect(dnaSum1).toBeGreaterThan(dnaSum0 + 0.2);
    // Mass transfer: predator gains, prey loses
    expect(w.view[S.MASS]).toBeGreaterThan(predMass0);
    expect(w.view[PARTICLE_STRIDE + S.MASS]).toBeLessThan(preyMass0);

    // Pursuit at distance: predator accelerates toward prey (+x)
    const w2 = makeWorld(2);
    w2.view[S.MASS] = 5;
    setDNA(w2.view, 0, D.PREDATION_BIAS, 20);
    w2.view[PARTICLE_STRIDE + S.POS_X] = 150;
    w2.view[PARTICLE_STRIDE + S.MASS] = 1;
    const st2 = createLawState();
    set(st2, LAW_INDEXES.PREDATION);
    for (let t = 0; t < 20; t++) solve(w2.view, 2, PARTICLE_STRIDE, st2, w2.dna, WORLD, DT, rng);
    expect(w2.view[S.VEL_X]).toBeGreaterThan(0.001);
  });
});
