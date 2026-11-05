import { describe, expect, it } from 'vitest';
import {
  STRUCTURE_KINDS,
  UPKEEP_COST,
  COLLAPSE_THRESHOLD,
  DEFAULT_DECAY,
  createStructureRegistry,
  foundStructure,
  listStructures,
  getStructure,
  structureForGroup,
  transferOwnership,
  addDependency,
  dependenciesSatisfied,
  dependentsOf,
  runMaintenance,
  structureReport,
} from '../../src/state/structures.js';
import { createSystemLifecycle } from '../../src/state/systemLifecycle.js';

function registry(options) {
  return createStructureRegistry(createSystemLifecycle(), options);
}

/** A group registry stub with just the fields runMaintenance reads. */
function groups(spec) {
  const map = new Map();
  for (const [id, g] of Object.entries(spec)) {
    map.set(id, { id, members: new Set(g.members), treasury: g.treasury || 0, ...g });
  }
  return { groups: map };
}

describe('structure kinds', () => {
  it('exposes a known set with a distinct upkeep cost each', () => {
    const kinds = Object.values(STRUCTURE_KINDS);
    expect(kinds.length).toBeGreaterThan(5);
    for (const k of kinds) {
      expect(typeof UPKEEP_COST[k]).toBe('number');
      expect(UPKEEP_COST[k]).toBeGreaterThan(0);
    }
  });

  it('declares upkeep for every declared kind and no others', () => {
    expect(Object.keys(UPKEEP_COST).sort()).toEqual(Object.values(STRUCTURE_KINDS).sort());
  });

  it('charges more for a hub than a road', () => {
    // A road is passive connective tissue; a hub is staffed and defended.
    expect(UPKEEP_COST.HUB).toBeGreaterThan(UPKEEP_COST.ROAD);
    expect(UPKEEP_COST.WALL).toBeGreaterThan(UPKEEP_COST.NEST);
  });
});

describe('foundStructure', () => {
  it('grounds the structure in a durable lifecycle record', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', { kind: 'NEST' });
    expect(s.id).toMatch(/^infrastructure:/);
    expect(s.phase).toBeGreaterThanOrEqual(2);
    expect(r.lifecycle.records.get(s.id)).toBeTruthy();
  });

  it('records the owner, kind and position', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', { kind: 'HIVE', x: 10, y: 20, z: 30 });
    expect(s.attributes.ownerGroupId).toBe('g1');
    expect(s.attributes.kind).toBe('HIVE');
    expect(s.attributes.x).toBe(10);
    expect(s.attributes.y).toBe(20);
    expect(s.attributes.z).toBe(30);
  });

  it('starts fully intact and active', () => {
    const s = foundStructure(registry(), 'g1', {});
    expect(s.attributes.integrity).toBe(1);
    expect(s.attributes.active).toBe(true);
    expect(s.attributes.upkeepPaid).toBe(0);
  });

  it('falls back to NEST for an unknown kind instead of throwing', () => {
    const s = foundStructure(registry(), 'g1', { kind: 'PYRAMID' });
    expect(s.attributes.kind).toBe('NEST');
  });

  it('clamps out-of-range integrity', () => {
    const hi = foundStructure(registry(), 'g1', { integrity: 4 });
    const lo = foundStructure(registry(), 'g2', { integrity: -3 });
    expect(hi.attributes.integrity).toBe(1);
    expect(lo.attributes.integrity).toBe(0);
  });

  it('emits a founding event', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', {});
    const ev = r.lifecycle.events.filter((e) => e.recordId === s.id && e.type === 'structure-founded');
    expect(ev).toHaveLength(1);
  });

  it('gives each structure a distinct id', () => {
    const r = registry();
    const a = foundStructure(r, 'g1', {});
    const b = foundStructure(r, 'g1', {});
    expect(a.id).not.toBe(b.id);
    expect(listStructures(r)).toHaveLength(2);
  });

  it('supports a group founding several kinds', () => {
    const r = registry();
    foundStructure(r, 'g1', { kind: 'NEST' });
    const wall = foundStructure(r, 'g1', { kind: 'WALL' });
    expect(wall.attributes.kind).toBe('WALL');
  });
});

describe('structure lookup', () => {
  it('returns null for an unknown id', () => {
    expect(getStructure(registry(), 'infrastructure:999')).toBeNull();
  });

  it('finds the standing structure owned by a group', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', {});
    expect(structureForGroup(r, 'g1').id).toBe(s.id);
  });

  it('does not report a collapsed structure as its group\'s standing one', () => {
    const r = registry({ decay: 0.9 });
    foundStructure(r, 'g1', {});
    runMaintenance(r, groups({ g1: { members: [1] } }), { tick: 1 });
    expect(structureForGroup(r, 'g1')).toBeNull();
  });

  it('returns null for a group that owns nothing', () => {
    expect(structureForGroup(registry(), 'nobody')).toBeNull();
  });
});

