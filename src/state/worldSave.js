// ============================================================================
// VEPA4 — World State Save / Load, Compare & Undo Ring
//
// Full-fidelity world snapshots: particle buffer, species DNA, law state
// (128-bit), world params, runtime knobs, world size and tick. Snapshots are
// stored as typed arrays in memory / IndexedDB (structured clone) and can be
// exported to a portable `.vepa.json` file (chunked base64) and re-imported.
//
// The undo ring is the classic two-stack model: `commit()` records a
// checkpoint, `undo(current)` restores the last checkpoint while pushing the
// current world onto the redo stack, and `redo(current)` walks back — every
// action (including undos) is reversible, mirroring the multiplex history.
// ============================================================================

import {
  WORLD_SIZE,
  PARTICLE_STRIDE,
  MAX_PARTICLES,
  MAX_SPECIES,
  STRIDE_INDEXES,
} from '../constants.js';
import { clampWorldParam } from './worldParams.js';

export const WORLD_SAVE_FORMAT = 'vepa-world-save';
export const WORLD_SAVE_VERSION = 1;

/** In-memory undo-ring depth (auto-snapshots + manual checkpoints). */
export const UNDO_RING_CAP = 8;

/** Max named saves kept in the store (oldest evicted). */
export const SAVE_LIST_CAP = 24;

/** runtimeConfig knobs captured/restored with every world state. */
export const RUNTIME_KNOBS = [
  'starMass',
  'forceScale',
  'maxForce',
  'dragMultiplier',
  'birthRate',
  'deathRate',
  'signalScale',
  'simSpeed',
  'visualScale',
  'globalAlpha',
];

const S = STRIDE_INDEXES;

// ── Typed-array <-> base64 (chunked so 1 MB buffers don't blow the stack) ──

/** Encode a Uint8Array (or view of one) as base64. */
export function encodeBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + CHUNK, u8.length)));
  }
  return btoa(bin);
}

