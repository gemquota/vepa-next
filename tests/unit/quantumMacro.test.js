/**
 * Set N.1 — Quantum Macroscale (RRP L·M·N trilogy)
 * Tests deterministic superposition with collapse-on-interaction, macro
 * entanglement (stride 75–76), ENERGY-gated wall tunneling, and the
 * DNA-gated observer effect.
 */
import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES, DNA_INDEXES } from '../../src/constants.js';
import { createFieldSystem } from '../../src/physics/fields.js';
import {
  createQuantumState, stepQuantumMacro, quantumSummary,
  QUANTUM_CADENCE,
} from '../../src/state/quantumMacro.js';
import { WORLD_PARAM_DEFS, worldParamDef, clampWorldParam } from '../../src/state/worldParams.js';

const S = STRIDE_INDEXES;

function makeFields() {
  return createFieldSystem(2000, 12, {});
}

/** Alive particle at a position with energy/mass/velocity/species. */
function place(view, i, x, y, z, opts = {}) {
  const b = i * PARTICLE_STRIDE;
  view[b + S.POS_X] = x;
  view[b + S.POS_Y] = y;
  view[b + S.POS_Z] = z;
  view[b + S.VEL_X] = opts.vx ?? 0;
  view[b + S.VEL_Y] = opts.vy ?? 0;
  view[b + S.VEL_Z] = opts.vz ?? 0;
  view[b + S.DEAD] = 0;
  view[b + S.ENERGY] = opts.energy ?? 50;
  view[b + S.MASS] = opts.mass ?? 2;
  view[b + S.SPECIES_ID] = opts.species ?? 0;
  view[b + S.AGE] = opts.age ?? 0;
  view[b + S.ENTANGLE_ID] = opts.entangle ?? -1;
  view[b + S.ENTANGLE_PHASE] = opts.entPhase ?? 0;
  return view;
}

function makeView(count = 10) {
  const view = new Float32Array(count * PARTICLE_STRIDE);
  for (let i = 0; i < count; i++) view[i * PARTICLE_STRIDE + S.DEAD] = 1;
  return view;
}

/** Mark a particle as superposed with an alternate position. */
function superpose(state, view, i, alt, timer = 600) {
  state.superposed[i] = 1;
  state.timer[i] = timer;
  const b = i * PARTICLE_STRIDE;
  state.qx[i] = alt[0];
  state.qy[i] = alt[1];
  state.qz[i] = alt[2];
}

/** Link a macro-entangled pair (registry + stride projection). */
function entangle(state, view, a, b, phase = 0.5) {
  state.entangled[a] = b;
  state.entangled[b] = a;
  state.entPhase[a] = phase;
  state.entPhase[b] = phase;
  view[a * PARTICLE_STRIDE + S.ENTANGLE_ID] = b;
  view[b * PARTICLE_STRIDE + S.ENTANGLE_ID] = a;
  view[a * PARTICLE_STRIDE + S.ENTANGLE_PHASE] = phase;
  view[b * PARTICLE_STRIDE + S.ENTANGLE_PHASE] = phase;
}

/** Species genome buffer (64×64 Uint16) with a param set to its max. */
function makeDNA(maxParams = []) {
  const buf = new Uint16Array(64 * 64);
  for (const idx of maxParams) buf[idx] = 65535;
  return buf;
}

