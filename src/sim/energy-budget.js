import { PARTICLE_SLOTS as S, PARTICLE_STRIDE } from './particle-layout.js';

export const ENERGY_BUDGET_SCHEMA = 'vepa.energy-budget';
export const ENERGY_BUDGET_VERSION = 1;

const finite = (v, label) => {
  if (!Number.isFinite(v)) throw new RangeError(label + ' must be finite');
  return v;
};
const positive = (v, label, allowZero = false) => {
  finite(v, label);
  if (allowZero ? v < 0 : v <= 0) throw new RangeError(label + ' is out of range');
  return v;
};
function sum(values) {
  let total = 0, correction = 0;
  for (const value of values) {
    const y = value - correction;
    const next = total + y;
    correction = (next - total) - y;
    total = next;
  }
  return total;
}

/** A profile names simulation units; it does not imply SI unless the caller declares SI. */
export function validateEnergyBudgetProfile(profile = {}) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new TypeError('energy budget profile must be an object');
  const p = {
    schema: ENERGY_BUDGET_SCHEMA, version: ENERGY_BUDGET_VERSION,
    unitSystem: profile.unitSystem ?? 'simulation',
    units: { length: 'length-unit', mass: 'mass-unit', time: 'time-unit', charge: 'charge-unit', energy: 'energy-unit', ...(profile.units ?? {}) },
    boundaryMode: profile.boundaryMode ?? 'toroidal',
    worldSize: profile.worldSize ?? 2000,
    interactionRadius: profile.interactionRadius ?? 250,
    cutoffMode: profile.cutoffMode ?? 'hard',
    softening: profile.softening ?? 1,
    gravitationalConstant: profile.gravitationalConstant ?? 1,
    electricConstant: profile.electricConstant ?? 50000,
    activeLawIds: [...(profile.activeLawIds ?? ['law.gravity'])],
    includeGravity: profile.includeGravity ?? undefined,
    includeElectric: profile.includeElectric ?? undefined,
  };
  if (profile.schema !== undefined && profile.schema !== ENERGY_BUDGET_SCHEMA) throw new TypeError('Unsupported energy budget schema');
  if (profile.version !== undefined && profile.version !== ENERGY_BUDGET_VERSION) throw new TypeError('Unsupported energy budget version');
  if (typeof p.unitSystem !== 'string' || !p.unitSystem.trim()) throw new TypeError('unitSystem must be a non-empty label');
  for (const key of ['length', 'mass', 'time', 'charge', 'energy']) if (typeof p.units[key] !== 'string' || !p.units[key].trim()) throw new TypeError('units.' + key + ' must be a non-empty label');
  if (!['hard','shifted-force'].includes(p.cutoffMode)) throw new RangeError('Unsupported cutoff mode');
  if (!['toroidal', 'reflective'].includes(p.boundaryMode)) throw new RangeError('Unsupported energy audit boundary mode');
  positive(p.worldSize, 'worldSize'); positive(p.interactionRadius, 'interactionRadius');
  if (p.interactionRadius > p.worldSize / 2) throw new RangeError('interactionRadius cannot exceed worldSize / 2');
  positive(p.softening, 'softening'); positive(p.gravitationalConstant, 'gravitationalConstant', true); positive(p.electricConstant, 'electricConstant', true);
  if (!Array.isArray(p.activeLawIds) || p.activeLawIds.some(x => typeof x !== 'string' || !x)) throw new TypeError('activeLawIds must be an array of law identifiers');
  p.activeLawIds = [...new Set(p.activeLawIds)].sort();
  return Object.freeze({ ...p, units: Object.freeze({ ...p.units }), activeLawIds: Object.freeze(p.activeLawIds) });
}

function minImage(d, size) {
  if (d > size / 2) return d - size;
  if (d < -size / 2) return d + size;
  return d;
}

/**
 * Independent O(n^2) reference calculation. Potential is integrated from the
 * implemented softened radial force and shifted to zero at the finite cutoff.
 * It is an audit model, not a claim that every solver law is conservative.
 */