/** Decode a base64 string into a fresh Uint8Array. */
export function decodeBase64(str) {
  const bin = atob(str);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function bytesToF32(u8) {
  const out = new Float32Array(u8.byteLength / 4);
  out.set(new Float32Array(u8.buffer, u8.byteOffset, out.length));
  return out;
}

function bytesToU16(u8) {
  const out = new Uint16Array(u8.byteLength / 2);
  out.set(new Uint16Array(u8.buffer, u8.byteOffset, out.length));
  return out;
}

function popcount(w) {
  w = (w | 0) >>> 0;
  let n = 0;
  while (w) { n += w & 1; w >>>= 1; }
  return n;
}

// ── Summary metadata (for cheap comparison without loading buffers) ──

/** Per-world summary stats stored on every save and used by the COMPARE tab. */
export function summarizeWorld(view, count, laws) {
  let alive = 0;
  const speciesSeen = new Set();
  let massSum = 0;
  let energySum = 0;
  let speedSum = 0;
  const n = Math.max(0, Math.min(count || 0, view ? (view.length / PARTICLE_STRIDE) | 0 : 0));
  for (let i = 0; i < n; i++) {
    const b = i * PARTICLE_STRIDE;
    if (view[b + S.DEAD] >= 0.5) continue;
    alive++;
    speciesSeen.add(view[b + S.SPECIES_ID] | 0);
    massSum += view[b + S.MASS] || 0;
    energySum += view[b + S.ENERGY] || 0;
    const vx = view[b + S.VEL_X] || 0;
    const vy = view[b + S.VEL_Y] || 0;
    const vz = view[b + S.VEL_Z] || 0;
    speedSum += Math.sqrt(vx * vx + vy * vy + vz * vz);
  }
  let lawsOn = 0;
  if (laws) {
    lawsOn += laws.lowFlags ? popcount(laws.lowFlags[0]) : 0;
    lawsOn += laws.highFlags ? popcount(laws.highFlags[0]) : 0;
    lawsOn += laws.extFlags ? popcount(laws.extFlags[0]) : 0;
    lawsOn += laws.quadFlags ? popcount(laws.quadFlags[0]) : 0;
  }
  const denom = Math.max(1, alive);
  return {
    alive,
    species: speciesSeen.size,
    lawsOn,
    avgMass: massSum / denom,
    avgEnergy: energySum / denom,
    avgSpeed: speedSum / denom,
  };
}

// ── Capture ──

/**
 * Capture the full current world into a serialisable state object. Particles
 * and DNA are kept as typed-array copies (cheap in memory, structured-clone
 * friendly for IndexedDB); only exportWorldSave() converts them to base64.
 *
 * @param {object} opts
 * @param {Float32Array} opts.view      particle buffer
 * @param {number} opts.count           live particle count
 * @param {number} opts.speciesCount    species roster size
 * @param {Uint16Array} opts.dna        species genome buffer
 * @param {object} opts.laws            lawState {lowFlags, highFlags, extFlags, quadFlags}
 * @param {object} opts.worldParams     WORLD panel state
 * @param {object} opts.runtime         runtimeConfig singleton
 * @param {number} opts.worldSize       solver world size
 * @param {number} opts.tick            simulation tick
 * @param {string} [opts.name]          save name
 * @param {number} [opts.savedAt]       epoch ms
 */
export function captureWorldState(opts = {}) {
  const view = opts.view;
  const count = Math.max(0, Math.min(opts.count || 0, view ? (view.length / PARTICLE_STRIDE) | 0 : 0));
  const speciesCount = Math.max(1, Math.min(opts.speciesCount || 5, MAX_SPECIES));
  const laws = opts.laws || {};
  const dna = opts.dna;
  return {
    format: WORLD_SAVE_FORMAT,
    version: WORLD_SAVE_VERSION,
    name: opts.name || '',
    savedAt: opts.savedAt || Date.now(),
    tick: opts.tick || 0,
    worldSize: Number.isFinite(opts.worldSize) ? opts.worldSize : WORLD_SIZE,
    particleCount: count,
    speciesCount,
    particles: view ? view.subarray(0, count * PARTICLE_STRIDE).slice() : new Float32Array(0),
    dna: dna && dna.slice ? dna.slice() : (dna ? Array.from(dna) : null),
    laws: {
      low: laws.lowFlags ? laws.lowFlags[0] | 0 : 0,
      high: laws.highFlags ? laws.highFlags[0] | 0 : 0,
      ext: laws.extFlags ? laws.extFlags[0] | 0 : 0,
      quad: laws.quadFlags ? laws.quadFlags[0] | 0 : 0,
    },
    worldParams: { ...(opts.worldParams || {}) },
    runtime: pickRuntime(opts.runtime || {}),
    summary: summarizeWorld(view, count, laws),
  };
}

function pickRuntime(runtime) {
  const out = {};
  for (const key of RUNTIME_KNOBS) {
    if (Number.isFinite(runtime[key])) out[key] = runtime[key];
  }
  return out;
}

// ── Restore ──

/**
 * Apply a captured state onto live targets (mutates them in place) and return
 * the scalar values the caller must adopt (particle/species counts, world
 * size). Invalid states throw.
 *
 * @param {object} state    captured world state
 * @param {object} target   { view, dna, laws, worldParams, runtime }
 * @returns {{particleCount: number, speciesCount: number, worldSize: number}}
 */
export function restoreWorldState(state, target = {}) {
  if (!state || state.format !== WORLD_SAVE_FORMAT) {
    throw new Error('Invalid world save: missing or unknown format');
  }
  const particleCount = Math.max(0, Math.min(state.particleCount || 0, MAX_PARTICLES));
  const speciesCount = Math.max(1, Math.min(state.speciesCount || 5, MAX_SPECIES));

  if (target.view && state.particles) {
    target.view.fill(0);
    const src = state.particles;
    const len = Math.min(src.length, particleCount * PARTICLE_STRIDE);
    if (src.subarray) target.view.set(src.subarray(0, len));
    else target.view.set(src.slice(0, len));
  }
  if (target.dna && state.dna) {
    target.dna.fill(0);
    const src = state.dna;
    const len = Math.min(src.length, target.dna.length);
    if (src.subarray) target.dna.set(src.subarray(0, len));
    else target.dna.set(src.slice(0, len));
  }
  if (target.laws && state.laws) {
    target.laws.lowFlags[0] = state.laws.low | 0;
    target.laws.highFlags[0] = state.laws.high | 0;
    if (target.laws.extFlags) target.laws.extFlags[0] = state.laws.ext | 0;
    if (target.laws.quadFlags) target.laws.quadFlags[0] = state.laws.quad | 0;
  }
  if (target.worldParams && state.worldParams) {
    for (const key of Object.keys(state.worldParams)) {
      target.worldParams[key] = clampWorldParam(key, state.worldParams[key]);
    }
  }
  if (target.runtime && state.runtime) {
    for (const key of Object.keys(state.runtime)) {
      if (Number.isFinite(state.runtime[key])) target.runtime[key] = state.runtime[key];
    }
  }
  return {
    particleCount,
    speciesCount,
    worldSize: Number.isFinite(state.worldSize) ? state.worldSize : WORLD_SIZE,
  };
}

// ── Export / import (.vepa.json) ──

/** Serialize a captured state to a portable JSON string (base64 buffers). */
export function exportWorldSave(state) {
  if (!state || state.format !== WORLD_SAVE_FORMAT) throw new Error('Invalid world save');
  const particlesB64 = state.particles && state.particles.length
    ? encodeBase64(new Uint8Array(state.particles.buffer, state.particles.byteOffset, state.particles.byteLength))
    : '';
  const dnaB64 = state.dna && state.dna.length
    ? encodeBase64(new Uint8Array(state.dna.buffer, state.dna.byteOffset, state.dna.byteLength))
    : '';
  return JSON.stringify({
    format: state.format,
    version: state.version,
    name: state.name,
    savedAt: state.savedAt,
    tick: state.tick,
    worldSize: state.worldSize,
    particleCount: state.particleCount,
    speciesCount: state.speciesCount,
    laws: state.laws,
    worldParams: state.worldParams,
    runtime: state.runtime,
    summary: state.summary,
    particlesB64,
    dnaB64,
  }, null, 2);
}

/** Parse a `.vepa.json` export back into a captured-state object. Throws on invalid input. */
export function parseWorldSave(json) {
  let data;
  try {
    data = typeof json === 'string' ? JSON.parse(json) : json;
  } catch (e) {
    throw new Error('Invalid world save: not valid JSON');
  }
  if (!data || data.format !== WORLD_SAVE_FORMAT) throw new Error('Invalid world save: not a VEPA world file');
  if ((data.version || 0) > WORLD_SAVE_VERSION) throw new Error(`Unsupported world save version ${data.version}`);
  const state = {
    format: WORLD_SAVE_FORMAT,
    version: WORLD_SAVE_VERSION,
    name: data.name || '',
    savedAt: data.savedAt || Date.now(),
    tick: data.tick || 0,
    worldSize: Number.isFinite(data.worldSize) ? data.worldSize : WORLD_SIZE,
    particleCount: Math.max(0, Math.min(data.particleCount || 0, MAX_PARTICLES)),
    speciesCount: Math.max(1, Math.min(data.speciesCount || 5, MAX_SPECIES)),
    laws: { low: 0, high: 0, ext: 0, quad: 0, ...(data.laws || {}) },
    worldParams: { ...(data.worldParams || {}) },
    runtime: { ...(data.runtime || {}) },
    summary: { ...(data.summary || {}) },
    particles: data.particlesB64 ? bytesToF32(decodeBase64(data.particlesB64)) : new Float32Array(0),
    dna: data.dnaB64 ? bytesToU16(decodeBase64(data.dnaB64)) : null,
  };
  return state;
}

// ── Store (IndexedDB with localStorage fallback; injectable for tests) ──

const DB_NAME = 'vepa4-world-saves';
const DB_VERSION = 1;
const DATA_STORE = 'saves';
const META_STORE = 'meta';
const LS_KEY = 'vepa4-world-saves-ls';

function idbOpen() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DATA_STORE)) db.createObjectStore(DATA_STORE, { keyPath: 'name' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'name' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
  });
}

