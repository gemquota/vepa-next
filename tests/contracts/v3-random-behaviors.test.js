import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeterministicRandomStreams } from '../../src/core/random-streams.js';
import { createV3RandomBehaviorStreams } from '../../src/sim/v3-random-behaviors.js';

function make(seed = 91) {
  return createV3RandomBehaviorStreams({
    streams: createDeterministicRandomStreams({ seed }),
    worldId: 'world-A',
  });
}

test('per-particle draw groups are repeatable and isolated by behavior domain', () => {
  const a = make(), b = make();
  assert.deepEqual(a.genotypeDrift('particle:2:1'), b.genotypeDrift('particle:2:1'));
  assert.deepEqual(a.heatJitter('particle:2:1'), b.heatJitter('particle:2:1'));
  assert.notDeepEqual(a.genotypeDrift('particle:2:1'), make(92).genotypeDrift('particle:2:1'));
});

test('reproduction gate is world-scoped and child initialization is child-scoped', () => {
  const a = make(), b = make();
  assert.equal(a.reproductionGate(), b.reproductionGate());
  assert.deepEqual(a.childInitialization('particle:7:1'), b.childInitialization('particle:7:1'));
  assert.equal(a.childInitialization('particle:7:1').speciesIndex < 12, true);
});

test('biology and chemistry draw shapes match the audited source ordering', () => {
  const r = make();
  assert.equal(typeof r.senescenceDeath('p'), 'number');
  const drift = r.genotypeDrift('p');
  assert.ok(drift.traitIndex >= 0 && drift.traitIndex < 42);
  const iso = r.isomerization('p');
  assert.ok(iso.speciesIndex >= 0 && iso.speciesIndex < 12);
  assert.equal(r.childInitialization('child').position.length, 3);
  assert.equal(r.childInitialization('child').velocity.length, 3);
  assert.equal(r.heatJitter('p').length, 3);
  assert.equal(r.meltJitter('p').length, 3);
  assert.equal(r.boilJitter('p').length, 3);
  assert.equal(r.intrinsicJitter('p').length, 3);
  const chaos = r.chaosGate('p');
  assert.equal(typeof chaos.gate, 'number');
  assert.equal(chaos.vector().length, 3);
  assert.throws(() => chaos.vector(), /already been consumed/);
  assert.equal(typeof r.allotropy('p1', 'p2'), 'number');
  assert.equal(typeof r.phaseThrough('p1', 'p2'), 'number');
  assert.equal(r.exothermicHeat('p1', 'p2').length, 2);
});

test('pair-scoped draws are invariant to pair traversal direction', () => {
  const a = make(), b = make();
  assert.equal(a.allotropy('particle:1:1', 'particle:2:1'), b.allotropy('particle:2:1', 'particle:1:1'));
  assert.equal(a.phaseThrough('particle:1:1', 'particle:2:1'), b.phaseThrough('particle:2:1', 'particle:1:1'));
  assert.deepEqual(a.exothermicHeat('particle:1:1', 'particle:2:1'), b.exothermicHeat('particle:2:1', 'particle:1:1'));
});

test('invalid identities fail rather than silently sharing streams', () => {
  const r = make();
  assert.throws(() => r.heatJitter(''), /particleId/);
  assert.throws(() => r.allotropy('', 'p2'), /particle ID/);
});
