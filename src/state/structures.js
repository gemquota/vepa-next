/**
 * VEPA4 — Durable structures (sequel Phase 4).
 *
 * Closes the "Structure ownership" gap in docs/systems/implementation-gaps.md:
 * "field writes and artifacts" were the only representation, so a structure had
 * no owner, no upkeep, and no way to depend on another structure. This gives
 * structures stable identity, ownership, maintenance decay, and a dependency
 * graph whose satisfaction gates whether the structure actually functions.
 *
 * Additive: it records intent and condition. It does not replace
 * `construction.js` (which writes field cells) or `artifacts.js` (treasury
 * inventory); it sits above them and decides what is built, by whom, and
 * whether it still stands.
 *
 * Records live in the shared lifecycle substrate, so every ownership change,
 * upkeep pass and dependency break is an explicit causal event rather than a
 * side effect nobody can audit.
 */

import { clamp01, finite } from '../core/numeric.js';
import {
  createSystemRecord,
  updateSystemRecord,
  recordSystemEvent,
  closeSystemRecord,
} from './systemLifecycle.js';

/** Structure kinds. Each has a different upkeep profile. */
export const STRUCTURE_KINDS = Object.freeze({
  NEST: 'NEST',
  HIVE: 'HIVE',
  WALL: 'WALL',
  ROAD: 'ROAD',
  HUB: 'HUB',
  BRIDGE: 'BRIDGE',
  STOREHOUSE: 'STOREHOUSE',
  SHRINE: 'SHRINE',
  GUILDHALL: 'GUILDHALL',
});

/** Per-tick integrity decay when a structure is unmaintained (0-1). */
export const DEFAULT_DECAY = 0.004;
/** Treasury cost per tick of upkeep per kind. */
export const UPKEEP_COST = Object.freeze({
  NEST: 0.02, HIVE: 0.05, WALL: 0.08, ROAD: 0.01, HUB: 0.12,
  BRIDGE: 0.06, STOREHOUSE: 0.04, SHRINE: 0.03, GUILDHALL: 0.07,
});
/** Structures at or below this integrity are abandoned. */
export const COLLAPSE_THRESHOLD = 0.15;

const SYSTEM = 'infrastructure';

function live(registry, id) {
  return registry.lifecycle.records.get(id) || null;
}

function patch(registry, id, attrs) {
  if (!registry.lifecycle.records.has(id)) return null;
  return updateSystemRecord(registry.lifecycle, id, { attributes: attrs });
}

const emitEvent = (lifecycle, id, type, payload) => recordSystemEvent(lifecycle, id, type, payload);
const closeRecord = (lifecycle, id, reason) => closeSystemRecord(lifecycle, id, reason);

/** Create the structure registry. One per world. */
export function createStructureRegistry(lifecycle, options = {}) {
  return {
    lifecycle,
    byId: new Map(),            // structureId → structure record id
    decay: clamp01(finite(options.decay, DEFAULT_DECAY)),
    tick: 0,
  };
}

/**
 * Found a durable structure owned by a group.
 *
 * @param {object} registry
 * @param {string|number} groupId
 * @param {object} spec { kind, x, y, z, integrity, requires }
 */
export function foundStructure(registry, groupId, spec = {}) {
  const kind = spec.kind && STRUCTURE_KINDS[spec.kind] ? spec.kind : 'NEST';
  const created = createSystemRecord(registry.lifecycle, SYSTEM, `structure:${groupId}:${kind}`, {
    kind,
    ownerGroupId: groupId,
    x: finite(spec.x, 0),
    y: finite(spec.y, 0),
    z: finite(spec.z, 0),
    integrity: clamp01(finite(spec.integrity, 1)),
    // ids of structures that must be standing for this one to function
    requires: [...(spec.requires || [])],
    upkeepPaid: 0,
    active: true,
  });
  emitEvent(registry.lifecycle, created.id, 'structure-founded', { groupId, kind });
  const rec = registry.lifecycle.records.get(created.id);
  registry.byId.set(rec.id, rec.id);
  return rec;
}

/** Every structure record id, in construction order. */
export function listStructures(registry) {
  return [...registry.byId.keys()];
}

/** Live record for a structure, or null. */
export function getStructure(registry, id) {
  return live(registry, id);
}

/**
 * The live structure owned by a group, or null.
 *
 * Record ids are allocated by the lifecycle substrate (`infrastructure:<n>`),
 * so callers must not try to derive a group's structure id from the group id.
 * This lookup is the supported way to ask "does this group already have a
 * standing structure?", which the maintenance caller asks every interval.
 */
export function structureForGroup(registry, groupId) {
  for (const id of registry.byId.keys()) {
    const rec = live(registry, id);
    if (rec && rec.attributes.ownerGroupId === groupId && rec.attributes.active !== false) return rec;
  }
  return null;
}

/**
 * Transfer ownership. The previous owner's claim becomes a causal event, not a
 * silent overwrite.
 */
