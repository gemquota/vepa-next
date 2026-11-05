import test from 'node:test';
import assert from 'node:assert/strict';
import { STABLE_LAW_INVENTORY, STABLE_LAW_SOURCE, STABLE_LAW_COMPATIBILITY } from '../../src/sim/stable-law-inventory.js';

test('stable law inventory covers every source index exactly once', () => {
 assert.equal(STABLE_LAW_SOURCE.declaredLawCount, 136);
 assert.equal(STABLE_LAW_INVENTORY.length, 136);
 assert.deepEqual(STABLE_LAW_INVENTORY.map(law => law.stableIndex), Array.from({length:136}, (_,i)=>i));
 assert.equal(new Set(STABLE_LAW_INVENTORY.map(law=>law.canonicalId)).size, 136);
 assert.ok(STABLE_LAW_INVENTORY.every(law => law.category !== 'uncategorized'));
});

test('inventory separates prototype work and unresolved legacy semantics from migrated laws', () => {
 assert.equal(STABLE_LAW_INVENTORY.find(law=>law.stableName==='GRAV').migrationStatus, 'prototype-only');
 assert.equal(STABLE_LAW_INVENTORY.find(law=>law.stableName==='INERTIA').migrationStatus, 'review-required');
 assert.equal(STABLE_LAW_COMPATIBILITY.WRAP.canonicalTarget, 'boundaryMode');
 assert.ok(!STABLE_LAW_INVENTORY.some(law=>law.stableName==='WRAP'));
});
