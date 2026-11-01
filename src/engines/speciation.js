/**
 * VEPA4 — Speciation Engine (Set A.1 "Living World", RRP E·F·A trilogy)
 *
 * The DNA slot IS the taxon: when a species' members diverge enough, part of
 * the population splits off and claims a NEW species slot. Two design levers:
 *
 *   - SPECIATION_THRESHOLD (DNA 54, genome-only, 0–1): the divergence gate.
 *     Low threshold = easy speciation; high = conservative.
 *   - Field isolation (E.1): the split is ACCELERATED by the medium — species
 *     pinned against walls or split across field boundaries accumulate
 *     isolation faster, so the E fields create the barriers the RRP wanted.
 *
 * Cadence is unrestricted: any qualifying species may split on any scan.
 * The PARENT keeps its slot; the CHILD claims the first extinct-freed slot
 * (a species index with zero live members). If all 64 slots are live, the
 * split is queued until an extinction frees one.
 *
 * Visibility: 'speciation:split' (burst marker — a visible split at a tick)
 * and 'speciation:extinct' (slot freed, recorded in EXTINCT history) events.
 * `opts.silent` suppresses bus emissions + roster growth (multiplex shards
 * evolve independently and only affect fitness via species count).
 */
import { STRIDE_INDEXES, DNA_INDEXES, DNA_RANGES, MAX_SPECIES } from '../constants.js';
import { getDNAFloat, cloneSpecies, mutateSpecies } from '../dna/dnaBuffer.js';
import { isWall } from '../physics/fields.js';

export const SPECIATION_CADENCE = 240; // frames between speciation scans
const MIN_MEMBERS = 6;                 // a split needs a real population
const SPLIT_FRACTION = 0.34;           // share of the parent that becomes the child
const SPLIT_MAX = 40;                  // hard cap on converted particles
const MUTATIONS = 6;                   // DNA params scrambled on the child
const MUTATION_RANGE = 0.16;           // mutation magnitude (fraction of range)
const SPLIT_BIAS = 0.6;                // score = isolation × threshold^-1 × bias
const MAX_PENDING = 8;                 // speciation queue cap

export function createSpeciationEngine(bus, opts = {}) {
  return {
    frame: 0,
    pending: [],        // species indices queued for a free slot
    extinctHistory: [], // {species, tick} — EXTINCT history (A.1)
    splits: [],         // recent {parent, child, isolation, tick} ring
    splitRingCap: 12,
    seenSpecies: new Set(),
    prng: opts.prng || (() => 0.5),
    ...opts,
  };
}

/**
 * One speciation scan. Call on the SPECIATION_CADENCE from the intelligence
 * loop while laws are active.
 * @param {object} engine
 * @param {Float32Array} view
 * @param {number} count
 * @param {number} stride
 * @param {Uint16Array} dnaBuffer
 * @param {number} worldSize
 * @param {object} opts { lawActiveCount, fieldSystem, wallFactor, silent }
 * @returns {Array<{type:string,parent?:number,child?:number,species?:number}>}
 */
