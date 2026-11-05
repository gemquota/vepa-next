import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, MAX_PARTICLES, STRIDE_INDEXES, DNA_INDEXES } from '../../src/constants.js';
import {
  createGroupRegistry,
  declareGroup,
  updateGroups,
  groupCount,
  getGroupSummaries,
  SCAN_INTERVAL,
  GROUP_ROLE_LEADER,
  GROUP_ROLE_FORAGER,
  GROUP_ROLE_BUILDER,
} from '../../src/state/groupRegistry.js';

const S = STRIDE_INDEXES;
const COUNT = 12;

/** Build a buffer of particles. Each spec: {x,y,z,species,signal,velX,affinity,stiffness,jitter,force,memory,energy,dead}. */
function makeBuffer(specs) {
  const view = new Float32Array(MAX_PARTICLES * PARTICLE_STRIDE);
  specs.forEach((sp, i) => {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = sp.x ?? 0;
    view[b + S.POS_Y] = sp.y ?? 0;
    view[b + S.POS_Z] = sp.z ?? 0;
    view[b + S.VEL_X] = sp.velX ?? 0;
    view[b + S.VEL_Y] = sp.velY ?? 0;
    view[b + S.VEL_Z] = sp.velZ ?? 0;
    view[b + S.MASS] = sp.dead ? 0 : 1;
    view[b + S.DEAD] = sp.dead ? 1 : 0;
    view[b + S.SPECIES_ID] = sp.species ?? 0;
    view[b + S.SIGNAL] = sp.signal ?? 0;
    view[b + S.MEMORY] = sp.memory ?? 0;
    view[b + S.ENERGY] = sp.energy ?? 100;
    const c = b + S.DNA_CACHE_START;
    view[c + DNA_INDEXES.SPECIES_AFFINITY] = sp.affinity ?? 0;
    view[c + DNA_INDEXES.STIFFNESS] = sp.stiffness ?? 0;
    view[c + DNA_INDEXES.JITTER] = sp.jitter ?? 0;
    view[c + DNA_INDEXES.FORCE] = sp.force ?? 0;
    view[c + DNA_INDEXES.BOND_ANGLE] = sp.bondAngle ?? 0;
  });
  return view;
}

/** A dense, communicative, moving cluster — everything a group needs. */
function denseCluster(species = 0) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    out.push({ x: 100 + (i % 3) * 10, y: 100 + Math.floor(i / 3) * 10, z: 100, species, signal: 0.8, velX: 1 });
  }
  return out;
}

/** Force the next updateGroups call to actually run its scan. */
function forceScan(registry) {
  registry.frame = SCAN_INTERVAL - 1;
}

