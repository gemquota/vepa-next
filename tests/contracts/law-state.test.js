import test from 'node:test';
import assert from 'node:assert/strict';
import { createLawGraph, evaluateLawStates } from '../../src/sim/law-state.js';

const laws = [
  { id: 'law.power', name: 'Power' },
  { id: 'law.field', name: 'Field' },
  { id: 'law.impact', name: 'Impact' },
  { id: 'law.classical', name: 'Classical model' },
  { id: 'law.quantum', name: 'Quantum model' },
  { id: 'law.signal', name: 'Signal' },
];
const relationships = [
  { from: 'law.power', to: 'law.field', type: 'requires' },
  { from: 'law.field', to: 'law.impact', type: 'enables' },
  { from: 'law.classical', to: 'law.quantum', type: 'conflicts' },
  { from: 'law.power', to: 'law.signal', type: 'interacts' },
];

test('four law states are resolved from explicit dependencies', () => {
  const graph = createLawGraph({ laws, relationships });
  const initial = graph.evaluate();
  assert.equal(initial.get('law.power').status, 'unavailable');
  assert.deepEqual(initial.get('law.power').missingRequirements, ['law.field']);
  assert.equal(initial.get('law.field').status, 'available');
  assert.equal(initial.get('law.impact').status, 'available');

  const withField = graph.evaluate(['law.field']);
  assert.equal(withField.get('law.power').status, 'primed');
  assert.equal(withField.get('law.field').status, 'active');
  assert.equal(withField.get('law.impact').status, 'available');
});

test('disabling and conflicts grey out a law without deleting it', () => {
  const graph = createLawGraph({ laws, relationships });
  const states = graph.evaluate(['law.classical']);
  assert.equal(states.get('law.quantum').status, 'unavailable');
  assert.deepEqual(states.get('law.quantum').blockedBy, [{ lawId: 'law.classical', type: 'conflicts' }]);
  assert.equal(states.list().length, laws.length);
});

test('active set validation catches missing prerequisites and simultaneous conflicts', () => {
  const missing = evaluateLawStates({ laws, relationships, activeIds: new Set(['law.power']) });
  assert.equal(missing.validateActiveSet().valid, false);
  assert.equal(missing.validateActiveSet().errors[0].reason, 'missing-requirements');

  const conflict = evaluateLawStates({ laws, relationships, activeIds: new Set(['law.classical', 'law.quantum']) });
  assert.equal(conflict.validateActiveSet().valid, false);
  assert.ok(conflict.validateActiveSet().errors.some(error => error.reason === 'blocked-by-active-law'));
});

test('interaction relationships are inspectable but do not block activation', () => {
  const graph = createLawGraph({ laws, relationships });
  const states = graph.evaluate();
  assert.equal(states.get('law.power').status, 'unavailable');
  assert.equal(states.get('law.signal').status, 'available');
  assert.deepEqual(graph.getRelated('law.signal'), [{ from: 'law.power', to: 'law.signal', type: 'interacts' }]);
});

test('graph rejects unknown endpoints, unknown relation types, and duplicate law IDs', () => {
  assert.throws(() => createLawGraph({ laws, relationships: [{ from: 'law.ghost', to: 'law.field', type: 'requires' }] }), /unknown law/);
  assert.throws(() => createLawGraph({ laws, relationships: [{ from: 'law.power', to: 'law.field', type: 'magic' }] }), /unknown relationship type/);
  assert.throws(() => createLawGraph({ laws: [laws[0], laws[0]] }), /duplicate law id/);
});