export function updateSpeciation(engine, view, count, stride, dnaBuffer, worldSize, opts = {}) {
  const events = [];
  engine.frame++;
  if (engine.frame % SPECIATION_CADENCE !== 0) return events;
  if (!opts.lawActiveCount || opts.lawActiveCount <= 0) return events;

  const S = STRIDE_INDEXES;
  const fieldSystem = opts.fieldSystem || null;
  const wallFactor = opts.wallFactor ?? 0; // multiplex proxy for field isolation

  // Per-species census: population, centroid, spread, wall pinning.
  const census = new Map(); // species → {n, sx, sy, sz, spread, walls}
  const members = new Map(); // species → [particle indices]
  for (let i = 0; i < count; i++) {
    const base = i * stride;
    if (view[base + S.DEAD] >= 0.5 || (view[base + S.MASS] || 0) <= 0) continue;
    const sp = view[base + S.SPECIES_ID] || 0;
    if (!census.has(sp)) census.set(sp, { n: 0, sx: 0, sy: 0, sz: 0, spread: 0, walls: 0 });
    if (!members.has(sp)) members.set(sp, []);
    const c = census.get(sp);
    c.n++;
    c.sx += view[base + S.POS_X];
    c.sy += view[base + S.POS_Y];
    c.sz += view[base + S.POS_Z];
    members.get(sp).push(i);
  }
  if (census.size === 0) return events;

  // Centroid pass → spread + wall fraction per species.
  const isolation = new Map(); // species → isolation score
  for (const [sp, c] of census) {
    const cx = c.sx / c.n, cy = c.sy / c.n, cz = c.sz / c.n;
    let spreadSum = 0;
    let wallCount = 0;
    for (const i of members.get(sp)) {
      const base = i * stride;
      const dx = view[base + S.POS_X] - cx;
      const dy = view[base + S.POS_Y] - cy;
      const dz = view[base + S.POS_Z] - cz;
      spreadSum += Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (wallFactor > 0 || fieldSystem) {
        const px = view[base + S.POS_X];
        const py = view[base + S.POS_Y];
        const pz = view[base + S.POS_Z];
        if (fieldSystem ? isWall(fieldSystem, px, py, pz) : (engine.prng || (() => 0.5))() < wallFactor) {
          wallCount++;
        }
      }
    }
    const spread = spreadSum / c.n;
    const walls = wallCount / c.n;
    // Isolation: spatial spread (0–1-ish scaled by world) + wall pinning.
    const iso = Math.min(1, spread / worldSize * 2 + walls * 0.8);
    isolation.set(sp, iso);
  }

  // ── Extinctions: a previously-seen species with zero live members ──
  for (const sp of engine.seenSpecies) {
    if (!census.has(sp)) {
      engine.seenSpecies.delete(sp);
      engine.extinctHistory.push({ species: sp, tick: engine.frame });
      if (!opts.silent) events.push({ type: 'speciation:extinct', species: sp });
    }
  }
  for (const sp of census.keys()) engine.seenSpecies.add(sp);

  // ── Splits: any qualifying species (unrestricted cadence) ──
  const splits = [];
  for (const [sp, c] of census) {
    if (c.n < MIN_MEMBERS) continue;
    const threshold = getDNAFloat(dnaBuffer, sp, DNA_INDEXES.SPECIATION_THRESHOLD, DNA_RANGES[54].min, DNA_RANGES[54].max);
    const score = isolation.get(sp) * (1 / Math.max(0.05, threshold)) * SPLIT_BIAS;
    if (score >= 1) splits.push(sp);
  }
  // Queue at cap: species that qualify but have no free slot wait.
  for (const sp of splits) {
    if (!engine.pending.includes(sp) && engine.pending.length < MAX_PENDING) engine.pending.push(sp);
  }
  for (const sp of [...engine.pending]) {
    const child = findFreeSlot(engine, view, count, stride, sp);
    if (child === -1) continue; // all 64 slots live — stay queued
    engine.pending.splice(engine.pending.indexOf(sp), 1);
    splitSpecies(engine, view, count, stride, dnaBuffer, sp, child, isolation.get(sp) || 0, events, opts);
  }

  return events;
}

/** First species index with zero live members (extinct-freed slot), else -1. */
function findFreeSlot(engine, view, count, stride, parent) {
  const S = STRIDE_INDEXES;
  const alive = new Set();
  for (let i = 0; i < count; i++) {
    const base = i * stride;
    if (view[base + S.DEAD] < 0.5 && (view[base + S.MASS] || 0) > 0) {
      alive.add(view[base + S.SPECIES_ID] || 0);
    }
  }
  for (let s = 0; s < MAX_SPECIES; s++) {
    if (s === parent) continue;
    if (!alive.has(s)) return s;
  }
  return -1;
}

function splitSpecies(engine, view, count, stride, dnaBuffer, parent, child, isolation, events, opts) {
  const S = STRIDE_INDEXES;
  // Child inherits the parent genome with a small scramble.
  cloneSpecies(dnaBuffer, parent, child);
  const prng = engine.prng || (() => 0.5);
  for (let m = 0; m < MUTATIONS; m++) {
    mutateSpecies(dnaBuffer, child, Math.floor(prng() * 64), MUTATION_RANGE, prng);
  }

  // Convert up to SPLIT_FRACTION of the parent's members to the child.
  const parentMembers = [];
  for (let i = 0; i < count; i++) {
    const base = i * stride;
    if (view[base + S.DEAD] >= 0.5 || (view[base + S.MASS] || 0) <= 0) continue;
    if ((view[base + S.SPECIES_ID] || 0) === parent) parentMembers.push(i);
  }
  const take = Math.min(SPLIT_MAX, Math.max(1, Math.floor(parentMembers.length * SPLIT_FRACTION)));
  for (let k = 0; k < take; k++) {
    const i = parentMembers[Math.floor(prng() * parentMembers.length)];
    const base = i * stride;
    view[base + S.SPECIES_ID] = child;
    refreshDNACache(view, base, dnaBuffer, child);
  }

  engine.splits.push({ parent, child, isolation, tick: engine.frame });
  if (engine.splits.length > engine.splitRingCap) engine.splits.shift();
  if (!opts.silent) {
    events.push({ type: 'speciation:split', parent, child, isolation });
  }
}

/** Re-sync the per-particle DNA cache (42 floats) to the child's genome. */
function refreshDNACache(view, base, dnaBuffer, species) {
  const S = STRIDE_INDEXES;
  for (let d = 0; d < 42; d++) {
    const r = DNA_RANGES[d];
    view[base + S.DNA_CACHE_START + d] = getDNAFloat(dnaBuffer, species, d, r.min, r.max);
  }
}

/** Live species roster size (parent keeps slot, child claims its slot). */
export function rosterSizeFor(engine, child) {
  return Math.min(MAX_SPECIES, Math.max(1, child + 1));
}
