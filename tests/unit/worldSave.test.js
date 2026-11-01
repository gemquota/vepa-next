import { describe, it, expect } from 'vitest';
import {
  WORLD_SIZE,
  PARTICLE_STRIDE,
  MAX_PARTICLES,
  MAX_SPECIES,
  STRIDE_INDEXES,
  LAW_INDEXES,
} from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createDNABuffer } from '../../src/dna/dnaBuffer.js';
import { createLawState, set } from '../../src/state/lawState.js';
import {
  captureWorldState,
  restoreWorldState,
  summarizeWorld,
  exportWorldSave,
  parseWorldSave,
  createWorldSaveStore,
  compareWorldSaves,
  createUndoRing,
  sameWorldFingerprint,
  WORLD_SAVE_FORMAT,
  WORLD_SAVE_VERSION,
} from '../../src/state/worldSave.js';

const S = STRIDE_INDEXES;

/** Build a minimal live world: count particles, speciesCount species, laws off. */
function makeWorld(count = 4, species = 2, laws = null) {
  const { buffer, view } = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  view.fill(0);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = 100 + i * 10;
    view[b + S.POS_Y] = 200 + i;
    view[b + S.POS_Z] = 300;
    view[b + S.VEL_X] = 1 + i * 0.5;
    view[b + S.MASS] = 1.5 + i * 0.25;
    view[b + S.SPECIES_ID] = i % species;
    view[b + S.ENERGY] = 50 + i * 10;
    view[b + S.DEAD] = 0;
    view[b + S.DNA_CACHE_START] = 0.5;
  }
  const dna = createDNABuffer();
  const lawState = laws || createLawState();
  const worldParams = { GLOBAL_G: 2, TIDAL_SCALE: 1.5, ACIDITY_PH: 7, WORLD_SIZE: 2000 };
  const runtime = {
    starMass: 12,
    forceScale: 1.25,
    maxForce: 50,
    dragMultiplier: 0.9,
    birthRate: 1,
    deathRate: 1,
    signalScale: 1,
    simSpeed: 1,
    visualScale: 1,
    globalAlpha: 1,
  };
  return { buffer, view, count, species, dna, laws: lawState, worldParams, runtime, worldSize: 2000, tick: 42 };
}

function capture(world, name = 'test', savedAt = Date.now()) {
  return captureWorldState({
    view: world.view,
    count: world.count,
    speciesCount: world.species,
    dna: world.dna,
    laws: world.laws,
    worldParams: world.worldParams,
    runtime: world.runtime,
    worldSize: world.worldSize,
    tick: world.tick,
    name,
    savedAt,
  });
}

/** In-memory adapter matching the browser adapter's async surface. */
function memoryAdapter() {
  const records = new Map();
  return {
    async save(state) {
      records.set(state.name, { ...state, particles: state.particles.slice(), dna: state.dna ? state.dna.slice() : null });
      return { ok: true, backend: 'memory' };
    },
    async load(name) {
      const rec = records.get(name);
      return rec ? { ...rec, particles: rec.particles.slice(), dna: rec.dna ? rec.dna.slice() : null } : null;
    },
    async list() {
      return [...records.values()]
        .map((r) => ({ name: r.name, savedAt: r.savedAt, tick: r.tick, worldSize: r.worldSize, particleCount: r.particleCount, speciesCount: r.speciesCount, summary: r.summary }))
        .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    },
    async remove(name) {
      records.delete(name);
      return true;
    },
  };
}