function metaOf(state) {
  return {
    name: state.name,
    savedAt: state.savedAt,
    tick: state.tick,
    worldSize: state.worldSize,
    particleCount: state.particleCount,
    speciesCount: state.speciesCount,
    summary: state.summary,
  };
}

/** Browser adapter: IndexedDB primary, localStorage fallback for small stores. */
export function createBrowserSaveAdapter() {
  return {
    async save(state) {
      const record = { ...state, name: state.name };
      try {
        const db = await idbOpen();
        const tx = db.transaction([DATA_STORE, META_STORE], 'readwrite');
        tx.objectStore(DATA_STORE).put(record);
        tx.objectStore(META_STORE).put(metaOf(record));
        await idbRequest(tx.objectStore(META_STORE).get('__sentinel__')).catch(() => null); // force tx commit
        return { ok: true, backend: 'indexeddb' };
      } catch (e) {
        // Fallback: localStorage keyed list (quota-bound, capped).
        try {
          const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
          const keys = Object.keys(all).sort();
          if (keys.length >= SAVE_LIST_CAP && !all[state.name]) {
            delete all[keys[0]];
          }
          all[state.name] = { ...state, particles: Array.from(state.particles || []), dna: state.dna ? Array.from(state.dna) : null };
          localStorage.setItem(LS_KEY, JSON.stringify(all));
          return { ok: true, backend: 'localstorage' };
        } catch (e2) {
          return { ok: false, error: String((e2 && e2.message) || e2) };
        }
      }
    },
    async load(name) {
      try {
        const db = await idbOpen();
        const tx = db.transaction(DATA_STORE, 'readonly');
        const rec = await idbRequest(tx.objectStore(DATA_STORE).get(name));
        return rec || null;
      } catch (e) {
        try {
          const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
          const rec = all[name];
          if (!rec) return null;
          return {
            ...rec,
            particles: rec.particles ? new Float32Array(rec.particles) : new Float32Array(0),
            dna: rec.dna ? new Uint16Array(rec.dna) : null,
          };
        } catch (e2) {
          return null;
        }
      }
    },
    async list() {
      try {
        const db = await idbOpen();
        const tx = db.transaction(META_STORE, 'readonly');
        const metas = await idbRequest(tx.objectStore(META_STORE).getAll());
        return (metas || []).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      } catch (e) {
        try {
          const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
          return Object.keys(all).map((k) => metaOf(all[k])).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        } catch (e2) {
          return [];
        }
      }
    },
    async remove(name) {
      try {
        const db = await idbOpen();
        const tx = db.transaction([DATA_STORE, META_STORE], 'readwrite');
        tx.objectStore(DATA_STORE).delete(name);
        tx.objectStore(META_STORE).delete(name);
        return true;
      } catch (e) {
        try {
          const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
          delete all[name];
          localStorage.setItem(LS_KEY, JSON.stringify(all));
          return true;
        } catch (e2) {
          return false;
        }
      }
    },
  };
}

