import test from 'node:test';
import assert from 'node:assert/strict';
import { createLawRegistry } from '../../src/sim/law-registry.js';
import { createLawCommandAdapter } from '../../src/sim/law-commands.js';

test('law commands normalize WRAP through the world session proposal', async () => {
 const registry = createLawRegistry();
 for (const id of ['law.gravity', 'law.wrap', 'law.predation']) registry.register({ id, version: 1, step() {} });
 let config = { boundaryMode: 'toroidal', activeLawIds: ['law.gravity', 'law.wrap'] };
 const proposals = [];
 const session = { getSnapshot: () => ({ config: structuredClone(config) }), async proposeConfig(next, context) { config = structuredClone(next); proposals.push({ next, context }); return { status: 'committed' }; } };
 const commands = createLawCommandAdapter({ session, registry });
 await commands.setLawActive('law.predation', true);
 assert.equal(proposals.length, 1);
 assert.equal(proposals[0].context.command, 'laws.set-active');
 await commands.setLawActive('law.wrap', false);
 assert.equal(config.boundaryMode, 'reflective');
 assert.ok(!config.activeLawIds.includes('law.wrap'));
 await commands.replaceActiveLaws([]);
 assert.deepEqual(config.activeLawIds, []);
});

test('unknown law IDs fail before the session receives a proposal', () => {
 const registry = createLawRegistry();
 registry.register({ id: 'law.wrap', version: 1, step() {} });
 let calls = 0;
 const session = { getSnapshot: () => ({ config: { boundaryMode: 'reflective', activeLawIds: [] } }), proposeConfig: async () => { calls++; return { status: 'committed' }; } };
 const commands = createLawCommandAdapter({ session, registry });
 assert.throws(() => commands.setLawActive('law.unknown', true), /Unknown or non-executable/);
 assert.equal(calls, 0);
});
