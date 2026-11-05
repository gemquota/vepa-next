import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnergyLedger, ENERGY_LEDGER_SCHEMA, ENERGY_LEDGER_VERSION } from '../../src/sim/energy-ledger.js';

function ledger() {
  const value = createEnergyLedger({ maxEvents: 20 });
  value.createAccount({ id: 'source', type: 'external', initialBalance: 100 });
  value.createAccount({ id: 'heat', type: 'thermal' });
  value.createAccount({ id: 'work', type: 'kinetic' });
  return value;
}

test('ledger validates typed accounts and records provenance with monotonic sequences', () => {
  const value = ledger();
  const event = value.transfer({ source: 'source', destination: 'heat', amount: 12.5, cause: 'friction', metadata: { pair: [2, 7] } });
  assert.equal(event.sequence, 1);
  assert.equal(event.tick, 0);
  assert.deepEqual(event.metadata, { pair: [2, 7] });
  assert.equal(value.getAccount('source').balance, 87.5);
  assert.equal(value.getAccount('heat').balance, 12.5);
  assert.equal(value.summary().totalBalance, 100);
});

test('multi-transfer transaction is atomic when any later transfer is invalid', () => {
  const value = ledger();
  assert.throws(() => value.transact([
    { source: 'source', destination: 'heat', amount: 20, cause: 'valid-first' },
    { source: 'heat', destination: 'work', amount: 21, cause: 'insufficient-second' },
  ]), /Insufficient energy/);
  assert.equal(value.getAccount('source').balance, 100);
  assert.equal(value.getAccount('heat').balance, 0);
  assert.equal(value.listEvents().length, 0);
});

test('ledger rejects non-finite, non-positive, unknown and stale transfers without mutation', () => {
  const value = ledger();
  for (const amount of [0, -1, NaN, Infinity]) {
    assert.throws(() => value.transfer({ source: 'source', destination: 'heat', amount, cause: 'invalid' }));
  }
  assert.throws(() => value.transfer({ source: 'missing', destination: 'heat', amount: 1, cause: 'unknown' }), /Unknown/);
  value.setTick(3);
  assert.throws(() => value.transfer({ source: 'source', destination: 'heat', amount: 1, cause: 'stale', tick: 2 }), /tick/);
  assert.equal(value.getAccount('source').balance, 100);
  assert.equal(value.listEvents().length, 0);
});

test('signed potential accounts support reversible transfers while ordinary accounts cannot go negative', () => {
  const value = ledger();
  value.createAccount({ id: 'potential', type: 'potential-energy', initialBalance: -5, allowNegative: true });
  value.transfer({ source: 'source', destination: 'potential', amount: 8, cause: 'potential-rise' });
  assert.equal(value.getAccount('potential').balance, 3);
  assert.throws(() => value.transfer({ source: 'heat', destination: 'source', amount: 1, cause: 'overdraw' }), /Insufficient/);
});

test('snapshots preserve ledger version, balances, event history and deterministic continuation', () => {
  const value = ledger();
  value.transfer({ source: 'source', destination: 'heat', amount: 5, cause: 'conduction' });
  value.setTick(4);
  const snapshot = value.createSnapshot();
  assert.equal(snapshot.schema, ENERGY_LEDGER_SCHEMA);
  assert.equal(snapshot.version, ENERGY_LEDGER_VERSION);
  const restored = createEnergyLedger({ snapshot });
  assert.deepEqual(restored.createSnapshot(), snapshot);
  const a = value.transfer({ source: 'source', destination: 'work', amount: 7, cause: 'work' });
  const b = restored.transfer({ source: 'source', destination: 'work', amount: 7, cause: 'work' });
  assert.deepEqual(a, b);
  assert.deepEqual(value.summary(), restored.summary());
});

test('snapshot restore rejects duplicate accounts and unsupported versions', () => {
  const snapshot = ledger().createSnapshot();
  assert.throws(() => createEnergyLedger({ snapshot: { ...snapshot, version: 99 } }), /snapshot/);
  assert.throws(() => createEnergyLedger({ snapshot: { ...snapshot, accounts: [...snapshot.accounts, snapshot.accounts[0]] } }), /Duplicate/);
});

test('audit reconciles every account from the event journal', () => {
  const value = ledger();
  value.transfer({ source: 'source', destination: 'heat', amount: 10, cause: 'drag-heat' });
  value.transfer({ source: 'heat', destination: 'work', amount: 3, cause: 'thermal-work' });
  const audit = value.audit();
  assert.equal(audit.transferResidual, 0);
  assert.deepEqual(audit.rows.map(row => row.closingBalance), [90, 7, 3]);
});