export function transferOwnership(registry, structureId, toGroupId) {
  const rec = live(registry, structureId);
  if (!rec) return null;
  const from = rec.attributes.ownerGroupId;
  if (from === toGroupId) return rec;
  patch(registry, structureId, { ownerGroupId: toGroupId });
  emitEvent(registry.lifecycle, structureId, 'ownership-transferred', { from, to: toGroupId });
  return live(registry, structureId);
}

/**
 * Declare that `structureId` requires `dependencyId`. A structure whose
 * dependencies are not all standing reports `functional: false` but is not
 * destroyed — it is dormant, which is distinguishable from collapse.
 */
export function addDependency(registry, structureId, dependencyId) {
  const rec = live(registry, structureId);
  if (!rec || structureId === dependencyId) return null;
  if (rec.attributes.requires.includes(dependencyId)) return rec;
  patch(registry, structureId, { requires: [...rec.attributes.requires, dependencyId] });
  emitEvent(registry.lifecycle, structureId, 'dependency-added', { dependency: dependencyId });
  return live(registry, structureId);
}

/** Whether every dependency of a structure is itself standing. */
export function dependenciesSatisfied(registry, structureId) {
  const rec = live(registry, structureId);
  if (!rec) return false;
  for (const dep of rec.attributes.requires) {
    const d = live(registry, dep);
    if (!d || d.attributes.integrity <= COLLAPSE_THRESHOLD || d.attributes.active === false) {
      return false;
    }
  }
  return true;
}

/** Structures that depend on a given structure. */
export function dependentsOf(registry, structureId) {
  return listStructures(registry).filter((id) => {
    const rec = live(registry, id);
    return rec && rec.attributes.requires.includes(structureId);
  });
}

/**
 * One maintenance pass. Maintained structures cost upkeep from the group
 * treasury; unmaintained ones decay. Structures that fall below the collapse
 * threshold are closed.
 *
 * @param {object} registry
 * @param {object} groupRegistry  used only to read group treasuries
 * @param {object} [opts] { tick, maintain (Set of structure ids) }
 * @returns {{maintained:number, decayed:number, collapsed:string[], spent:number, dormant:number}}
 */
export function runMaintenance(registry, groupRegistry, opts = {}) {
  registry.tick = finite(opts.tick, registry.tick + 1);
  const maintain = opts.maintain instanceof Set ? opts.maintain : new Set(opts.maintain || []);
  const out = { maintained: 0, decayed: 0, collapsed: [], spent: 0, dormant: 0 };

  for (const id of registry.byId.keys()) {
    const rec = live(registry, id);
    if (!rec || rec.attributes.active === false) continue;

    const wasMaintained = maintain.has(id);
    let integrity = rec.attributes.integrity;

    if (wasMaintained) {
      const cost = UPKEEP_COST[rec.attributes.kind] ?? 0.02;
      const group = groupRegistry && groupRegistry.groups
        ? groupRegistry.groups.get(rec.attributes.ownerGroupId)
        : null;
      const treasury = group ? (group.treasury || 0) : 0;
      if (treasury >= cost) {
        if (group) group.treasury = treasury - cost;
        integrity = clamp01(integrity + 0.05);
        out.maintained++;
        out.spent = Math.round((out.spent + cost) * 1e4) / 1e4;
        patch(registry, id, { integrity, upkeepPaid: rec.attributes.upkeepPaid + cost });
        emitEvent(registry.lifecycle, id, 'maintained', { cost });
        continue;
      }
      // Could not afford upkeep — treated exactly like no maintenance.
      emitEvent(registry.lifecycle, id, 'upkeep-unaffordable', { cost });
    }

    integrity = clamp01(integrity - registry.decay);
    out.decayed++;
    patch(registry, id, { integrity });

    if (integrity <= COLLAPSE_THRESHOLD) {
      out.collapsed.push(id);
      patch(registry, id, { active: false });
      closeRecord(registry.lifecycle, id, 'collapsed');
      emitEvent(registry.lifecycle, id, 'collapsed', { integrity });
    }
  }

  for (const id of registry.byId.keys()) {
    const rec = live(registry, id);
    if (rec && rec.attributes.active !== false && !dependenciesSatisfied(registry, id)) out.dormant++;
  }
  return out;
}

/** Bounded report for the UI and analysis. */
export function structureReport(registry) {
  const kinds = {};
  let total = 0, standing = 0, dormant = 0, collapsed = 0;
  for (const id of registry.byId.keys()) {
    const rec = live(registry, id);
    if (!rec) continue;
    total++;
    const k = rec.attributes.kind;
    kinds[k] = (kinds[k] || 0) + 1;
    if (rec.attributes.active === false) { collapsed++; continue; }
    if (rec.attributes.integrity > COLLAPSE_THRESHOLD) standing++;
    if (!dependenciesSatisfied(registry, id)) dormant++;
  }
  return { total, standing, dormant, collapsed, kinds, tick: registry.tick };
}
