import test from 'node:test';
import assert from 'node:assert/strict';
import { createLawRegistry } from '../../src/sim/law-registry.js';
import { createLawCommandAdapter } from '../../src/sim/law-commands.js';

test('individual and bulk changes share one proposal path', async () => {
 const registry = createLawRegistry();
 for (const id of ['law.gravity', 'law.predation']) registry.register({ id, version: 1, step() {} });
 let config = { boundaryMode: 'toroidal', activeLawIds: ['law.gravity'] };
 const proposals = [];
 const session = { getSnapshot: () => ({ config: structuredClone(config) }), async proposeConfig(next, context) { config = structuredClone(next); proposals.push({ next, context }); return { status: 'committed' }; } };
 const commands = createLawCommandAdapter({ session, registry });
 await commands.setLawActive('law.predation', true);
 assert.equal(proposals[0].context.command, 'laws.set-active');
 assert.deepEqual(config.activeLawIds, ['law.gravity', 'law.predation']);
 await commands.setLawActive('law.wrap', false);
 assert.equal(config.boundaryMode, 'reflective');
 assert.deepEqual(config.activeLawIds, ['law.gravity', 'law.predation']);
 await commands.replaceActiveLaws([]);
 assert.deepEqual(config.activeLawIds, []);
 assert.equal(config.boundaryMode, 'reflective');
});

test('unknown law IDs fail before a proposal', () => {
 const registry = createLawRegistry(); registry.register({ id: 'law.gravity', version: 1, step() {} });
 let calls = 0;
 const session = { getSnapshot: () => ({ config: { boundaryMode: 'reflective', activeLawIds: [] } }), proposeConfig: async () => { calls++; return { status: 'committed' }; } };
 const commands = createLawCommandAdapter({ session, registry });
 assert.throws(() => commands.setLawActive('law.unknown', true), /Unknown or non-executable/);
 assert.equal(calls, 0);
});
