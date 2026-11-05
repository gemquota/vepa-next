/**
 * Pure law dependency/state resolver.
 *
 * The graph is declarative and independent of the UI or solver. A relationship
 * is { from, to, type }; for "requires", from requires to. For "disables" and
 * "conflicts", an active from-law blocks the to-law. No relationship is
 * inferred from labels: only explicitly registered edges affect activation.
 */
export const LAW_RELATION_TYPES = Object.freeze([
  'requires', 'enables', 'disables', 'conflicts', 'depends_on',
  'modulates', 'interacts', 'supersedes', 'aliases', 'derives_from',
]);

const BLOCKING_TYPES = new Set(['disables', 'conflicts']);
const REQUIREMENT_TYPES = new Set(['requires', 'depends_on']);

function validateInputs(laws, relationships, activeIds) {
  if (!Array.isArray(laws)) throw new TypeError('laws must be an array');
  if (!Array.isArray(relationships)) throw new TypeError('relationships must be an array');
  if (!(activeIds instanceof Set)) throw new TypeError('activeIds must be a Set');
  const ids = new Set();
  for (const law of laws) {
    if (!law || typeof law.id !== 'string' || !law.id) throw new TypeError('every law needs a non-empty id');
    if (ids.has(law.id)) throw new TypeError('duplicate law id: ' + law.id);
    ids.add(law.id);
  }
  for (const edge of relationships) {
    if (!edge || !ids.has(edge.from) || !ids.has(edge.to)) throw new RangeError('relationship references unknown law');
    if (!LAW_RELATION_TYPES.includes(edge.type)) throw new RangeError('unknown relationship type: ' + edge.type);
    if (edge.from === edge.to) throw new RangeError('law cannot relate to itself');
  }
  for (const id of activeIds) if (!ids.has(id)) throw new RangeError('unknown active law: ' + id);
  return ids;
}

export function evaluateLawStates({ laws, relationships = [], activeIds = new Set() } = {}) {
  validateInputs(laws, relationships, activeIds);
  const byId = new Map(laws.map(law => [law.id, law]));
  const states = new Map();

  for (const law of laws) {
    // In a "requires" edge, from requires to, so inspect edges originating
    // at this law as well. This is the canonical direction used by the UI.
    const requiredIds = relationships
      .filter(edge => edge.from === law.id && REQUIREMENT_TYPES.has(edge.type))
      .map(edge => edge.to);
    const missing = requiredIds.filter(id => !activeIds.has(id));
    const blockers = relationships
      .filter(edge => BLOCKING_TYPES.has(edge.type) && edge.to === law.id && activeIds.has(edge.from))
      .map(edge => ({ lawId: edge.from, type: edge.type }));
    const reverseBlockers = relationships
      .filter(edge => BLOCKING_TYPES.has(edge.type) && edge.from === law.id && activeIds.has(edge.to))
      .map(edge => ({ lawId: edge.to, type: edge.type }));
    const allBlockers = [...blockers, ...reverseBlockers];
    const isActive = activeIds.has(law.id);
    let status;
    if (isActive) status = 'active';
    else if (missing.length || allBlockers.length) status = 'unavailable';
    else if (requiredIds.length > 0) status = 'primed';
    else status = 'available';

    states.set(law.id, Object.freeze({
      id: law.id,
      status,
      active: isActive,
      available: status !== 'unavailable',
      requiredIds: Object.freeze(requiredIds),
      missingRequirements: Object.freeze(missing),
      blockedBy: Object.freeze(allBlockers),
      // UI overlays are intentionally separate from the activation state.
      selected: false,
      relationships: Object.freeze(relationships.filter(edge => edge.from === law.id || edge.to === law.id)),
    }));
  }

  return Object.freeze({
    get(id) { return states.get(id); },
    list() { return laws.map(law => states.get(law.id)); },
    canActivate(id) {
      const state = states.get(id);
      return Boolean(state && state.available);
    },
    validateActiveSet() {
      const errors = [];
      for (const id of activeIds) {
        const state = states.get(id);
        if (state.missingRequirements.length) errors.push({ lawId: id, reason: 'missing-requirements', dependencies: state.missingRequirements });
        if (state.blockedBy.length) errors.push({ lawId: id, reason: 'blocked-by-active-law', blockers: state.blockedBy });
      }
      return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
    },
    relationshipSummary(id) {
      if (!byId.has(id)) throw new RangeError('unknown law: ' + id);
      return relationships.filter(edge => edge.from === id || edge.to === id);
    },
  });
}

export function createLawGraph({ laws, relationships = [] } = {}) {
  if (!Array.isArray(laws)) throw new TypeError('laws must be an array');
  const immutableLaws = Object.freeze(laws.map(law => Object.freeze({ ...law })));
  const immutableRelationships = Object.freeze(relationships.map(edge => Object.freeze({ ...edge })));
  // Validate the graph once, with an empty active set.
  validateInputs(immutableLaws, immutableRelationships, new Set());
  return Object.freeze({
    laws: immutableLaws,
    relationships: immutableRelationships,
    evaluate(activeIds = []) {
      return evaluateLawStates({ laws: immutableLaws, relationships: immutableRelationships, activeIds: new Set(activeIds) });
    },
    getRelated(id) {
      if (!immutableLaws.some(law => law.id === id)) throw new RangeError('unknown law: ' + id);
      return immutableRelationships.filter(edge => edge.from === id || edge.to === id);
    },
  });
}