describe('world save capture/restore (v7.4)', () => {
  it('captures the full world state with summary metadata', () => {
    const world = makeWorld();
    set(world.laws, LAW_INDEXES.GRAV);
    const state = capture(world, 'alpha');
    expect(state.format).toBe(WORLD_SAVE_FORMAT);
    expect(state.version).toBe(WORLD_SAVE_VERSION);
    expect(state.name).toBe('alpha');
    expect(state.tick).toBe(42);
    expect(state.worldSize).toBe(2000);
    expect(state.particleCount).toBe(4);
    expect(state.speciesCount).toBe(2);
    expect(state.particles).toBeInstanceOf(Float32Array);
    expect(state.dna).toBeInstanceOf(Uint16Array);
    expect(state.laws.low & (1 << LAW_INDEXES.GRAV)).toBeTruthy();
    expect(state.worldParams.GLOBAL_G).toBe(2);
    expect(state.runtime.forceScale).toBe(1.25);
    expect(state.summary.alive).toBe(4);
    expect(state.summary.species).toBe(2);
    expect(state.summary.lawsOn).toBe(1);
    expect(state.summary.avgEnergy).toBeCloseTo((50 + 60 + 70 + 80) / 4, 5);
  });

  it('round-trips byte-identical into a fresh target', () => {
    const world = makeWorld();
    set(world.laws, LAW_INDEXES.GRAV);
    set(world.laws, LAW_INDEXES.BOND);
    const state = capture(world);
    const before = Array.from(state.particles);

    const fresh = makeWorld(0, 1);
    const out = restoreWorldState(state, {
      view: fresh.view,
      dna: fresh.dna,
      laws: fresh.laws,
      worldParams: fresh.worldParams,
      runtime: fresh.runtime,
    });
    expect(out.particleCount).toBe(4);
    expect(out.speciesCount).toBe(2);
    expect(out.worldSize).toBe(2000);
    expect(Array.from(fresh.view.subarray(0, 4 * PARTICLE_STRIDE))).toEqual(before);
    expect(fresh.laws.lowFlags[0]).toBe(state.laws.low);
    expect(fresh.laws.highFlags[0]).toBe(state.laws.high);
    expect(fresh.worldParams.GLOBAL_G).toBe(2);
    expect(fresh.worldParams.ACIDITY_PH).toBe(7);
    expect(fresh.runtime.forceScale).toBe(1.25);
    expect(fresh.runtime.dragMultiplier).toBe(0.9);
  });

  it('clamps counts on restore and re-applies params through clampWorldParam', () => {
    const world = makeWorld();
    const state = capture(world);
    state.particleCount = 999999;
    state.speciesCount = 999;
    state.worldParams.ACIDITY_PH = 999; // out of range 0-14
    const fresh = makeWorld(0, 1);
    const out = restoreWorldState(state, {
      view: fresh.view,
      dna: fresh.dna,
      laws: fresh.laws,
      worldParams: fresh.worldParams,
      runtime: fresh.runtime,
    });
    expect(out.particleCount).toBe(MAX_PARTICLES);
    expect(out.speciesCount).toBe(MAX_SPECIES);
    expect(fresh.worldParams.ACIDITY_PH).toBe(14);
  });

  it('restore throws on non-world payloads', () => {
    expect(() => restoreWorldState(null, {})).toThrow();
    expect(() => restoreWorldState({ format: 'nope' }, {})).toThrow();
  });

  it('summarizeWorld ignores dead particles and counts distinct species', () => {
    const world = makeWorld(4, 2);
    world.view[1 * PARTICLE_STRIDE + S.DEAD] = 1; // species 1
    world.view[3 * PARTICLE_STRIDE + S.DEAD] = 1; // species 1
    set(world.laws, LAW_INDEXES.GRAV);
    const s = summarizeWorld(world.view, world.count, world.laws);
    expect(s.alive).toBe(2);
    expect(s.species).toBe(1); // survivors are both species 0
    expect(s.lawsOn).toBe(1);
  });
});

describe('world save export/import (v7.4)', () => {
  it('export → parse → restore reproduces the world exactly', () => {
    const world = makeWorld(8, 3);
    set(world.laws, LAW_INDEXES.GRAV);
    const state = capture(world, 'portable');
    const json = exportWorldSave(state);
    expect(json).toContain('"format": "vepa-world-save"');
    expect(json).toContain('"particlesB64"');

    const parsed = parseWorldSave(json);
    expect(parsed.name).toBe('portable');
    expect(parsed.particles).toBeInstanceOf(Float32Array);
    expect(Array.from(parsed.particles)).toEqual(Array.from(state.particles));

    const fresh = makeWorld(0, 1);
    const out = restoreWorldState(parsed, {
      view: fresh.view,
      dna: fresh.dna,
      laws: fresh.laws,
      worldParams: fresh.worldParams,
      runtime: fresh.runtime,
    });
    expect(out.particleCount).toBe(8);
    expect(out.speciesCount).toBe(3);
    expect(Array.from(fresh.view.subarray(0, 8 * PARTICLE_STRIDE))).toEqual(Array.from(state.particles));
  });

  it('rejects foreign or newer-version files', () => {
    expect(() => parseWorldSave('{"format":"other"}')).toThrow();
    expect(() => parseWorldSave('not json')).toThrow();
    expect(() => parseWorldSave(JSON.stringify({ format: WORLD_SAVE_FORMAT, version: WORLD_SAVE_VERSION + 5 }))).toThrow();
  });
});