describe('group registry (Set F.1)', () => {
  it('declared groups seed and recruit ungrouped particles of their species', () => {
    const reg = createGroupRegistry();
    const specs = denseCluster(0);
    // Two particles of another species right next to them — excluded.
    specs.push({ x: 105, y: 105, z: 100, species: 1, signal: 0.8, velX: 1 });
    specs.push({ x: 115, y: 105, z: 100, species: 1, signal: 0.8, velX: 1 });
    const view = makeBuffer(specs);
    const g = declareGroup(reg, 'TEST HIVE', [0]);

    forceScan(reg);
    updateGroups(reg, view, specs.length, PARTICLE_STRIDE, null, { lawActiveCount: 1 });
    expect(g.members.size).toBeGreaterThanOrEqual(4);
    // All members are species 0.
    for (const m of g.members) {
      expect(view[m * PARTICLE_STRIDE + S.SPECIES_ID]).toBe(0);
      expect(view[m * PARTICLE_STRIDE + S.GROUP_ID]).toBe(g.id);
    }
  });

  it('detects emergent groups from dense communicative clusters', () => {
    const reg = createGroupRegistry();
    const specs = denseCluster(0);
    const view = makeBuffer(specs);

    forceScan(reg);
    const events = updateGroups(reg, view, specs.length, PARTICLE_STRIDE, null, { lawActiveCount: 1 });
    expect(events.some((e) => e.type === 'group:formed')).toBe(true);
    expect(groupCount(reg)).toBe(1);
    const g = [...reg.groups.values()][0];
    expect(g.declared).toBe(false);
    expect(g.members.size).toBeGreaterThanOrEqual(4);
    // Membership survives the next scan (persistence).
    forceScan(reg);
    updateGroups(reg, view, specs.length, PARTICLE_STRIDE, null, { lawActiveCount: 1 });
    expect(groupCount(reg)).toBe(1);
    expect(g.members.size).toBeGreaterThanOrEqual(4);
  });

  it('forms nothing on a lawless world or when matter is frozen', () => {
    const reg = createGroupRegistry();
    const view = makeBuffer(denseCluster(0));
    forceScan(reg);
    updateGroups(reg, view, 6, PARTICLE_STRIDE, null, { lawActiveCount: 0 });
    expect(groupCount(reg)).toBe(0);
  });

  it('forms nothing when particles are sparse (no contact density)', () => {
    const reg = createGroupRegistry();
    const specs = [];
    for (let i = 0; i < 6; i++) {
      specs.push({ x: 100 + i * 500, y: 100, z: 100, signal: 0.8, velX: 1 });
    }
    const view = makeBuffer(specs);
    forceScan(reg);
    updateGroups(reg, view, specs.length, PARTICLE_STRIDE, null, { lawActiveCount: 1 });
    expect(groupCount(reg)).toBe(0);
  });

  it('assigns leader/forager/builder roles onto the stride', () => {
    const reg = createGroupRegistry();
    const specs = denseCluster(0);
    // Particle 0: the loudest voice → leader.
    specs[0].signal = 1; specs[0].memory = 1; specs[0].energy = 200;
    // Particle 1: rigid → builder.
    specs[1].stiffness = 0.9;
    // Particle 2: skittish + strong → forager.
    specs[2].jitter = 0.8; specs[2].force = 0.8;
    const view = makeBuffer(specs);
    forceScan(reg);
    updateGroups(reg, view, specs.length, PARTICLE_STRIDE, null, { lawActiveCount: 1 });
    expect(view[0 * PARTICLE_STRIDE + S.GROUP_ROLE]).toBe(GROUP_ROLE_LEADER);
    expect(view[1 * PARTICLE_STRIDE + S.GROUP_ROLE]).toBe(GROUP_ROLE_BUILDER);
    expect(view[2 * PARTICLE_STRIDE + S.GROUP_ROLE]).toBe(GROUP_ROLE_FORAGER);
    const g = [...reg.groups.values()][0];
    expect(g.roles.leader).toBe(1);
    expect(g.roles.builder).toBe(1);
    expect(g.roles.forager).toBe(1);
  });

  it('dissolves on membership collapse and clears the stride', () => {
    const reg = createGroupRegistry();
    const specs = denseCluster(0);
    const view = makeBuffer(specs);
    forceScan(reg);
    updateGroups(reg, view, specs.length, PARTICLE_STRIDE, null, { lawActiveCount: 1 });
    expect(groupCount(reg)).toBe(1);

    // Everyone dies.
    for (let i = 0; i < specs.length; i++) {
      view[i * PARTICLE_STRIDE + S.DEAD] = 1;
      view[i * PARTICLE_STRIDE + S.MASS] = 0;
    }
    forceScan(reg);
    const events = updateGroups(reg, view, specs.length, PARTICLE_STRIDE, null, { lawActiveCount: 1 });
    expect(groupCount(reg)).toBe(0);
    expect(events.some((e) => e.type === 'group:dissolved' && e.reason === 'collapse')).toBe(true);
  });

  it('dissolves emergent groups that stay below minimum membership', () => {
    const reg = createGroupRegistry();
    const specs = denseCluster(0);
    const view = makeBuffer(specs);
    forceScan(reg);
    updateGroups(reg, view, specs.length, PARTICLE_STRIDE, null, { lawActiveCount: 1 });
    expect(groupCount(reg)).toBe(1);

    // Kill 4 of 6 → 2 alive members (below MIN_MEMBERS=4).
    for (let i = 2; i < 6; i++) {
      view[i * PARTICLE_STRIDE + S.DEAD] = 1;
      view[i * PARTICLE_STRIDE + S.MASS] = 0;
    }
    let dissolved = false;
    for (let s = 0; s < 10 && !dissolved; s++) {
      forceScan(reg);
      const events = updateGroups(reg, view, specs.length, PARTICLE_STRIDE, null, { lawActiveCount: 1, staleGrace: 3 });
      dissolved = events.some((e) => e.type === 'group:dissolved' && e.reason === 'shrink');
    }
    expect(dissolved).toBe(true);
    expect(groupCount(reg)).toBe(0);
  });

  it('summaries expose territory, roles and species for analytics', () => {
    const reg = createGroupRegistry();
    const specs = denseCluster(0);
    specs.push({ x: 105, y: 105, z: 100, species: 1, signal: 0.8, velX: 1 });
    const view = makeBuffer(specs);
    forceScan(reg);
    updateGroups(reg, view, specs.length, PARTICLE_STRIDE, null, { lawActiveCount: 1 });
    const sums = getGroupSummaries(reg);
    expect(sums.length).toBe(1);
    expect(sums[0].members).toBeGreaterThanOrEqual(4);
    expect(sums[0].cx).toBeGreaterThan(0);
    expect(sums[0].maxX).toBeGreaterThan(sums[0].minX);
  });
});