describe('Set N — cadence & state', () => {
  it('is gated on its cadence (force bypasses for tests)', () => {
    const state = createQuantumState(5);
    const view = makeView(5);
    const quiet = stepQuantumMacro(state, view, 5, PARTICLE_STRIDE, makeFields(), { tick: 1, worldParams: {} });
    expect(quiet.entered).toBe(0);
    const forced = stepQuantumMacro(state, view, 5, PARTICLE_STRIDE, makeFields(), { tick: 1, worldParams: {}, force: true });
    expect(forced).toHaveProperty('collapsed');
    expect(QUANTUM_CADENCE).toBe(15);
  });

  it('grows its arrays lazily to the particle count', () => {
    const state = createQuantumState(0);
    const view = makeView(10);
    stepQuantumMacro(state, view, 10, PARTICLE_STRIDE, makeFields(), { force: true, worldParams: { QUANTUM_SUPERPOSITION_RATE: 0 } });
    expect(state.superposed.length).toBe(10);
    expect(state.qx.length).toBe(10);
    expect(state.entangled.length).toBe(10);
  });

  it('clears superposition and entanglement when a particle dies', () => {
    const view = makeView(3);
    place(view, 0, 100, 100, 100);
    place(view, 1, 150, 100, 100);
    const state = createQuantumState(3);
    superpose(state, view, 0, [200, 100, 100]);
    entangle(state, view, 0, 1);
    view[PARTICLE_STRIDE + S.DEAD] = 1; // kill partner 1
    stepQuantumMacro(state, view, 3, PARTICLE_STRIDE, makeFields(), {
      force: true, worldParams: { QUANTUM_SUPERPOSITION_RATE: 0 },
    });
    expect(state.entangled[0]).toBe(-1);
    expect(view[S.ENTANGLE_ID]).toBe(-1);
  });
});

describe('Set N — superposition (N.1)', () => {
  it('enters superposition when slow and isolated (rate 1)', () => {
    const view = makeView(2);
    place(view, 0, 100, 100, 100);
    const state = createQuantumState(2);
    const res = stepQuantumMacro(state, view, 2, PARTICLE_STRIDE, makeFields(), {
      force: true, worldParams: { QUANTUM_SUPERPOSITION_RATE: 1 },
    });
    expect(res.entered).toBe(1);
    expect(state.superposed[0]).toBe(1);
    expect(state.qx[0]).not.toBe(100); // an alternate branch exists
    expect(quantumSummary(state).superposed).toBe(1);
  });

  it('does not enter when crowded, fast, or with rate 0', () => {
    const view = makeView(4);
    // Three close particles — each sees 2 neighbours within 120.
    place(view, 0, 100, 100, 100);
    place(view, 1, 110, 100, 100);
    place(view, 2, 120, 100, 100);
    place(view, 3, 500, 500, 500, { vx: 50 }); // fast + isolated
    const state = createQuantumState(4);
    const res = stepQuantumMacro(state, view, 4, PARTICLE_STRIDE, makeFields(), {
      force: true, worldParams: { QUANTUM_SUPERPOSITION_RATE: 1 },
    });
    expect(res.entered).toBe(0);
    expect(state.superposed[0]).toBe(0);
    expect(state.superposed[3]).toBe(0); // velocity gate
    const state2 = createQuantumState(2);
    const view2 = makeView(2);
    place(view2, 0, 100, 100, 100);
    stepQuantumMacro(state2, view2, 2, PARTICLE_STRIDE, makeFields(), {
      force: true, worldParams: { QUANTUM_SUPERPOSITION_RATE: 0 },
    });
    expect(state2.superposed[0]).toBe(0);
  });

  it('collapses to the current or alternate position on interaction', () => {
    const view = makeView(3);
    place(view, 0, 100, 100, 100);
    const state = createQuantumState(3);
    superpose(state, view, 0, [200, 100, 100], 600);
    // First pass: alone — stays superposed.
    stepQuantumMacro(state, view, 3, PARTICLE_STRIDE, makeFields(), {
      force: true, tick: 10, worldParams: { QUANTUM_SUPERPOSITION_RATE: 0 },
    });
    expect(state.superposed[0]).toBe(1);
    // Second pass: a neighbour arrives within the collapse radius.
    place(view, 1, 120, 100, 100);
    const res = stepQuantumMacro(state, view, 3, PARTICLE_STRIDE, makeFields(), {
      force: true, tick: 20, worldParams: { QUANTUM_SUPERPOSITION_RATE: 0, QUANTUM_COLLAPSE_RADIUS: 30 },
    });
    expect(res.collapsed).toBe(1);
    expect(state.superposed[0]).toBe(0);
    const x = view[S.POS_X];
    expect(x === 100 || x === 200).toBe(true); // resolved to one branch
    expect(res.events[0].type).toBe('quantum:collapse');
    expect(res.events[0].cause).toBe('interaction');
  });

  it('collapses on a speed burst and on lifetime expiry', () => {
    const view = makeView(2);
    place(view, 0, 100, 100, 100);
    place(view, 1, 400, 400, 400);
    const state = createQuantumState(2);
    superpose(state, view, 0, [200, 100, 100], 600);
    view[S.VEL_X] = 50; // speed burst
    const res1 = stepQuantumMacro(state, view, 2, PARTICLE_STRIDE, makeFields(), {
      force: true, tick: 10, worldParams: { QUANTUM_SUPERPOSITION_RATE: 0 },
    });
    expect(res1.collapsed).toBe(1);
    expect(res1.events[0].cause).toBe('speed');
    // Lifetime expiry: timer < cadence → forced collapse.
    const state2 = createQuantumState(2);
    const view2 = makeView(2);
    place(view2, 0, 100, 100, 100);
    place(view2, 1, 400, 400, 400);
    superpose(state2, view2, 0, [200, 100, 100], 10);
    const res2 = stepQuantumMacro(state2, view2, 2, PARTICLE_STRIDE, makeFields(), {
      force: true, tick: 10, worldParams: { QUANTUM_SUPERPOSITION_RATE: 0 },
    });
    expect(res2.collapsed).toBe(1);
    expect(res2.events[0].cause).toBe('lifetime');
  });
});