/** Store facade over any adapter (browser default; tests inject an in-memory one). */
export function createWorldSaveStore(adapter) {
  const impl = adapter || createBrowserSaveAdapter();
  return {
    save: (state) => impl.save(state),
    load: (name) => impl.load(name),
    list: () => impl.list(),
    remove: (name) => impl.remove(name),
  };
}

// ── Compare ──

/** Metrics exposed by compareWorldSaves; 'best' honors min/max modes. */
export const COMPARE_METRICS = [
  { key: 'alive', mode: 'max' },
  { key: 'species', mode: 'max' },
  { key: 'lawsOn', mode: 'max' },
  { key: 'avgMass', mode: 'info' },
  { key: 'avgEnergy', mode: 'info' },
  { key: 'avgSpeed', mode: 'info' },
  { key: 'tick', mode: 'max' },
  { key: 'paramsDelta', mode: 'min' },
];

/**
 * Build a comparison matrix of saved worlds vs the live world. Rows are the
 * COMPARE_METRICS; columns are [LIVE, ...saves]. paramsDelta counts how many
 * world-param knobs each save has drifted from the live world.
 * @param {object} live    captured live state (or {summary, worldParams})
 * @param {object[]} saves captured saved states
 */
export function compareWorldSaves(live, saves = []) {
  const liveParams = (live && live.worldParams) || {};
  const entries = [
    { label: 'LIVE', state: live },
    ...saves.map((s) => ({ label: s.name || 'SAVE', state: s })),
  ];
  const cols = entries.map((e) => e.label);
  const rows = COMPARE_METRICS.map(({ key, mode }) => {
    const values = entries.map((e) => {
      if (key === 'paramsDelta') {
        const params = (e.state && e.state.worldParams) || {};
        let diff = 0;
        for (const k of Object.keys(liveParams)) {
          if (params[k] !== liveParams[k]) diff++;
        }
        return diff;
      }
      const summary = (e.state && e.state.summary) || {};
      if (key === 'tick') return e.state ? e.state.tick || 0 : 0;
      const v = summary[key];
      return Number.isFinite(v) ? v : 0;
    });
    let bestId = -1;
    if (mode !== 'info') {
      let bestValue = mode === 'min' ? Infinity : -Infinity;
      for (let i = 0; i < values.length; i++) {
        if ((mode === 'min' && values[i] < bestValue) || (mode === 'max' && values[i] > bestValue)) {
          bestValue = values[i];
          bestId = i;
        }
      }
    }
    return { key, mode, values, bestId };
  });
  return { rows, columns: cols };
}

