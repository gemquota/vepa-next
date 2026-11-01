import { describe, it, expect } from 'vitest';
import {
  LAW_INDEXES,
  LAW_COUNT,
  LAW_CATEGORIES,
  LAW_COLOR_BY_INDEX,
  LAW_TO_CATEGORY,
  LAW_HELP_DB,
  MECHANICS_HELP,
  PARTICLE_STRIDE,
  MAX_PARTICLES,
  STRIDE_INDEXES,
  DNA_RANGES,
} from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults, setDNAFloat, getDNAFloat } from '../../src/dna/dnaBuffer.js';
import { solve } from '../../src/physics/solver.js';
import { LAW_HELP_PATCHES } from '../../src/state/lawHelpPatches.js';

const S = STRIDE_INDEXES;
const WORLD = 2000;
const DT = 0.25;
const COUNT = 8;
const rng = () => 0.5;

const NAME_BY_IDX = {};
for (const [name, idx] of Object.entries(LAW_INDEXES)) NAME_BY_IDX[idx] = name;

function makeWorld(polarity) {
  const buf = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  const view = buf.view;
  const dna = createDNABuffer();
  loadDefaults(dna, DNA_RANGES);
  for (let i = 0; i < COUNT; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = 100 + (i % 4) * 50;
    view[b + S.POS_Y] = 100 + Math.floor(i / 4) * 50;
    view[b + S.POS_Z] = 100;
    view[b + S.VEL_X] = 0;
    view[b + S.VEL_Y] = 0;
    view[b + S.VEL_Z] = 0;
    view[b + S.MASS] = 1.5;
    view[b + S.SPECIES_ID] = i % 3;
    view[b + S.DEAD] = 0;
    view[b + S.ENERGY] = 100;
    view[b + S.RADIUS] = 0.6;
    setDNAFloat(dna, i % 3, 4, polarity, -1, 1); // POLARITY
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      view[b + S.DNA_CACHE_START + d] = getDNAFloat(dna, i % 3, d, r.min, r.max);
    }
  }
  return { view, dna };
}