describe('Set N — macro entanglement (N.2)', () => {
  it('entangles two superposed particles and projects stride 75–76', () => {
    const view = makeView(3);
    place(view, 0, 100, 100, 100);
    place(view, 1, 150, 100, 100); // within 80, outside 30
    const state = createQuantumState(3);
    superpose(state, view, 0, [200, 100, 100]);
    superpose(state, view, 1, [250, 100, 100]);
    const res = stepQuantumMacro(state, view, 3, PARTICLE_STRIDE, makeFields(), {
      force: true, tick: 100, worldParams: { QUANTUM_ENTANGLE_RATE: 1, QUANTUM_SUPERPOSITION_RATE: 0 },
    });
    expect(res.entangled).toBe(1);
    expect(state.entangled[0]).toBe(1);
    expect(state.entangled[1]).toBe(0);
    expect(view[S.ENTANGLE_ID]).toBe(1);
    expect(view[PARTICLE_STRIDE + S.ENTANGLE_ID]).toBe(0);
    expect(view[S.ENTANGLE_PHASE]).toBeGreaterThan(0);
    expect(res.events[0].type).toBe('quantum:entangle');
    expect(quantumSummary(state).pairs).toBe(1);
  });

  it('shares ENERGY across distance (richer donates to poorer)', () => {
    const view = makeView(3);
    place(view, 0, 100, 100, 100, { energy: 100 });
    place(view, 1, 150, 100, 100, { energy: 10 });
    const state = createQuantumState(3);
    entangle(state, view, 0, 1);
    stepQuantumMacro(state, view, 3, PARTICLE_STRIDE, makeFields(), {
      force: true, worldParams: { QUANTUM_ENERGY_SHARE: 0.5, QUANTUM_SUPERPOSITION_RATE: 0 },
    });
    // 90 diff × 0.5 = 45 transfer → both 55.
    expect(view[S.ENERGY]).toBeCloseTo(55, 4);
    expect(view[PARTICLE_STRIDE + S.ENERGY]).toBeCloseTo(55, 4);
  });

  it('breaks when the ENTANGLEMENT law takes the stride offset over', () => {
    const view = makeView(3);
    place(view, 0, 100, 100, 100);
    place(view, 1, 150, 100, 100);
    const state = createQuantumState(3);
    entangle(state, view, 0, 1);
    view[S.ENTANGLE_ID] = 99; // law grabbed particle 0's offset
    const res = stepQuantumMacro(state, view, 3, PARTICLE_STRIDE, makeFields(), {
      force: true, worldParams: { QUANTUM_SUPERPOSITION_RATE: 0 },
    });
    expect(res.broken).toBe(1);
    expect(state.entangled[0]).toBe(-1);
    expect(view[PARTICLE_STRIDE + S.ENTANGLE_ID]).toBe(-1); // partner freed
  });

  it('measuring one collapses both (mirror)', () => {
    const view = makeView(3);
    place(view, 0, 100, 100, 100);
    place(view, 1, 150, 100, 100);
    const state = createQuantumState(3);
    superpose(state, view, 0, [200, 100, 100]);
    superpose(state, view, 1, [250, 100, 100]);
    entangle(state, view, 0, 1);
    // A neighbour interacts with particle 0 only (opposite side of particle 1).
    place(view, 2, 80, 100, 100);
    const res = stepQuantumMacro(state, view, 3, PARTICLE_STRIDE, makeFields(), {
      force: true, tick: 50, worldParams: { QUANTUM_SUPERPOSITION_RATE: 0, QUANTUM_COLLAPSE_RADIUS: 30 },
    });
    expect(state.superposed[0]).toBe(0);
    expect(state.superposed[1]).toBe(0); // mirror collapse
    const mirror = res.events.find((e) => e.cause === 'entangled-mirror');
    expect(mirror).toBeDefined();
    expect(mirror.particle).toBe(1);
  });
});