describe('transferOwnership', () => {
  it('moves the claim to the new group', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', {});
    transferOwnership(r, s.id, 'g2');
    expect(getStructure(r, s.id).attributes.ownerGroupId).toBe('g2');
    expect(structureForGroup(r, 'g1')).toBeNull();
    expect(structureForGroup(r, 'g2').id).toBe(s.id);
  });

  it('emits a causal event naming both sides', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', {});
    transferOwnership(r, s.id, 'g2');
    const ev = r.lifecycle.events.find((e) => e.type === 'ownership-transferred');
    expect(ev.payload).toMatchObject({ from: 'g1', to: 'g2' });
  });

  it('preserves integrity and dependencies across the transfer', () => {
    const r = registry();
    const dep = foundStructure(r, 'g9', {});
    const s = foundStructure(r, 'g1', { requires: [dep.id] });
    transferOwnership(r, s.id, 'g2');
    const after = getStructure(r, s.id);
    expect(after.attributes.integrity).toBe(1);
    expect(after.attributes.requires).toEqual([dep.id]);
  });

  it('is a no-op when the group already owns it', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', {});
    const before = r.lifecycle.events.length;
    transferOwnership(r, s.id, 'g1');
    expect(r.lifecycle.events.length).toBe(before);
  });

  it('returns null for an unknown structure', () => {
    expect(transferOwnership(registry(), 'infrastructure:999', 'g2')).toBeNull();
  });
});

describe('dependencies', () => {
  it('a structure with no dependencies is satisfied', () => {
    const r = registry();
    expect(dependenciesSatisfied(r, foundStructure(r, 'g1', {}).id)).toBe(true);
  });

  it('a structure with a standing dependency is satisfied', () => {
    const r = registry();
    const dep = foundStructure(r, 'g9', {});
    const s = foundStructure(r, 'g1', { requires: [dep.id] });
    expect(dependenciesSatisfied(r, s.id)).toBe(true);
  });

  it('a structure whose dependency has collapsed is not satisfied', () => {
    const r = registry({ decay: 0.9 });
    const dep = foundStructure(r, 'g9', {});
    const s = foundStructure(r, 'g1', { requires: [dep.id] });
    runMaintenance(r, groups({ g9: { members: [1] } }), { tick: 1 });
    expect(dependenciesSatisfied(r, s.id)).toBe(false);
  });

  it('reports an unsatisfied dependency as dormant, not destroyed', () => {
    const r = registry({ decay: 0.9 });
    const dep = foundStructure(r, 'g9', {});
    const s = foundStructure(r, 'g1', { requires: [dep.id] });
    // g1 pays for its own upkeep so only g9's structure is lost; g1 must then
    // be dormant — present, intact and unfunded-by-its-dependency — rather
    // than destroyed.
    const g = groups({ g1: { members: [1], treasury: 100 }, g9: { members: [1], treasury: 0 } });
    const out = runMaintenance(r, g, { tick: 1, maintain: [s.id] });
    expect(out.collapsed).toEqual([dep.id]);
    expect(out.dormant).toBe(1);
    const after = getStructure(r, s.id);
    expect(after).toBeTruthy();
    expect(after.attributes.active).toBe(true);
    expect(after.attributes.integrity).toBe(1);
  });

  it('refuses a self-dependency', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', {});
    expect(addDependency(r, s.id, s.id)).toBeNull();
    expect(getStructure(r, s.id).attributes.requires).toEqual([]);
  });

  it('is idempotent', () => {
    const r = registry();
    const dep = foundStructure(r, 'g9', {});
    const s = foundStructure(r, 'g1', {});
    addDependency(r, s.id, dep.id);
    addDependency(r, s.id, dep.id);
    expect(getStructure(r, s.id).attributes.requires).toEqual([dep.id]);
  });

  it('lists the structures that depend on a given structure', () => {
    const r = registry();
    const hub = foundStructure(r, 'g1', { kind: 'HUB' });
    const a = foundStructure(r, 'g2', { requires: [hub.id] });
    const b = foundStructure(r, 'g3', { requires: [hub.id] });
    foundStructure(r, 'g4', {});
    const dependents = dependentsOf(r, hub.id);
    expect(dependents.sort()).toEqual([a.id, b.id].sort());
  });

  it('returns null when adding a dependency to an unknown structure', () => {
    expect(addDependency(registry(), 'infrastructure:999', 'infrastructure:1')).toBeNull();
  });
});

