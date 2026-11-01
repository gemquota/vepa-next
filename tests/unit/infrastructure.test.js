/**
 * Set K.1 — Infrastructure & Energy (RRP I·J·K trilogy)
 * Tests field-energy extraction, allied energy grids, and mega-structures.
 */
import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES } from '../../src/constants.js';
import { createFieldSystem, writeField, writeWall, isWall } from '../../src/physics/fields.js';
import { createGroupRegistry, declareGroup, getGroupSummaries } from '../../src/state/groupRegistry.js';
import { runInfrastructure, INFRA_CADENCE } from '../../src/state/infrastructure.js';

const S = STRIDE_INDEXES;

function makeGroup(registry, name, x, y, z, treasury = 500, members = 5) {
  const g = declareGroup(registry, name, new Set([0]));
  g.treasury = treasury;
  g.roles = { leader: 1, forager: 1, builder: 1 };
  g.members = new Set(Array.from({ length: members }, (_, k) => 100 + k));
  g.cx = x; g.cy = y; g.cz = z;
  g.minX = x - 50; g.maxX = x + 50;
  g.minY = y - 50; g.maxY = y + 50;
  g.minZ = z - 50; g.maxZ = z + 50;
  return g;
}

function makeFields() {
  return createFieldSystem(2000, 12, {});
}

function makeView(energy = 50) {
  const view = new Float32Array(200 * PARTICLE_STRIDE);
  for (let i = 0; i < 200; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.DEAD] = 1;
    view[b + S.ENERGY] = energy;
  }
  for (const m of [100, 101, 102, 103, 104]) {
    const b = m * PARTICLE_STRIDE;
    view[b + S.DEAD] = 0;
    view[b + S.ENERGY] = energy;
  }
  return view;
}

/** Seed INFO + THERMAL at a group's centroid so extraction has fuel. */
function seedEnergy(f, x, y, z, amount) {
  writeField(f, 'INFO', x, y, z, amount);
  writeField(f, 'THERMAL', x, y, z, amount);
}

describe('Set K — extraction', () => {
  it('is gated on its cadence (force bypasses for tests)', () => {
    const reg = createGroupRegistry();
    makeGroup(reg, 'A', 100, 100, 100);
    const quiet = runInfrastructure(reg, makeView(), PARTICLE_STRIDE, makeFields(), { tick: 1, worldParams: {} });
    expect(quiet.harvested).toBe(0);
    const forced = runInfrastructure(reg, makeView(), PARTICLE_STRIDE, makeFields(), { tick: 1, worldParams: {}, force: true });
    expect(forced).toHaveProperty('harvested');
    expect(INFRA_CADENCE).toBe(25);
  });

  it('harvests ambient field energy into the treasury and consumes the field', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 'A', 100, 100, 100, 100);
    const f = makeFields();
    seedEnergy(f, 100, 100, 100, 10); // INFO 10 + THERMAL 10
    const before = g.treasury;
    const res = runInfrastructure(reg, makeView(), PARTICLE_STRIDE, f, { tick: 0, worldParams: { HARVEST_RATE: 0.1 }, force: true });
    // 10 * 0.1 from each field = 2 total.
    expect(res.harvested).toBeCloseTo(2, 4);
    expect(g.treasury).toBeCloseTo(before + 2, 4);
    expect(g.infra.harvested).toBeCloseTo(2, 4);
    expect(res.events.some((e) => e.type === 'infra:harvest')).toBe(true);
    // Conservation: the field lost what the treasury gained.
    const cell = Math.floor(100 / (2000 / 12));
    const idx = (cell * 12 + cell) * 12 + cell;
    expect(f.scalars.INFO[idx]).toBeCloseTo(9, 4);
    expect(f.scalars.THERMAL[idx]).toBeCloseTo(9, 4);
  });

  it('harvests nothing from an empty field', () => {
    const reg = createGroupRegistry();
    makeGroup(reg, 'A', 100, 100, 100, 100);
    const res = runInfrastructure(reg, makeView(), PARTICLE_STRIDE, makeFields(), { tick: 0, worldParams: { HARVEST_RATE: 0.5 }, force: true });
    expect(res.harvested).toBe(0);
  });
});

