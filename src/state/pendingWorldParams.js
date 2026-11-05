import { WORLD_PARAM_DEFS, clampWorldParam } from './worldParams.js';

const DEFINITIONS = new Map(WORLD_PARAM_DEFS.map((definition) => [definition.key, definition]));

/** Session-only overrides: never mutate the live world, storage, or worker. */
export function createPendingWorldParams(getLive) {
  const pending = new Map();
  return {
    stage(key, value) {
      if (!DEFINITIONS.has(key) || typeof value !== 'number' || !Number.isFinite(value)) return false;
      const accepted = clampWorldParam(key, value);
      if (accepted === getLive()[key]) pending.delete(key);
      else pending.set(key, accepted);
      return true;
    },
    snapshot() {
      return [...pending].map(([key, value]) => ({
        key, label: DEFINITIONS.get(key).label, liveValue: getLive()[key], value,
      }));
    },
    clear() { pending.clear(); },
  };
}

/** Only the session coordinator calls commit, after stopping the worker. */
export function wirePendingWorldParams(bus, { getLive, apply }) {
  const pending = createPendingWorldParams(getLive);
  const publish = () => bus.emit('world:paramsPending', { changes: pending.snapshot() });
  const reset = () => {
    pending.clear();
    publish();
  };
  bus.on('world:paramChanged', ({ key, value }) => {
    if (pending.stage(key, value)) publish();
  });
  bus.on('world:pendingRequested', publish);
  bus.on('world:discardPending', () => {
    reset();
    bus.emit('world:paramsRestored');
  });
  bus.on('world:restored', () => {
    reset();
    bus.emit('world:paramsRestored');
  });
  publish();
  return {
    commit() {
      const changes = pending.snapshot();
      for (const { key, value } of changes) apply({ key, value });
      reset();
      bus.emit('world:paramsRestored');
      return changes;
    },
  };
}