describe('runMaintenance — upkeep', () => {
  it('pays upkeep from the treasury and restores integrity', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', { kind: 'NEST' });
    const g = groups({ g1: { members: [1], treasury: 10 } });
    const out = runMaintenance(r, g, { tick: 1, maintain: [s.id] });
    expect(out.maintained).toBe(1);
    expect(out.decayed).toBe(0);
    expect(g.groups.get('g1').treasury).toBeCloseTo(10 - UPKEEP_COST.NEST, 6);
    expect(getStructure(r, s.id).attributes.integrity).toBe(1);
    expect(getStructure(r, s.id).attributes.upkeepPaid).toBeCloseTo(UPKEEP_COST.NEST, 6);
  });

  it('decays an unmaintained structure', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', {});
    const out = runMaintenance(r, groups({ g1: { members: [1], treasury: 100 } }), { tick: 1 });
    expect(out.decayed).toBe(1);
    expect(out.maintained).toBe(0);
    expect(getStructure(r, s.id).attributes.integrity).toBeCloseTo(1 - DEFAULT_DECAY, 6);
  });

  it('treats an unaffordable structure exactly like an unmaintained one', () => {
    const broke = registry();
    const a = foundStructure(broke, 'g1', {});
    const outBroke = runMaintenance(broke, groups({ g1: { members: [1], treasury: 0 } }), { tick: 1, maintain: [a.id] });

    const absent = registry();
    const b = foundStructure(absent, 'g1', {});
    const outAbsent = runMaintenance(absent, groups({}), { tick: 1, maintain: [b.id] });

    // A group that cannot pay must not be quietly rescued by the maintenance
    // path, and an absent group must not be treated as infinitely rich.
    expect(getStructure(broke, a.id).attributes.integrity)
      .toBeCloseTo(getStructure(absent, b.id).attributes.integrity, 6);
    expect(outBroke.decayed).toBe(outAbsent.decayed);
  });

  it('records why upkeep was skipped', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', {});
    runMaintenance(r, groups({ g1: { members: [1], treasury: 0 } }), { tick: 1, maintain: [s.id] });
    const ev = r.lifecycle.events.find((e) => e.type === 'upkeep-unaffordable');
    expect(ev).toBeTruthy();
    expect(ev.payload.cost).toBeCloseTo(UPKEEP_COST.NEST, 6);
  });

  it('never lets upkeep push integrity above 1', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', {});
    const g = groups({ g1: { members: [1], treasury: 100 } });
    for (let t = 1; t <= 10; t++) runMaintenance(r, g, { tick: t, maintain: [s.id] });
    expect(getStructure(r, s.id).attributes.integrity).toBe(1);
  });

  it('charges the per-kind cost, not a flat rate', () => {
    const r = registry();
    const road = foundStructure(r, 'g1', { kind: 'ROAD' });
    const hub = foundStructure(r, 'g2', { kind: 'HUB' });
    const g = groups({ g1: { members: [1], treasury: 100 }, g2: { members: [1], treasury: 100 } });
    const out = runMaintenance(r, g, { tick: 1, maintain: [road.id, hub.id] });
    expect(out.spent).toBeCloseTo(UPKEEP_COST.ROAD + UPKEEP_COST.HUB, 4);
  });

  it('accumulates upkeepPaid across passes', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', { kind: 'ROAD' });
    const g = groups({ g1: { members: [1], treasury: 100 } });
    runMaintenance(r, g, { tick: 1, maintain: [s.id] });
    runMaintenance(r, g, { tick: 2, maintain: [s.id] });
    expect(getStructure(r, s.id).attributes.upkeepPaid).toBeCloseTo(UPKEEP_COST.ROAD * 2, 6);
  });

  it('does not charge a collapsed structure', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', {});
    const g = groups({ g1: { members: [1], treasury: 100 } });
    for (let t = 1; t <= 40; t++) runMaintenance(r, g, { tick: t });
    const treasuryAfterCollapse = g.groups.get('g1').treasury;
    const out = runMaintenance(r, g, { tick: 41 });
    expect(out.maintained).toBe(0);
    expect(g.groups.get('g1').treasury).toBe(treasuryAfterCollapse);
  });
});

