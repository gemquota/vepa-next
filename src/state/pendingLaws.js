import { LAW_COUNT, LAW_INDEXES } from '../constants.js';
import { isSet, set, clear } from './lawState.js';

const NAMES = new Map(Object.entries(LAW_INDEXES).map(([name, index]) => [index, name]));

/** UI proposals never write the shared live mask, saves or worker messages. */
export function wirePendingLaws(bus, { getLive }) {
  const pending = new Map();
  const snapshot = () => [...pending]
    .filter(([lawIndex, active]) => active !== isSet(getLive(), lawIndex))
    .map(([lawIndex, active]) => ({ lawIndex, label: NAMES.get(lawIndex), liveValue: isSet(getLive(), lawIndex), active }));
  const publish = () => bus.emit('law:pending', { changes: snapshot() });
  const reset = () => { pending.clear(); publish(); };

  bus.on('law:editRequested', ({ changes } = {}) => {
    // Validate the whole command before staging any of it. WRAP belongs to
    // the TOROIDAL parameter and cannot be overridden by law sets or bulk UI.
    if (!Array.isArray(changes) || !changes.every((change) => change
      && Number.isInteger(change.lawIndex) && change.lawIndex >= 0 && change.lawIndex < LAW_COUNT
      && change.lawIndex !== LAW_INDEXES.WRAP && typeof change.active === 'boolean')) {
      bus.emit('law:editRejected', { reason: 'Expected boolean law overrides; WRAP is controlled by WORLD TOROIDAL.' });
      return;
    }
    for (const { lawIndex, active } of changes) {
      if (active === isSet(getLive(), lawIndex)) pending.delete(lawIndex);
      else pending.set(lawIndex, active);
    }
    publish();
  });
  bus.on('law:pendingRequested', publish);
  bus.on('law:discardPending', reset);
  bus.on('world:restored', reset);
  bus.on('law:sync', publish);
  publish();

  return {
    // Called only by the session coordinator after stopping compute. No
    // per-law applied event can expose a half-written mask to the worker.
    commit() {
      const changes = snapshot();
      for (const { lawIndex, active } of changes) (active ? set : clear)(getLive(), lawIndex);
      reset();
      return changes;
    },
  };
}