describe('world save store (v7.4)', () => {
  it('save / load / list / remove round-trip through an adapter', async () => {
    const store = createWorldSaveStore(memoryAdapter());
    const a = capture(makeWorld(4, 2), 'first', 1000);
    const b = capture(makeWorld(6, 3), 'second', 2000);
    await store.save(a);
    await store.save(b);

    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe('second'); // newest first
    expect(list[0].summary.alive).toBe(6);

    const loaded = await store.load('first');
    expect(loaded.name).toBe('first');
    expect(Array.from(loaded.particles)).toEqual(Array.from(a.particles));

    await store.remove('first');
    expect(await store.list()).toHaveLength(1);
    expect(await store.load('first')).toBeNull();
  });
});

describe('world compare (v7.5)', () => {
  it('builds a matrix of LIVE + saves with best-cell markers and paramsDelta', () => {
    const live = capture(makeWorld(4, 2), 'LIVE');
    const s1 = capture(makeWorld(8, 3), 's1');
    s1.worldParams.GLOBAL_G = 5; // one knob drifted
    s1.worldParams.TIDAL_SCALE = 3; // second knob drifted
    const matrix = compareWorldSaves(live, [s1]);
    expect(matrix.columns).toEqual(['LIVE', 's1']);

    const aliveRow = matrix.rows.find((r) => r.key === 'alive');
    expect(aliveRow.mode).toBe('max');
    expect(aliveRow.values).toEqual([4, 8]);
    expect(aliveRow.bestId).toBe(1);

    const paramsRow = matrix.rows.find((r) => r.key === 'paramsDelta');
    expect(paramsRow.mode).toBe('min');
    expect(paramsRow.values).toEqual([0, 2]);
    expect(paramsRow.bestId).toBe(0);

    const massRow = matrix.rows.find((r) => r.key === 'avgMass');
    expect(massRow.mode).toBe('info');
    expect(massRow.bestId).toBe(-1);
  });
});

describe('world undo ring (v7.5)', () => {
  it('undo/redo walk the two stacks and every action is reversible', () => {
    const ring = createUndoRing(8);
    const w = (tick) => ({ tick, particleCount: 1, speciesCount: 1, laws: { low: 0, high: 0, ext: 0, quad: 0 }, worldParams: {} });

    expect(ring.commit(w(0))).toBe(true);
    expect(ring.commit(w(0))).toBe(false); // duplicate fingerprint skipped
    expect(ring.canUndo()).toBe(true);

    // Unwanted change happened (world at tick 100); undo back to the checkpoint.
    const undo1 = ring.undo(w(100));
    expect(undo1.tick).toBe(0);
    expect(ring.canRedo()).toBe(true);
    expect(ring.undo(w(0))).toBeNull(); // nothing before the checkpoint

    // Redo re-applies the undone world, then the stack is exhausted.
    const redo1 = ring.redo(w(0));
    expect(redo1.tick).toBe(100);
    expect(ring.redo(w(100))).toBeNull();
    expect(ring.canRedo()).toBe(false);
    expect(ring.canUndo()).toBe(true);
  });

  it('new commits after an undo clear the redo stack (classic undo semantics)', () => {
    const ring = createUndoRing(8);
    const w = (tick) => ({ tick, particleCount: 1, speciesCount: 1, laws: { low: 0, high: 0, ext: 0, quad: 0 }, worldParams: {} });
    ring.commit(w(0));
    ring.undo(w(50));
    expect(ring.canRedo()).toBe(true);
    ring.commit(w(75));
    expect(ring.canRedo()).toBe(false);
  });

  it('caps the past stack at the configured depth', () => {
    const ring = createUndoRing(3);
    for (let t = 0; t < 10; t++) ring.commit({ tick: t, particleCount: 1, speciesCount: 1, laws: { low: 0, high: 0, ext: 0, quad: 0 }, worldParams: {} });
    expect(ring.past.length).toBe(3);
    expect(ring.undo({ tick: 99 }).tick).toBe(9);
    expect(ring.undo({ tick: 9 }).tick).toBe(8);
    expect(ring.undo({ tick: 8 }).tick).toBe(7);
    expect(ring.undo({ tick: 7 })).toBeNull();
  });

  it('sameWorldFingerprint distinguishes param-only changes', () => {
    const a = { tick: 5, particleCount: 4, speciesCount: 2, laws: { low: 1, high: 0, ext: 0, quad: 0 }, worldParams: { GLOBAL_G: 1 } };
    const b = { ...a };
    const c = { ...a, worldParams: { GLOBAL_G: 2 } };
    expect(sameWorldFingerprint(a, b)).toBe(true);
    expect(sameWorldFingerprint(a, c)).toBe(false);
  });
});
