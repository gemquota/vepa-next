import { proposeBoundaryChange } from './boundary-contract.js';

const WRAP_LAW_ID = 'law.wrap';

function validateDependencies(session, registry) {
  if (!session || typeof session.proposeConfig !== 'function' ||
      typeof session.getSnapshot !== 'function') {
    throw new TypeError('session must expose getSnapshot() and proposeConfig()');
  }
  if (!registry || typeof registry.get !== 'function' || typeof registry.list !== 'function') {
    throw new TypeError('registry must expose get(id) and list()');
  }
}

/**
 * Shared semantic path for individual and bulk law changes.
 *
 * This adapter never mutates simulation state directly. It converts a user or
 * application command into a full config proposal and delegates validation,
 * commit, rollback and event recording to world-session.
 */
export function createLawCommandAdapter({ session, registry }) {
  validateDependencies(session, registry);

  function currentConfig() {
    const config = session.getSnapshot().config;
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new TypeError('world-session config must be an object');
    }
    if (!Array.isArray(config.activeLawIds)) {
      throw new TypeError('world-session config must include activeLawIds');
    }
    const boundaryMode = config.boundaryMode ??
      (config.activeLawIds.includes(WRAP_LAW_ID) ? 'toroidal' : 'reflective');
    return { ...config, boundaryMode };
  }

  function ensureKnown(ids) {
    for (const id of ids) {
      if (typeof id !== 'string' || !id) throw new TypeError('law IDs must be non-empty strings');
      if (!registry.get(id)) throw new RangeError('Unknown or non-executable law: ' + id);
    }
    if (!registry.get(WRAP_LAW_ID)) {
      throw new Error('Registry must register law.wrap to use canonical boundary semantics');
    }
  }

  async function propose(activeLawIds, context = {}) {
    const current = currentConfig();
    ensureKnown(activeLawIds);
    const boundary = proposeBoundaryChange(current, { activeLawIds });
    const proposal = { ...current, ...boundary };
    return session.proposeConfig(proposal, { ...context, command: 'laws.set-active' });
  }

  return Object.freeze({
    setLawActive(id, active, context = {}) {
      if (typeof active !== 'boolean') throw new TypeError('active must be boolean');
      const current = currentConfig();
      ensureKnown([id]);
      const next = new Set(current.activeLawIds);
      if (active) next.add(id);
      else next.delete(id);
      return propose([...next], context);
    },

    setLawsActive(ids, active, context = {}) {
      if (!Array.isArray(ids)) throw new TypeError('ids must be an array');
      if (typeof active !== 'boolean') throw new TypeError('active must be boolean');
      if (new Set(ids).size !== ids.length) throw new TypeError('ids cannot contain duplicates');
      ensureKnown(ids);
      const current = currentConfig();
      const next = new Set(current.activeLawIds);
      for (const id of ids) active ? next.add(id) : next.delete(id);
      return propose([...next], context);
    },

    replaceActiveLaws(ids, context = {}) {
      if (!Array.isArray(ids)) throw new TypeError('ids must be an array');
      if (new Set(ids).size !== ids.length) throw new TypeError('ids cannot contain duplicates');
      return propose([...ids], context);
    },
  });
}