export function calculateEnergyBudget(view, count, {
  stride = PARTICLE_STRIDE, slots = S, profile = {},
} = {}) {
  if (!ArrayBuffer.isView(view) || view instanceof DataView || !Number.isInteger(count) || count < 0 ||
      !Number.isInteger(stride) || stride < 1 || view.length < count * stride) throw new TypeError('Invalid particle state shape');
  const p = validateEnergyBudgetProfile(profile);
  const gravity = p.includeGravity ?? p.activeLawIds.includes('law.gravity');
  const electric = p.includeElectric ?? p.activeLawIds.includes('law.charge');
  const alive = [];
  const kineticTerms = [];
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + slots.DEAD] >= 0.5 || view[b + slots.MASS] <= 0) continue;
    const mass = finite(view[b + slots.MASS], 'particle mass');
    const vx = finite(view[b + slots.VEL_X], 'particle vx');
    const vy = finite(view[b + slots.VEL_Y], 'particle vy');
    const vz = finite(view[b + slots.VEL_Z], 'particle vz');
    for (const slot of [slots.POS_X, slots.POS_Y, slots.POS_Z]) finite(view[b + slot], 'particle position');
    if (mass < 0) throw new RangeError('particle mass cannot be negative');
    kineticTerms.push(0.5 * mass * (vx * vx + vy * vy + vz * vz));
    alive.push(i);
  }
  const gravityTerms = [], electricTerms = [];
  const cutoff2 = p.interactionRadius * p.interactionRadius;
  const soft2 = p.softening * p.softening;
  for (let a = 0; a < alive.length; a++) {
    const i = alive[a], ai = i * stride;
    for (let bIndex = a + 1; bIndex < alive.length; bIndex++) {
      const j = alive[bIndex], bj = j * stride;
      let dx = view[bj + slots.POS_X] - view[ai + slots.POS_X];
      let dy = view[bj + slots.POS_Y] - view[ai + slots.POS_Y];
      let dz = view[bj + slots.POS_Z] - view[ai + slots.POS_Z];
      if (p.boundaryMode === 'toroidal') {
        dx = minImage(dx, p.worldSize); dy = minImage(dy, p.worldSize); dz = minImage(dz, p.worldSize);
      }
      const r2 = dx * dx + dy * dy + dz * dz;
      if (r2 === 0 || r2 > cutoff2) continue;
      const softened = Math.sqrt(r2 + soft2);
      const cutoffSoftened = Math.sqrt(cutoff2 + soft2);
      const radius = Math.sqrt(r2);
      const shifted = p.cutoffMode === 'shifted-force' ? (radius - p.interactionRadius) * p.interactionRadius / Math.pow(cutoff2 + soft2, 1.5) : 0;
      if (gravity) {
        const product = view[ai + slots.MASS] * view[bj + slots.MASS];
        gravityTerms.push(-p.gravitationalConstant * product * (1 / softened - 1 / cutoffSoftened + shifted));
      }
      if (electric) {
        const qa = Number.isFinite(view[ai + slots.CHARGE]) ? view[ai + slots.CHARGE] : 0;
        const qb = Number.isFinite(view[bj + slots.CHARGE]) ? view[bj + slots.CHARGE] : 0;
        electricTerms.push(p.electricConstant * qa * qb * (1 / softened - 1 / cutoffSoftened + shifted));
      }
    }
  }
  const kinetic = sum(kineticTerms), gravitationalPotential = sum(gravityTerms), electricPotential = sum(electricTerms);
  return Object.freeze({
    schema: ENERGY_BUDGET_SCHEMA, version: ENERGY_BUDGET_VERSION,
    unitSystem: p.unitSystem, units: p.units, boundaryMode: p.boundaryMode, profile: p,
    tickIndependent: true, particleCount: alive.length,
    components: Object.freeze({ kinetic, gravitationalPotential, electricPotential }),
    total: sum([kinetic, gravitationalPotential, electricPotential]),
    assumptions: Object.freeze([
      'Kinetic energy uses live particle mass and velocity slots',
      gravity ? 'Gravity potential matches the softened pair force and selected finite-cutoff model (' + p.cutoffMode + ')' : 'Gravity potential excluded because law.gravity is inactive',
      electric ? 'Electric potential matches the softened pair force and selected finite-cutoff model (' + p.cutoffMode + ')' : 'Electric potential excluded because law.charge is inactive',
      p.boundaryMode === 'toroidal' ? 'Toroidal minimum-image convention; no explicit periodic-image lattice sum' : 'Reflective boundaries do not add wall or boundary potential',
      'Only listed conservative pair laws are included; drag, contacts, SPH, fields, radiation, lifecycle and legacy energy slots are not inferred',
    ]),
  });
}