describe('runMaintenance — collapse', () => {
  it('collapses a structure that falls below the threshold', () => {
    const r = registry({ decay: 0.9 });
    const s = foundStructure(r, 'g1', {});
    const out = runMaintenance(r, groups({ g1: { members: [1] } }), { tick: 1 });
    expect(out.collapsed).toEqual([s.id]);
    expect(getStructure(r, s.id).attributes.active).toBe(false);
  });

  it('collapses exactly at the documented threshold', () => {
    const r = registry({ decay: 0.5 });
    const s = foundStructure(r, 'g1', {});
    runMaintenance(r, groups({ g1: { members: [1] } }), { tick: 1 });
    // 1 - 0.5 = 0.5, comfortably above the threshold: still standing.
    expect(getStructure(r, s.id).attributes.active).toBe(true);
    runMaintenance(r, groups({ g1: { members: [1] } }), { tick: 2 });
    // 0.5 - 0.5 = 0, at/below COLLAPSE_THRESHOLD: abandoned.
    expect(getStructure(r, s.id).attributes.active).toBe(false);
    expect(COLLAPSE_THRESHOLD).toBe(0.15);
  });

  it('closes the record with a reason and an event', () => {
    const r = registry({ decay: 0.9 });
    const s = foundStructure(r, 'g1', {});
    runMaintenance(r, groups({ g1: { members: [1] } }), { tick: 1 });
    const rec = r.lifecycle.records.get(s.id);
    expect(rec.status).toBe('closed');
    expect(rec.attributes.closeReason).toBe('collapsed');
    expect(r.lifecycle.events.some((e) => e.type === 'collapsed')).toBe(true);
  });

  it('collapses only once', () => {
    const r = registry({ decay: 0.9 });
    foundStructure(r, 'g1', {});
    const g = groups({ g1: { members: [1] } });
    expect(runMaintenance(r, g, { tick: 1 }).collapsed).toHaveLength(1);
    expect(runMaintenance(r, g, { tick: 2 }).collapsed).toHaveLength(0);
  });

  it('reports dormancy without counting it as collapse', () => {
    const r = registry({ decay: 0.9 });
    const dep = foundStructure(r, 'g9', {});
    const s = foundStructure(r, 'g1', { requires: [dep.id] });
    const g = groups({ g1: { members: [1], treasury: 100 } });
    // g1 is funded and maintained; g9 is not in the registry at all, so its
    // structure decays all the way and collapses. g1 is left standing but
    // dormant — the two conditions must not be conflated.
    const out = runMaintenance(r, g, { tick: 1, maintain: [s.id] });
    expect(out.collapsed).toEqual([dep.id]);
    expect(out.dormant).toBe(1);
    expect(getStructure(r, s.id).attributes.active).toBe(true);
  });
});

describe('runMaintenance — robustness', () => {
  it('tolerates a missing group registry', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', {});
    expect(() => runMaintenance(r, null, { tick: 1 })).not.toThrow();
    expect(getStructure(r, s.id).attributes.integrity).toBeCloseTo(1 - DEFAULT_DECAY, 6);
  });

  it('tolerates a missing group map', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', {});
    expect(() => runMaintenance(r, {}, { tick: 1, maintain: [s.id] })).not.toThrow();
    expect(getStructure(r, s.id).attributes.active).toBe(true);
  });

  it('accepts a Set for the maintain list', () => {
    const r = registry();
    const s = foundStructure(r, 'g1', {});
    const out = runMaintenance(r, groups({ g1: { members: [1], treasury: 10 } }), { tick: 1, maintain: new Set([s.id]) });
    expect(out.maintained).toBe(1);
  });

  it('advances the registry tick monotonically', () => {
    const r = registry();
    runMaintenance(r, groups({}), { tick: 5 });
    runMaintenance(r, groups({}));
    expect(r.tick).toBe(6);
  });

  it('handles an empty registry', () => {
    const r = registry();
    const out = runMaintenance(r, groups({}), { tick: 1 });
    expect(out).toMatchObject({ maintained: 0, decayed: 0, dormant: 0 });
    expect(out.collapsed).toEqual([]);
  });
});

describe('structureReport', () => {
  it('counts nothing in an empty registry', () => {
    expect(structureReport(registry())).toEqual({
      total: 0, standing: 0, dormant: 0, collapsed: 0, kinds: {}, tick: 0,
    });
  });

  it('separates standing from collapsed and breaks down by kind', () => {
    const r = registry({ decay: 0.9 });
    const nest = foundStructure(r, 'g1', { kind: 'NEST' });
    foundStructure(r, 'g2', { kind: 'HIVE' });
    const g = groups({ g1: { members: [1], treasury: 100 }, g2: { members: [1] } });
    runMaintenance(r, g, { tick: 1, maintain: [nest.id] });
    const rep = structureReport(r);
    expect(rep.total).toBe(2);
    expect(rep.collapsed).toBe(1);
    expect(rep.standing).toBe(1);
    expect(rep.kinds).toEqual({ NEST: 1, HIVE: 1 });
  });

  it('tracks the maintenance tick', () => {
    const r = registry();
    runMaintenance(r, groups({}), { tick: 12 });
    expect(structureReport(r).tick).toBe(12);
  });
});