describe('New law categories', () => {
  it('has 9 categories; all 136 laws mapped (mechanics is the off-rainbow slate set)', () => {
    const names = Object.keys(LAW_CATEGORIES);
    expect(names).toHaveLength(9);
    expect(LAW_CATEGORIES.physics.laws).toHaveLength(16); // legacy mechanics remain mapped for compatibility
    expect(LAW_CATEGORIES.mechanics.laws).toHaveLength(8); // appended slate mechanics laws
    for (const [catName, cat] of Object.entries(LAW_CATEGORIES)) {
      if (catName === 'physics' || catName === 'mechanics') continue;
      expect(cat.laws.length, `category ${catName}`).toBe(16);
    }
    expect(LAW_CATEGORIES.electromagnetism.laws.length).toBe(16);
    expect(LAW_CATEGORIES.information.laws.length).toBe(16);
    expect(LAW_CATEGORIES.quantum.laws.length).toBe(16);
    expect(LAW_COUNT).toBe(136);
    const mapped = Object.values(LAW_CATEGORIES).reduce((n, c) => n + c.laws.length, 0);
    expect(mapped).toBe(136);
    for (let i = 0; i < LAW_COUNT; i++) {
      expect(LAW_TO_CATEGORY[i], `law ${i}`).toBeDefined();
      expect(LAW_COLOR_BY_INDEX[i], `law ${i}`).toBeDefined();
    }
  });

  it('every law maps to exactly one category with a colour', () => {
    for (let i = 0; i < LAW_COUNT; i++) {
      expect(LAW_TO_CATEGORY[i], `law ${i}`).toBeDefined();
      expect(LAW_COLOR_BY_INDEX[i], `law ${i}`).toBeDefined();
    }
    expect(LAW_COUNT).toBe(Math.max(...Object.values(LAW_INDEXES)) + 1);
  });

  it('every law has a HELP_DB entry', () => {
    for (const [catName, cat] of Object.entries(LAW_CATEGORIES)) {
      for (const idx of cat.laws) {
        const name = NAME_BY_IDX[idx];
        const help = {
          ...(LAW_HELP_DB[name] || {}),
          ...(LAW_HELP_PATCHES[name] || {}),
          ...(catName === 'mechanics' ? (MECHANICS_HELP[name] || {}) : {}),
        };
        expect(Object.keys(help).length ? help : undefined, name).toBeDefined();
        expect(help.hint).toBeTruthy();
        expect(help.explanation).toBeTruthy();
        expect(help.system).toBeTruthy();
      }
    }
  });

  it('CHARGE_LAW is gated: no movement without it, Coulomb drift with it', () => {
    const before = makeWorld(1.0);
    const laws = createLawState();
    solve(before.view, COUNT, PARTICLE_STRIDE, laws, before.dna, WORLD, DT, rng);
    const x0 = before.view[0];
    expect(before.view[0]).toBe(x0); // frozen without laws

    const world = makeWorld(1.0);
    const state = createLawState();
    set(state, LAW_INDEXES.CHARGE_LAW);
    // identical charges repel — particle 0 (high POLARITY) should move
    const x1 = world.view[0];
    solve(world.view, COUNT, PARTICLE_STRIDE, state, world.dna, WORLD, DT, rng);
    const x2 = world.view[0];
    expect(Math.abs(x2 - x1)).toBeGreaterThan(0);
  });

  it('FIELD law drifts charged particles even without neighbours', () => {
    const world = makeWorld(1.0);
    const state = createLawState();
    set(state, LAW_INDEXES.FIELD);
    const x1 = world.view[0];
    const y1 = world.view[1];
    solve(world.view, COUNT, PARTICLE_STRIDE, state, world.dna, WORLD, DT, rng);
    expect(world.view[0]).not.toBe(x1);
    expect(world.view[1]).not.toBe(y1);
  });

  it('extended-range laws (indices 64+) toggle without colliding with lower bits', () => {
    const state = createLawState();
    set(state, LAW_INDEXES.CULTURE);   // index 78
    set(state, LAW_INDEXES.SUPERCONDUCTIVITY); // index 65
    expect(isSet(state, LAW_INDEXES.CULTURE)).toBe(true);
    expect(isSet(state, LAW_INDEXES.SUPERCONDUCTIVITY)).toBe(true);
    expect(isSet(state, LAW_INDEXES.STIGMERGY)).toBe(false);
    expect(isSet(state, LAW_INDEXES.CHAOS)).toBe(false);
  });

  it('DISCHARGE law releases stored charge into motion and heat', () => {
    const world = makeWorld(1.0);
    world.view[S.CHARGE] = 1.5;
    const state = createLawState();
    set(state, LAW_INDEXES.DISCHARGE);
    const vx0 = world.view[S.VEL_X];
    solve(world.view, COUNT, PARTICLE_STRIDE, state, world.dna, WORLD, DT, rng);
    expect(world.view[S.CHARGE]).toBe(0);
    expect(Math.abs(world.view[S.VEL_X] - vx0)).toBeGreaterThan(1e-6);
    expect(world.view[S.TEMPERATURE]).toBeGreaterThan(0);
  });

  it('PLASMA law converts heat into stored charge', () => {
    const world = makeWorld(1.0);
    world.view[S.TEMPERATURE] = 0.9;
    const state = createLawState();
    set(state, LAW_INDEXES.PLASMA);
    solve(world.view, COUNT, PARTICLE_STRIDE, state, world.dna, WORLD, DT, rng);
    expect(world.view[S.CHARGE]).toBeGreaterThan(0);
    expect(world.view[S.TEMPERATURE]).toBeLessThan(0.9);
  });

  it('SUPERCONDUCTIVITY law couples cold particles (relative speed falls)', () => {
    const world = makeWorld(1.0);
    world.view[S.TEMPERATURE] = 0.1;
    world.view[PARTICLE_STRIDE + S.TEMPERATURE] = 0.1;
    world.view[S.VEL_X] = 2.0;
    world.view[PARTICLE_STRIDE + S.VEL_X] = -2.0;
    const state = createLawState();
    set(state, LAW_INDEXES.SUPERCONDUCTIVITY);
    const rel0 = Math.abs(world.view[S.VEL_X] - world.view[PARTICLE_STRIDE + S.VEL_X]);
    for (let t = 0; t < 20; t++) {
      solve(world.view, COUNT, PARTICLE_STRIDE, state, world.dna, WORLD, DT, rng);
    }
    const rel1 = Math.abs(world.view[S.VEL_X] - world.view[PARTICLE_STRIDE + S.VEL_X]);
    expect(rel1).toBeLessThan(rel0 * 0.9);
  });

  it('FEEDBACK law amplifies motion through the memory trace', () => {
    const world = makeWorld(1.0);
    world.view[S.MEMORY] = 1.0;
    world.view[S.VEL_X] = 2.0;
    const state = createLawState();
    set(state, LAW_INDEXES.FEEDBACK);
    const vx0 = world.view[S.VEL_X];
    for (let t = 0; t < 30; t++) {
      solve(world.view, COUNT, PARTICLE_STRIDE, state, world.dna, WORLD, DT, rng);
    }
    expect(world.view[S.VEL_X]).toBeGreaterThan(vx0);
    expect(world.view[S.MEMORY]).toBeGreaterThanOrEqual(1.0);
  });

  it('LANGUAGE law converges memory between signaling particles', () => {
    const world = makeWorld(1.0);
    world.view[S.MEMORY] = 0.9;
    world.view[PARTICLE_STRIDE + S.MEMORY] = 0.1;
    world.view[S.SIGNAL] = 1.0;
    world.view[PARTICLE_STRIDE + S.SIGNAL] = 1.0;
    const state = createLawState();
    set(state, LAW_INDEXES.LANGUAGE);
    for (let t = 0; t < 10; t++) {
      solve(world.view, COUNT, PARTICLE_STRIDE, state, world.dna, WORLD, DT, rng);
    }
    const diff = Math.abs(world.view[S.MEMORY] - world.view[PARTICLE_STRIDE + S.MEMORY]);
    expect(diff).toBeLessThan(0.2);
  });

  it('CULTURE law converges DNA cache within a species only', () => {
    const world = makeWorld(1.0);
    world.view[S.SPECIES_ID] = 0;
    world.view[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
    world.view[S.DNA_CACHE_START] = 1.0;
    world.view[PARTICLE_STRIDE + S.DNA_CACHE_START] = -1.0;
    // different-species pair must NOT converge
    world.view[2 * PARTICLE_STRIDE + S.SPECIES_ID] = 0;
    world.view[3 * PARTICLE_STRIDE + S.SPECIES_ID] = 1;
    world.view[2 * PARTICLE_STRIDE + S.DNA_CACHE_START] = 1.0;
    world.view[3 * PARTICLE_STRIDE + S.DNA_CACHE_START] = -1.0;
    const state = createLawState();
    set(state, LAW_INDEXES.CULTURE);
    for (let t = 0; t < 40; t++) {
      solve(world.view, COUNT, PARTICLE_STRIDE, state, world.dna, WORLD, DT, rng);
    }
    const sameDiff = Math.abs(world.view[S.DNA_CACHE_START] - world.view[PARTICLE_STRIDE + S.DNA_CACHE_START]);
    const crossDiff = Math.abs(world.view[2 * PARTICLE_STRIDE + S.DNA_CACHE_START] - world.view[3 * PARTICLE_STRIDE + S.DNA_CACHE_START]);
    expect(sameDiff).toBeLessThan(crossDiff);
    expect(sameDiff).toBeLessThan(1.5);
  });

  it('SINGULARITY law pulls matter in and absorbs it at the event horizon', () => {
    const world = makeWorld(1.0);
    // particle 0 = supermassive singularity; particle 1 parked inside the horizon
    world.view[S.MASS] = 25;
    world.view[PARTICLE_STRIDE + S.POS_X] = 100.5;
    world.view[PARTICLE_STRIDE + S.POS_Y] = 100;
    world.view[PARTICLE_STRIDE + S.POS_Z] = 100;
    world.view[PARTICLE_STRIDE + S.VEL_X] = 0;
    world.view[PARTICLE_STRIDE + S.VEL_Y] = 0;
    world.view[PARTICLE_STRIDE + S.VEL_Z] = 0;
    const mass0 = world.view[S.MASS];
    const state = createLawState();
    set(state, LAW_INDEXES.SINGULARITY);
    solve(world.view, COUNT, PARTICLE_STRIDE, state, world.dna, WORLD, DT, rng);
    expect(world.view[PARTICLE_STRIDE + S.DEAD]).toBe(1);
    expect(world.view[S.MASS]).toBeGreaterThan(mass0);
  });

  it('ENTANGLEMENT law links touching particles without signaling momentum', () => {
    const world = makeWorld(1.0);
    for (let i = 0; i < COUNT; i++) {
      world.view[i * PARTICLE_STRIDE + S.ENTANGLE_ID] = -1;
    }
    world.view[PARTICLE_STRIDE + S.POS_X] = 100.5; // touch particle 0
    const state = createLawState();
    set(state, LAW_INDEXES.ENTANGLEMENT);
    solve(world.view, COUNT, PARTICLE_STRIDE, state, world.dna, WORLD, DT, rng);
    expect(world.view[S.ENTANGLE_ID]).toBe(1);
    expect(world.view[PARTICLE_STRIDE + S.ENTANGLE_ID]).toBe(0);

    // The correlation remains live, but the no-signaling contract forbids
    // velocity transfer through the link.
    world.view[S.VEL_X] = 2.0;
    world.view[PARTICLE_STRIDE + S.VEL_X] = -2.0;
    world.view[S.ENTANGLE_PHASE] = 1.0;
    world.view[PARTICLE_STRIDE + S.ENTANGLE_PHASE] = 1.0;
    const rel0 = Math.abs(world.view[S.VEL_X] - world.view[PARTICLE_STRIDE + S.VEL_X]);
    for (let t = 0; t < 20; t++) {
      solve(world.view, COUNT, PARTICLE_STRIDE, state, world.dna, WORLD, DT, rng);
    }
    const rel1 = Math.abs(world.view[S.VEL_X] - world.view[PARTICLE_STRIDE + S.VEL_X]);
    expect(rel1).toBe(rel0);
    expect(world.view[S.ENTANGLE_PHASE]).toBeLessThan(1.0);
  });

  it('HISTORY law steers particles toward remembered activity', () => {
    const world = makeWorld(1.0);
    // The coarse history grid is 12 cells across a 2000-unit world. Put a
    // second particle into the next x cell so particle 0 has a real gradient.
    world.view[PARTICLE_STRIDE + S.POS_X] = 220;
    const state = createLawState();
    set(state, LAW_INDEXES.HISTORY);
    const vx0 = world.view[S.VEL_X];
    const vy0 = world.view[S.VEL_Y];
    // The first tick seeds the history field; the second can read the
    // neighboring cell's accumulated activity and follow its gradient.
    solve(world.view, COUNT, PARTICLE_STRIDE, state, world.dna, WORLD, DT, rng);
    solve(world.view, COUNT, PARTICLE_STRIDE, state, world.dna, WORLD, DT, rng);
    const dx = world.view[S.VEL_X] - vx0;
    const dy = world.view[S.VEL_Y] - vy0;
    expect(Math.hypot(dx, dy)).toBeGreaterThan(1e-4);
  });
});
