import test from 'node:test';
import assert from 'node:assert/strict';
import { createLawRegistry } from '../../src/sim/law-registry.js';
import { createLawCommandAdapter } from '../../src/sim/law-commands.js';
import { createWorldSession } from '../../src/state/world-session.js';

function buildSession({ failApply = false } = {}) {
  const registry = createLawRegistry();
  for (const id of ['law.gravity', 'law.wrap', 'law.predation']) registry.register({ id, version: 1, step() {} });
  const session = createWorldSession({
    worldId: 'law-session-integration',
    initialConfig: { boundaryMode: 'toroidal', activeLawIds: ['law.gravity', 'law.wrap'], worldSize: 2000 },
    validateConfig: candidate => {
      if (!candidate || !Array.isArray(candidate.activeLawIds)) return { valid: false, reason: 'missing-law-list' };
      if (candidate.activeLawIds.includes('law.wrap') !== (candidate.boundaryMode === 'toroidal')) return { valid: false, reason: 'boundary-mismatch' };
      if (candidate.activeLawIds.some(id => !registry.has(id))) return { valid: false, reason: 'unknown-law' };
      return { valid: true, value: candidate };
    },
    applyConfig: async () => { if (failApply) throw new Error('simulated adapter failure'); },
  });
  return { session, registry, commands: createLawCommandAdapter({ session, registry }) };
}

test('law commands commit through real world-session transactions', async () => {
  const { session, commands } = buildSession();
  const result = await commands.replaceActiveLaws([]);
  assert.equal(result.status, 'committed');
  assert.deepEqual(session.getSnapshot().config.activeLawIds, ['law.wrap']);
  assert.equal(session.getSnapshot().config.boundaryMode, 'toroidal');
  assert.equal(session.getEvents()[0].type, 'world.config-committed');
});

test('explicit WRAP disable commits reflective mode through validation', async () => {
  const { session, commands } = buildSession();
  const result = await commands.setLawActive('law.wrap', false);
  assert.equal(result.status, 'committed');
  assert.equal(session.getSnapshot().config.boundaryMode, 'reflective');
  assert.ok(!session.getSnapshot().config.activeLawIds.includes('law.wrap'));
});

test('failed runtime apply rolls a law command back to the last known config', async () => {
  const { session, commands } = buildSession({ failApply: true });
  const result = await commands.setLawActive('law.predation', true);
  assert.equal(result.status, 'rolled-back');
  assert.deepEqual(session.getSnapshot().config.activeLawIds, ['law.gravity', 'law.wrap']);
  assert.equal(session.getSnapshot().generation, 0);
  assert.equal(session.getEvents()[0].type, 'world.config-rolled-back');
});
