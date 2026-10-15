import { createEventEnvelope } from '../core/event-envelope.js';
import { createTransactionCoordinator } from './transaction.js';
import { createEventJournal } from './event-journal.js';
import { createWorldSnapshot } from './snapshot.js';


function eventSafeValue(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'undefined') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return String(value);
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return Array.from(value, item => eventSafeValue(item, seen));
  }
  if (seen.has(value)) return '[Circular]';
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return '[Unsupported ' + (value.constructor?.name ?? 'object') + ']';
  }
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    result = value.map(item => eventSafeValue(item, seen));
  } else {
    result = {};
    for (const key of Object.keys(value).sort()) {
      Object.defineProperty(result, key, {
        value: eventSafeValue(value[key], seen),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }
  seen.delete(value);
  return result;
}

function defaultClone(value) {
  if (typeof structuredClone !== 'function') throw new Error('Provide cloneValue where structuredClone is unavailable');
  return structuredClone(value);
}

/**
 * Small SIM world-session boundary. This is not yet connected to the legacy
 * physics worker; it establishes the single owner for configuration commits,
 * generation changes, tick metadata and committed-event ordering.
 */
export function createWorldSession({
  worldId,
  initialConfig = {},
  validateConfig = candidate => ({ valid: !!candidate && typeof candidate === 'object' && !Array.isArray(candidate) }),
  applyConfig = async () => {},
  restoreConfig = async () => {},
  cloneValue = defaultClone,
} = {}) {
  if (typeof worldId !== 'string' || !worldId) throw new TypeError('worldId is required');
  if (typeof validateConfig !== 'function' || typeof applyConfig !== 'function' ||
      typeof restoreConfig !== 'function' || typeof cloneValue !== 'function') {
    throw new TypeError('config callbacks and cloneValue must be functions');
  }
  let config = cloneValue(initialConfig);
  let generation = 0;
  let tick = 0;
  let sequence = 0;
  const journal = createEventJournal(worldId);

  function append(type, payload, sourceModule, schemaVersion = 1) {
    const event = createEventEnvelope({
      eventId: worldId + ':' + sequence,
      type,
      schemaVersion,
      worldId,
      tick,
      sequence,
      sourceModule,
      payload,
    });
    const result = journal.append(event);
    if (!result.accepted) throw new Error('Event journal rejected commit: ' + result.reason);
    sequence++;
    return result.event;
  }

  const transactions = createTransactionCoordinator({
    getCurrent: () => cloneValue(config),
    validate: async (proposal, context) => {
      const verdict = await validateConfig(proposal, {
        current: cloneValue(context.before),
        generation,
        transactionId: context.transactionId,
      });
      if (!verdict || verdict.valid !== true) return verdict ?? { valid: false, reason: 'validator-returned-no-result' };
      return { ...verdict, value: cloneValue(verdict.value ?? proposal) };
    },
    apply: async (candidate, context) => {
      const previous = config;
      config = cloneValue(candidate);
      const nextGeneration = generation + 1;
      try {
        await applyConfig(cloneValue(config), { generation: nextGeneration, transactionId: context.transactionId });
        const event = append('world.config-committed', {
          transactionId: context.transactionId,
          generation: nextGeneration,
          requestedConfig: eventSafeValue(context.requestedConfig ?? candidate),
          beforeConfig: eventSafeValue(context.before),
          actualConfig: eventSafeValue(config),
        }, 'session.world', 2);
        generation = nextGeneration;
        return { generation, event };
      } catch (error) {
        config = previous;
        throw error;
      }
    },
    restore: async (before, context) => {
      config = cloneValue(before);
      await restoreConfig(cloneValue(before), { transactionId: context.transactionId, error: context.error });
    },
  });

  return Object.freeze({
    getSnapshot() {
      return Object.freeze({
        worldId,
        tick,
        generation,
        config: cloneValue(config),
        lastEventSequence: journal.lastSequence,
      });
    },
    createSnapshot({ simulationState, prngState = null, fidelityPolicy = null } = {}) {
      return createWorldSnapshot({
        worldId,
        tick,
        generation,
        config: cloneValue(config),
        simulationState: cloneValue(simulationState),
        prngState: cloneValue(prngState),
        fidelityPolicy: cloneValue(fidelityPolicy),
        lastEventSequence: journal.lastSequence,
      });
    },
    saveCheckpoint(snapshotStore, { simulationState, prngState = null, fidelityPolicy = null } = {}) {
      if (!snapshotStore || typeof snapshotStore.save !== 'function') {
        throw new TypeError('snapshotStore must provide save(snapshot)');
      }
      const snapshot = createWorldSnapshot({
        worldId,
        tick,
        generation,
        config: cloneValue(config),
        simulationState: cloneValue(simulationState),
        prngState: cloneValue(prngState),
        fidelityPolicy: cloneValue(fidelityPolicy),
        lastEventSequence: journal.lastSequence,
      });
      return { snapshot, storage: snapshotStore.save(snapshot) };
    },
    async proposeConfig(proposal, context = {}) {
      const requestedConfig = eventSafeValue(proposal);
      const result = await transactions.transact(proposal, { ...context, requestedConfig });
      if (result.status !== 'committed') {
        const type = result.status === 'rolled-back'
          ? 'world.config-rolled-back'
          : result.status === 'blocked'
            ? 'world.config-blocked'
            : 'world.config-rejected';
        append(type, {
          transactionId: result.transactionId ?? null,
          status: result.status,
          reason: result.reason ?? null,
          requestedConfig,
          beforeConfig: eventSafeValue(result.before ?? config),
          actualConfig: eventSafeValue(config),
          errors: eventSafeValue(result.errors ?? []),
          error: result.error ?? null,
          restoreError: result.restoreError ?? null,
        }, 'session.world');
      }
      return result;
    },
    advanceTick() {
      tick++;
      return tick;
    },
    recordEvent(type, payload, sourceModule) {
      if (typeof sourceModule !== 'string' || !sourceModule) throw new TypeError('sourceModule is required');
      return append(type, payload, sourceModule);
    },
    getEvents() { return journal.snapshot(); },
    get transactionBusy() { return transactions.busy; },
  });
}
