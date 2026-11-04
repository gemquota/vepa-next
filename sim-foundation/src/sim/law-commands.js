import { proposeBoundaryChange } from './boundary-contract.js';
const WRAP_LAW_ID = 'law.wrap';
export function createLawCommandAdapter({ session, registry }) {
 if (!session || typeof session.proposeConfig !== 'function' || typeof session.getSnapshot !== 'function') throw new TypeError('Invalid world session');
 if (!registry || typeof registry.get !== 'function') throw new TypeError('Invalid law registry');
 function currentConfig() {
  const config = session.getSnapshot().config;
  if (!config || typeof config !== 'object' || Array.isArray(config) || !Array.isArray(config.activeLawIds)) throw new TypeError('Config must include activeLawIds');
  return { ...config, boundaryMode: config.boundaryMode ?? (config.activeLawIds.includes(WRAP_LAW_ID) ? 'toroidal' : 'reflective') };
 }
 function ensureKnown(ids) {
  for (const id of ids) {
   if (typeof id !== 'string' || !id) throw new TypeError('Law IDs must be non-empty strings');
   if (id !== WRAP_LAW_ID && !registry.get(id)) throw new RangeError('Unknown or non-executable law: ' + id);
  }
 }
 function propose(activeLawIds, context = {}, boundaryMode) {
  const current = currentConfig(); ensureKnown(activeLawIds);
  const change = { activeLawIds }; if (boundaryMode) change.boundaryMode = boundaryMode;
  const boundary = proposeBoundaryChange(current, change);
  return session.proposeConfig({ ...current, ...boundary }, { ...context, command: 'laws.set-active' });
 }
 return Object.freeze({
  setLawActive(id, active, context = {}) {
   if (typeof active !== 'boolean') throw new TypeError('active must be boolean');
   const ids = new Set(currentConfig().activeLawIds); ensureKnown([id]);
   if (active) ids.add(id); else ids.delete(id);
   return propose([...ids], context, id === WRAP_LAW_ID && !active ? 'reflective' : undefined);
  },
  setLawsActive(ids, active, context = {}) {
   if (!Array.isArray(ids) || typeof active !== 'boolean') throw new TypeError('Expected law ID array and boolean active');
   if (new Set(ids).size !== ids.length) throw new TypeError('Duplicate law IDs'); ensureKnown(ids);
   const next = new Set(currentConfig().activeLawIds);
   for (const id of ids) active ? next.add(id) : next.delete(id);
   return propose([...next], context, ids.includes(WRAP_LAW_ID) && !active ? 'reflective' : undefined);
  },
  replaceActiveLaws(ids, context = {}) {
   if (!Array.isArray(ids) || new Set(ids).size !== ids.length) throw new TypeError('Expected unique law ID array');
   return propose([...ids], context);
  },
 });
}