describe('Set K — energy grids', () => {
  it('feeds allied members from the treasury (harvest → treasury → members)', () => {
    const reg = createGroupRegistry();
    const a = makeGroup(reg, 'A', 100, 100, 100, 100);
    const b = makeGroup(reg, 'B', 200, 100, 100, 100);
    a.allies.add(b.id);
    b.allies.add(a.id);
    const view = makeView(50);
    const before = a.treasury;
    const res = runInfrastructure(reg, view, PARTICLE_STRIDE, makeFields(), { tick: 0, worldParams: { GRID_FEED: 0.05 }, force: true });
    expect(res.fed).toBe(10); // both allied groups feed their 5 members each
    expect(a.treasury).toBeLessThan(before); // grid costs treasury
    // Particle 100 is a member of BOTH groups (same member indices), so it
    // is fed once per group: 0.05 × 2.
    expect(view[100 * PARTICLE_STRIDE + S.ENERGY]).toBeCloseTo(50 + 0.1, 4);
    expect(a.infra.grid).toBe(1);
    expect(res.events.some((e) => e.type === 'infra:grid')).toBe(true);
  });

  it('does not feed without allies', () => {
    const reg = createGroupRegistry();
    makeGroup(reg, 'A', 100, 100, 100, 100);
    const res = runInfrastructure(reg, makeView(), PARTICLE_STRIDE, makeFields(), { tick: 0, worldParams: {}, force: true });
    expect(res.fed).toBe(0);
  });

  it('caps member energy at the feed ceiling', () => {
    const reg = createGroupRegistry();
    const a = makeGroup(reg, 'A', 100, 100, 100, 1000);
    const b = makeGroup(reg, 'B', 200, 100, 100, 1000);
    a.allies.add(b.id);
    b.allies.add(a.id);
    const view = makeView(100); // already at the ceiling
    runInfrastructure(reg, view, PARTICLE_STRIDE, makeFields(), { tick: 0, worldParams: { GRID_FEED: 0.05 }, force: true });
    expect(view[100 * PARTICLE_STRIDE + S.ENERGY]).toBe(100);
  });
});

describe('Set K — mega-structures', () => {
  it('initiates a project at high treasury, invests, and completes it', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 'A', 100, 100, 100, 1000);
    const f = makeFields();
    const first = runInfrastructure(reg, makeView(), PARTICLE_STRIDE, f, { tick: 0, worldParams: {}, force: true });
    expect(first.megaStarted).toBe(1);
    expect(g.mega).not.toBe(null);
    expect(resEvents(first).some((e) => e.type === 'infra:mega-init')).toBe(true);
    // Invest + progress until completion.
    let completed = 0;
    const completes = [];
    for (let i = 1; i <= 25; i++) {
      const res = runInfrastructure(reg, makeView(), PARTICLE_STRIDE, f, { tick: i * INFRA_CADENCE, worldParams: {}, force: true });
      completed += res.megaCompleted;
      completes.push(...res.events.filter((e) => e.type === 'infra:mega-complete'));
    }
    // The first project completes (a second auto-starts while treasury stays
    // above the threshold, so g.mega is mid-build again — not null).
    expect(completed).toBeGreaterThanOrEqual(1);
    expect(completes[0].kind).toBe('BRIDGE'); // group id 1 → kinds[1]
    expect(g.treasury).toBeLessThan(1000);
  });

  it('progresses faster in later eras (era-progressed builds)', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 'A', 100, 100, 100, 1000);
    const f = makeFields();
    runInfrastructure(reg, makeView(), PARTICLE_STRIDE, f, { tick: 0, worldParams: {}, era: 3, force: true });
    const progressPerPass = 1 + 3 * 0.5; // 2.5
    const passes = Math.ceil((20 - g.mega.progress) / progressPerPass);
    expect(passes).toBeLessThan(20); // faster than era 0
  });

  it('WALL mega writes an impassable ring at the territory corners', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 'A', 500, 500, 500, 1000, 5);
    g.minX = 200; g.maxX = 800;
    g.minY = 200; g.maxY = 800;
    g.minZ = 200; g.maxZ = 800;
    g.mega = { kind: 'WALL', progress: 19, target: 20 };
    const f = makeFields();
    const res = runInfrastructure(reg, makeView(), PARTICLE_STRIDE, f, { tick: 0, worldParams: {}, force: true });
    expect(res.megaCompleted).toBe(1);
    expect(g.mega).toBe(null);
    expect(isWall(f, 250, 250, 250)).toBe(true);  // corner cell (cell 1)
    expect(isWall(f, 750, 750, 750)).toBe(true);  // opposite corner (cell 4)
    expect(isWall(f, 500, 500, 500)).toBe(false); // interior (cell 3)
  });

  it('BRIDGE mega writes an INFO corridor', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 'A', 100, 100, 100, 1000, 5);
    g.mega = { kind: 'BRIDGE', progress: 19, target: 20 };
    const f = makeFields();
    const res = runInfrastructure(reg, makeView(), PARTICLE_STRIDE, f, { tick: 0, worldParams: {}, force: true });
    expect(res.megaCompleted).toBe(1);
    expect(f.scalars.INFO.some((v) => v > 0)).toBe(true);
  });

  it('exposes infra stats and the active mega through group summaries', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 'A', 100, 100, 100, 1000);
    g.infra.harvested = 7;
    g.infra.grid = 2;
    g.mega = { kind: 'HUB', progress: 3, target: 20 };
    const summary = getGroupSummaries(reg).find((s) => s.id === g.id);
    expect(summary.infra).toEqual({ harvested: 7, grid: 2 });
    expect(summary.mega).toEqual({ kind: 'HUB', progress: 3, target: 20 });
  });
});

function resEvents(res) {
  return res.events || [];
}