// ── Undo ring (two-stack: every undo is redo-able, every redo is undo-able) ──

/** Cheap identity check used to dedupe auto-snapshots (state/tick/params/laws). */
export function sameWorldFingerprint(a, b) {
  if (!a || !b) return false;
  if (a.tick !== b.tick || a.particleCount !== b.particleCount || a.speciesCount !== b.speciesCount) return false;
  const la = a.laws || {};
  const lb = b.laws || {};
  if (la.low !== lb.low || la.high !== lb.high || la.ext !== lb.ext || la.quad !== lb.quad) return false;
  const pa = a.worldParams || {};
  const pb = b.worldParams || {};
  const ka = Object.keys(pa);
  if (ka.length !== Object.keys(pb).length) return false;
  for (const k of ka) if (pa[k] !== pb[k]) return false;
  return true;
}

export function createUndoRing(cap = UNDO_RING_CAP) {
  const ring = {
    past: [],
    future: [],
    cap: Math.max(1, cap),
    /** Record a checkpoint of the current world. Skips duplicates. */
    commit(state) {
      const top = this.past[this.past.length - 1];
      if (top && sameWorldFingerprint(top, state)) return false;
      this.past.push(state);
      if (this.past.length > this.cap) this.past.splice(0, this.past.length - this.cap);
      this.future = [];
      return true;
    },
    /** Restore the last checkpoint; the current world becomes redo-able. */
    undo(current) {
      if (!this.past.length) return null;
      this.future.push(current);
      return this.past.pop();
    },
    /** Re-apply the most recently undone world. */
    redo(current) {
      if (!this.future.length) return null;
      this.past.push(current);
      return this.future.pop();
    },
    canUndo() { return this.past.length > 0; },
    canRedo() { return this.future.length > 0; },
    clear() { this.past = []; this.future = []; },
  };
  return ring;
}
