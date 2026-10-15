import { validateWorldSnapshot } from './snapshot.js';

function slotKey(prefix, slot) { return prefix + '.slot.' + slot; }

function readSlot(storage, prefix, slot) {
  let raw;
  try {
    raw = storage.getItem(slotKey(prefix, slot));
  } catch (error) {
    return { slot, valid: false, error: 'read-failed:' + (error instanceof Error ? error.message : String(error)) };
  }
  if (raw === null || raw === undefined) return { slot, valid: false, empty: true };
  try {
    const record = JSON.parse(raw);
    if (!record || !Number.isInteger(record.revision) || record.revision < 1) {
      return { slot, valid: false, error: 'invalid-record-revision' };
    }
    const verdict = validateWorldSnapshot(record.snapshot);
    if (!verdict.valid) return { slot, valid: false, error: 'invalid-snapshot', details: verdict.errors };
    return { slot, valid: true, revision: record.revision, snapshot: record.snapshot };
  } catch (error) {
    return { slot, valid: false, error: 'parse-failed:' + (error instanceof Error ? error.message : String(error)) };
  }
}

/**
 * Two-slot synchronous storage adapter. Inject browser localStorage or an
 * equivalent key/value store. A new slot is written before the active pointer;
 * the other slot is retained as the last known-good checkpoint.
 */
export function createSnapshotStore(storage, { prefix = 'vepa.snapshot' } = {}) {
  if (!storage || typeof storage.getItem !== 'function' ||
      typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
    throw new TypeError('storage must provide getItem, setItem and removeItem');
  }
  if (typeof prefix !== 'string' || !prefix) throw new TypeError('prefix must be a non-empty string');

  function inspect() {
    const a = readSlot(storage, prefix, 'a');
    const b = readSlot(storage, prefix, 'b');
    let active = null;
    try { active = storage.getItem(prefix + '.active'); } catch {}
    const slots = [a, b].filter(item => item.valid).sort((x, y) => y.revision - x.revision);
    return { a, b, active, slots };
  }

  return Object.freeze({
    save(snapshot) {
      const verdict = validateWorldSnapshot(snapshot);
      if (!verdict.valid) return { status: 'rejected', reason: 'invalid-snapshot', errors: verdict.errors };
      const state = inspect();
      const latest = state.slots[0] ?? null;
      const target = latest?.slot === 'a' ? 'b' : 'a';
      const revision = (latest?.revision ?? 0) + 1;
      try {
        storage.setItem(slotKey(prefix, target), JSON.stringify({ revision, snapshot }));
      } catch (error) {
        return { status: 'failed', reason: 'slot-write-failed', error: error instanceof Error ? error.message : String(error) };
      }
      try {
        storage.setItem(prefix + '.active', target);
        return { status: 'saved', slot: target, revision };
      } catch (error) {
        return {
          status: 'committed-unpointed', slot: target, revision,
          warning: 'Snapshot data was written but the active pointer update failed; load will select the newest valid slot.',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    load() {
      const state = inspect();
      if (!state.slots.length) {
        return {
          status: 'empty',
          diagnostics: { a: state.a.error ?? null, b: state.b.error ?? null },
        };
      }
      const newest = state.slots[0];
      const activeSlot = state.active === 'a' || state.active === 'b' ? state[state.active] : null;
      if (activeSlot?.valid && activeSlot.revision >= newest.revision) {
        return { status: 'loaded', slot: activeSlot.slot, revision: activeSlot.revision, snapshot: activeSlot.snapshot };
      }
      if (activeSlot?.valid && activeSlot.revision < newest.revision) {
        return {
          status: 'recovered',
          slot: newest.slot,
          revision: newest.revision,
          snapshot: newest.snapshot,
          reason: 'newer-valid-slot-than-active-pointer',
          previousActiveSlot: activeSlot.slot,
        };
      }
      return {
        status: 'recovered',
        slot: newest.slot,
        revision: newest.revision,
        snapshot: newest.snapshot,
        reason: activeSlot ? 'active-slot-invalid' : 'active-pointer-missing-or-invalid',
        diagnostics: { a: state.a.error ?? null, b: state.b.error ?? null },
      };
    },

    inspect() {
      const state = inspect();
      return {
        active: state.active,
        slots: {
          a: { valid: state.a.valid, revision: state.a.revision ?? null, error: state.a.error ?? null },
          b: { valid: state.b.valid, revision: state.b.revision ?? null, error: state.b.error ?? null },
        },
      };
    },
  });
}