describe('Set N — tunneling (N.3)', () => {
  it('tunnels a high-ENERGY particle through a wall band to the far side', () => {
    // Preset 3: cross walls — x ∈ {5,6,7} is a wall band at dim 12 (mid = 6).
    const f = createFieldSystem(2000, 12, { WALLS_PRESET: 3 });
    expect(f.hasWalls).toBe(true);
    const cell = f.cell;
    const view = makeView(2);
    // Cell (4,3,3) is free, pressed against the wall band at x=5.
    place(view, 0, 4.5 * cell, 3.5 * cell, 3.5 * cell, { energy: 100 });
    place(view, 1, 4.5 * cell, 3.5 * cell, 3.5 * cell, { energy: 1 }); // no energy
    const res = stepQuantumMacro(createQuantumState(2), view, 2, PARTICLE_STRIDE, f, {
      force: true, tick: 10, worldParams: { QUANTUM_TUNNEL_RATE: 1, QUANTUM_TUNNEL_ENERGY: 40 },
    });
    expect(res.tunneled).toBe(1);
    // Tunnelled to the first free cell past the band: (8,3,3).
    expect(view[S.POS_X]).toBeCloseTo(8.5 * cell, 3);
    expect(view[S.POS_Y]).toBeCloseTo(3.5 * cell, 3);
    expect(view[S.POS_Z]).toBeCloseTo(3.5 * cell, 3);
    expect(view[S.ENERGY]).toBe(95); // TUNNEL_ENERGY_COST 5
    expect(res.events[0].type).toBe('quantum:tunnel');
    // The energy-poor particle never tunnels.
    expect(view[PARTICLE_STRIDE + S.POS_X]).toBeCloseTo(4.5 * cell, 3);
  });

  it('does nothing without walls or with rate 0', () => {
    const f = makeFields(); // no walls
    const view = makeView(2);
    place(view, 0, 100, 100, 100, { energy: 100 });
    const res = stepQuantumMacro(createQuantumState(2), view, 2, PARTICLE_STRIDE, f, {
      force: true, tick: 10, worldParams: { QUANTUM_TUNNEL_RATE: 1 },
    });
    expect(res.tunneled).toBe(0);
    const f2 = createFieldSystem(2000, 12, { WALLS_PRESET: 3 });
    const res2 = stepQuantumMacro(createQuantumState(2), view, 2, PARTICLE_STRIDE, f2, {
      force: true, tick: 10, worldParams: { QUANTUM_TUNNEL_RATE: 0 },
    });
    expect(res2.tunneled).toBe(0);
  });
});

