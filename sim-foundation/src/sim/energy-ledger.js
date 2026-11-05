/**
 * Versioned deterministic energy ledger.
 *
 * This ledger records explicit energy transfers; it does not infer missing
 * physics from particle slots. Accounts are typed and transfers are atomic.
 * Potential-energy models and solver-specific transfer hooks must be supplied
 * by the subsystem that owns those quantities.
 */
export const ENERGY_LEDGER_SCHEMA = 'vepa.energy-ledger';
export const ENERGY_LEDGER_VERSION = 1;

const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new RangeError(label + ' must be finite');
  return value;
};
const name = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(label + ' must be a non-empty string');
  return value;
};
function compensatedSum(values) {
  let sum = 0, correction = 0;
  for (const value of values) {
    const adjusted = value - correction;
    const next = sum + adjusted;
    correction = (next - sum) - adjusted;
    sum = next;
  }
  return sum;
}
function cloneEvent(event) { return Object.freeze({ ...event }); }

export function createEnergyLedger({ tick = 0, snapshot = null, maxEvents = 10000 } = {}) {
  if (!Number.isInteger(maxEvents) || maxEvents < 0) throw new RangeError('maxEvents must be a non-negative integer');
  const accounts = new Map();
  let events = [];
  let currentTick = tick;
  let sequence = 0;
  if (!Number.isInteger(currentTick) || currentTick < 0) throw new RangeError('tick must be a non-negative integer');

  function validateSnapshot(value) {
    if (!value || value.schema !== ENERGY_LEDGER_SCHEMA || value.version !== ENERGY_LEDGER_VERSION ||
        !Number.isInteger(value.tick) || value.tick < 0 || !Array.isArray(value.accounts) || !Array.isArray(value.events)) {
      throw new TypeError('Invalid or unsupported energy ledger snapshot');
    }
    const nextAccounts = new Map();
    for (const account of value.accounts) {
      const id = name(account.id, 'account.id');
      if (nextAccounts.has(id)) throw new TypeError('Duplicate energy account: ' + id);
      nextAccounts.set(id, Object.freeze({
        id, type: name(account.type, 'account.type'),
        balance: finite(account.balance, 'account.balance'),
        allowNegative: account.allowNegative === true,
      }));
    }
    let lastSequence = 0;
    const nextEvents = value.events.map(event => {
      if (!Number.isInteger(event.sequence) || event.sequence <= lastSequence ||
          !Number.isInteger(event.tick) || event.tick < 0 ||
          !nextAccounts.has(event.source) || !nextAccounts.has(event.destination) ||
          !Number.isFinite(event.amount) || event.amount <= 0) throw new TypeError('Invalid energy ledger event');
      lastSequence = event.sequence;
      return cloneEvent(event);
    });
    if (nextEvents.length > maxEvents) throw new RangeError('Snapshot exceeds maxEvents');
    if (value.sequence !== undefined && value.sequence !== lastSequence) throw new TypeError('Snapshot sequence does not match its event journal');
    if (nextEvents.some(event => event.tick > value.tick)) throw new TypeError('Snapshot contains an event beyond its current tick');
    return { accounts: nextAccounts, events: nextEvents, tick: value.tick, sequence: lastSequence };
  }

  if (snapshot) {
    const restored = validateSnapshot(snapshot);
    for (const [id, account] of restored.accounts) accounts.set(id, account);
    events = restored.events;
    currentTick = restored.tick;
    sequence = restored.sequence;
  }

  function readAccount(id) {
    const account = accounts.get(id);
    if (!account) throw new RangeError('Unknown energy account: ' + id);
    return account;
  }
  function createAccount({ id, type, initialBalance = 0, allowNegative = false }) {
    id = name(id, 'account.id'); type = name(type, 'account.type');
    finite(initialBalance, 'initialBalance');
    if (typeof allowNegative !== 'boolean') throw new TypeError('allowNegative must be boolean');
    if (initialBalance < 0 && !allowNegative) throw new RangeError('initialBalance cannot be negative');
    if (accounts.has(id)) throw new Error('Energy account already exists: ' + id);
    accounts.set(id, Object.freeze({ id, type, balance: initialBalance, allowNegative }));
    return accounts.get(id);
  }
  function transfer({ source, destination, amount, cause, tick = currentTick, metadata = null }) {
    return transact([{ source, destination, amount, cause, tick, metadata }])[0];
  }
  function transact(transfers) {
    if (!Array.isArray(transfers) || transfers.length === 0) throw new TypeError('transfers must be a non-empty array');
    const projected = new Map();
    const normalized = transfers.map((entry, index) => {
      const source = name(entry.source, 'transfer.source');
      const destination = name(entry.destination, 'transfer.destination');
      const cause = name(entry.cause, 'transfer.cause');
      const amount = finite(entry.amount, 'transfer.amount');
      const eventTick = entry.tick ?? currentTick;
      if (source === destination) throw new RangeError('Energy transfer source and destination must differ');
      if (amount <= 0) throw new RangeError('Energy transfer amount must be positive');
      if (!Number.isInteger(eventTick) || eventTick < 0 || eventTick !== currentTick) throw new RangeError('Energy transfer tick must equal the current ledger tick');
      if (entry.metadata != null && (typeof entry.metadata !== 'object' || Array.isArray(entry.metadata))) throw new TypeError('transfer.metadata must be an object or null');
      const from = readAccount(source), to = readAccount(destination);
      const fromBalance = projected.has(source) ? projected.get(source) : from.balance;
      const toBalance = projected.has(destination) ? projected.get(destination) : to.balance;
      const nextFrom = fromBalance - amount, nextTo = toBalance + amount;
      if (!Number.isFinite(nextFrom) || !Number.isFinite(nextTo)) throw new RangeError('Energy transfer would produce a non-finite balance');
      if (!from.allowNegative && nextFrom < -1e-12) throw new RangeError('Insufficient energy in account: ' + source);
      projected.set(source, nextFrom < 0 && nextFrom > -1e-12 ? 0 : nextFrom);
      projected.set(destination, nextTo);
      return { source, destination, amount, cause, tick: eventTick, metadata: entry.metadata == null ? null : structuredClone(entry.metadata), index };
    });
    if (events.length + normalized.length > maxEvents) throw new RangeError('Energy ledger event capacity exceeded');
    // Commit only after every transfer has passed validation.
    for (const [id, balance] of projected) {
      const account = accounts.get(id);
      accounts.set(id, Object.freeze({ ...account, balance }));
    }
    const created = normalized.map(entry => {
      const event = Object.freeze({ sequence: ++sequence, tick: entry.tick, source: entry.source,
        destination: entry.destination, amount: entry.amount, cause: entry.cause, metadata: entry.metadata });
      events.push(event);
      return event;
    });
    return Object.freeze(created);
  }
  function setTick(nextTick) {
    if (!Number.isInteger(nextTick) || nextTick < currentTick) throw new RangeError('Ledger tick must be a monotonic non-negative integer');
    currentTick = nextTick;
    return currentTick;
  }
  function summary() {
    const values = [...accounts.values()];
    const totalsByType = new Map();
    for (const account of values) {
      if (!totalsByType.has(account.type)) totalsByType.set(account.type, []);
      totalsByType.get(account.type).push(account.balance);
    }
    const typeTotals = Object.freeze(Object.fromEntries([...totalsByType].sort(([a], [b]) => a.localeCompare(b)).map(([type, balances]) => [type, compensatedSum(balances)])));
    return Object.freeze({
      schema: ENERGY_LEDGER_SCHEMA, version: ENERGY_LEDGER_VERSION, tick: currentTick,
      accountCount: values.length, eventCount: events.length,
      totalBalance: compensatedSum(values.map(account => account.balance)),
      totalsByType: typeTotals,
      accounts: Object.freeze(values.map(account => Object.freeze({ ...account }))),
    });
  }
  function audit() {
    const balances = new Map([...accounts].map(([id, account]) => [id, account.balance]));
    const incoming = new Map(), outgoing = new Map();
    for (const event of events) {
      outgoing.set(event.source, (outgoing.get(event.source) ?? 0) + event.amount);
      incoming.set(event.destination, (incoming.get(event.destination) ?? 0) + event.amount);
    }
    const rows = [...accounts.values()].map(account => Object.freeze({
      id: account.id, openingBalance: account.balance - (incoming.get(account.id) ?? 0) + (outgoing.get(account.id) ?? 0),
      incoming: incoming.get(account.id) ?? 0, outgoing: outgoing.get(account.id) ?? 0, closingBalance: balances.get(account.id),
    }));
    return Object.freeze({ rows: Object.freeze(rows), transferResidual: compensatedSum(rows.map(row => row.incoming - row.outgoing)) });
  }
  function createSnapshot() {
    return Object.freeze({ schema: ENERGY_LEDGER_SCHEMA, version: ENERGY_LEDGER_VERSION, tick: currentTick,
      sequence, accounts: Object.freeze([...accounts.values()].map(account => Object.freeze({ ...account }))),
      events: Object.freeze(events.map(event => cloneEvent(event))) });
  }

  return Object.freeze({
    get tick() { return currentTick; },
    createAccount, transfer, transact, setTick, summary, audit,
    getAccount(id) { return Object.freeze({ ...readAccount(id) }); },
    listEvents({ afterSequence = 0 } = {}) {
      if (!Number.isInteger(afterSequence) || afterSequence < 0) throw new RangeError('afterSequence must be non-negative');
      return Object.freeze(events.filter(event => event.sequence > afterSequence).map(cloneEvent));
    },
    createSnapshot,
  });
}
