import { createEventEnvelope } from '../core/event-envelope.js';
import { createTransactionCoordinator } from './transaction.js';
import { createEventJournal } from './event-journal.js';

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

  function append(type, payload, sourceModule) {
    const event = createEventEnvelope({
      eventId: worldId + ':' + sequence,
      type,
      schemaVersion: 1,
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
          generation: nextGeneration,
          config: cloneValue(config),
        }, 'session.world');
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
    async proposeConfig(proposal, context) {
      return transactions.transact(proposal, context);
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