describe('Set N — observer effect (N.4)', () => {
  it('collapses nearby superpositions when SELECTION_SENSITIVITY is high', () => {
    const view = makeView(3);
    place(view, 0, 100, 100, 100, { species: 0 });   // observer (sens = 1.0)
    place(view, 1, 135, 100, 100, { species: 1 });   // superposed target (35 away)
    const state = createQuantumState(3);
    superpose(state, view, 1, [200, 100, 100]);
    const dna = makeDNA([DNA_INDEXES.SELECTION_SENSITIVITY]); // species 0 max
    const res = stepQuantumMacro(state, view, 3, PARTICLE_STRIDE, makeFields(), {
      force: true, tick: 10, worldParams: {
        QUANTUM_SUPERPOSITION_RATE: 0, QUANTUM_COLLAPSE_RADIUS: 30, QUANTUM_OBSERVER_RADIUS: 40,
      },
      dnaBuffer: dna,
    });
    expect(res.observed).toBe(1);
    expect(state.superposed[1]).toBe(0);
    const ev = res.events.find((e) => e.type === 'quantum:observe');
    expect(ev).toBeDefined();
    expect(ev.observer).toBe(0);
    expect(ev.target).toBe(1);
  });

  it('ignores species with low sensitivity and depth', () => {
    const view = makeView(3);
    place(view, 0, 100, 100, 100, { species: 2 }); // sens 0, depth 1
    place(view, 1, 135, 100, 100, { species: 1 });
    const state = createQuantumState(3);
    superpose(state, view, 1, [200, 100, 100]);
    const dna = makeDNA([]); // all params at their minimum
    const res = stepQuantumMacro(state, view, 3, PARTICLE_STRIDE, makeFields(), {
      force: true, tick: 10, worldParams: {
        QUANTUM_SUPERPOSITION_RATE: 0, QUANTUM_COLLAPSE_RADIUS: 30, QUANTUM_OBSERVER_RADIUS: 40,
      },
      dnaBuffer: dna,
    });
    expect(res.observed).toBe(0);
    expect(state.superposed[1]).toBe(1); // untouched
  });
});

describe('Set N — determinism & world params', () => {
  it('is deterministic — identical runs give identical results', () => {
    function run() {
      const f = makeFields();
      const view = makeView(3);
      place(view, 0, 100, 100, 100);
      place(view, 1, 150, 100, 100);
      const state = createQuantumState(3);
      const first = stepQuantumMacro(state, view, 3, PARTICLE_STRIDE, f, {
        force: true, tick: 30, worldParams: {
          QUANTUM_SUPERPOSITION_RATE: 1, QUANTUM_ENTANGLE_RATE: 1, QUANTUM_ENERGY_SHARE: 0.1,
        },
      });
      return {
        entered: first.entered,
        entangled: first.entangled,
        events: first.events.map((e) => e.type),
        sup: Array.from(state.superposed),
        ent: Array.from(state.entangled),
      };
    }
    expect(run()).toEqual(run());
  });

  it('defines the MATTER > QUANTUM subgroup with sane defaults', () => {
    const defs = WORLD_PARAM_DEFS.filter((d) => d.group === 'MATTER' && d.subgroup === 'QUANTUM');
    expect(defs.length).toBe(8);
    expect(worldParamDef('QUANTUM_SUPERPOSITION_RATE').default).toBe(0.15);
    expect(worldParamDef('QUANTUM_SPREAD').default).toBe(25);
    expect(worldParamDef('QUANTUM_ENTANGLE_RATE').default).toBe(0.1);
    expect(worldParamDef('QUANTUM_TUNNEL_RATE').default).toBe(0.02);
    expect(clampWorldParam('QUANTUM_SPREAD', 500)).toBe(100);
    expect(clampWorldParam('QUANTUM_COLLAPSE_RADIUS', -5)).toBe(0);
    expect(clampWorldParam('QUANTUM_TUNNEL_ENERGY', 1)).toBe(5);
  });
});