/** Compare two independently calculated budgets without hiding unexplained drift. */
export function compareEnergyBudgets(before, after, { externalWork = 0, modeledInternalTransfers = 0, tolerance = 1e-10 } = {}) {
  if (!before || !after || before.schema !== ENERGY_BUDGET_SCHEMA || after.schema !== ENERGY_BUDGET_SCHEMA) throw new TypeError('before and after must be energy budget results');
  finite(externalWork, 'externalWork'); finite(modeledInternalTransfers, 'modeledInternalTransfers');
  positive(tolerance, 'tolerance', true);
  if (before.unitSystem !== after.unitSystem || before.units.energy !== after.units.energy || JSON.stringify(before.profile) !== JSON.stringify(after.profile)) throw new TypeError('Energy budgets use incompatible units or physical profiles');
  const delta = after.total - before.total;
  const unexplainedResidual = delta - externalWork - modeledInternalTransfers;
  return Object.freeze({
    schema: ENERGY_BUDGET_SCHEMA, version: ENERGY_BUDGET_VERSION,
    before: before.total, after: after.total, delta,
    externalWork, modeledInternalTransfers, unexplainedResidual,
    tolerance, withinTolerance: Math.abs(unexplainedResidual) <= tolerance,
    interpretation: Math.abs(unexplainedResidual) <= tolerance
      ? 'Residual is within the caller-specified tolerance for the declared model'
      : 'Residual remains unexplained; it is not automatically corrected or attributed to a physical cause',
  });
}


/** Bounded, snapshotable audit history. Entries are append-only and tick ordered. */
export function createEnergyBudgetTimeline({ capacity = 4096, snapshot = null } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('timeline capacity must be a positive integer');
  let entries = [];
  if (snapshot !== null) {
    if (!snapshot || snapshot.schema !== ENERGY_BUDGET_SCHEMA || snapshot.version !== ENERGY_BUDGET_VERSION ||
        !Array.isArray(snapshot.entries) || snapshot.entries.length > capacity) throw new TypeError('Invalid energy budget timeline snapshot');
    let lastTick = -1;
    entries = snapshot.entries.map(entry => {
      if (!Number.isInteger(entry.tick) || entry.tick < 0 || entry.tick <= lastTick ||
          !entry.budget || entry.budget.schema !== ENERGY_BUDGET_SCHEMA) throw new TypeError('Invalid energy budget timeline entry');
      lastTick = entry.tick;
      return Object.freeze(structuredClone(entry));
    });
  }
  function append({ tick, budget, comparison = null, provenance = null }) {
    if (!Number.isInteger(tick) || tick < 0) throw new RangeError('tick must be a non-negative integer');
    if (!budget || budget.schema !== ENERGY_BUDGET_SCHEMA) throw new TypeError('budget must be an energy budget result');
    if (entries.length && tick <= entries[entries.length - 1].tick) throw new RangeError('timeline ticks must increase strictly');
    if (entries.length >= capacity) throw new RangeError('Energy budget timeline capacity exceeded');
    if (provenance !== null && (typeof provenance !== 'object' || Array.isArray(provenance))) throw new TypeError('provenance must be an object or null');
    const entry = Object.freeze({ tick, budget: structuredClone(budget), comparison: comparison === null ? null : structuredClone(comparison),
      provenance: provenance === null ? null : structuredClone(provenance) });
    entries.push(entry);
    return entry;
  }
  function snapshotState() {
    return Object.freeze({ schema: ENERGY_BUDGET_SCHEMA, version: ENERGY_BUDGET_VERSION,
      entries: Object.freeze(entries.map(entry => Object.freeze(structuredClone(entry)))) });
  }
  return Object.freeze({
    append,
    list({ afterTick = -1 } = {}) {
      if (!Number.isInteger(afterTick) || afterTick < -1) throw new RangeError('afterTick must be an integer >= -1');
      return Object.freeze(entries.filter(entry => entry.tick > afterTick).map(entry => Object.freeze(structuredClone(entry))));
    },
    latest() { return entries.length ? Object.freeze(structuredClone(entries[entries.length - 1])) : null; },
    createSnapshot: snapshotState,
    exportJSON() { return JSON.stringify(snapshotState(), null, 2); },
  });
}
