/**
 * VEPA4 — Memory Buffers (Set G.1 · Memory & Culture)
 *
 * Persistent, generation-spanning memory for species and groups. Unlike the
 * per-particle stride cache (which dies with its particle), these buffers
 * survive particles and generations so learned traits accumulate.
 *
 * Memory is a small Float32Array per entity (species or group) — no stride
 * slots, no solver coupling. Channels:
 *   ACTIVITY     — how active the species is (motion willingness)
 *   COHESION     — clump (>0) vs disperse (<0)
 *   EXPLORATION  — seek new space (>0) vs hold territory (<0)
 *   THREAT       — flee/defend response strength
 */

export const MEMORY_DIM = 4;
export const MEM = {
  ACTIVITY: 0,
  COHESION: 1,
  EXPLORATION: 2,
  THREAT: 3,
};

function clamp01(v) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

export function createMemoryBuffers(opts = {}) {
  return {
    speciesMem: new Map(), // speciesId → Float32Array(MEMORY_DIM)
    groupMem: new Map(),   // groupId   → Float32Array(MEMORY_DIM)
    cfg: { decay: opts.decay ?? 0.999 },
  };
}

/** Lazy per-species memory vector. */
export function speciesMemory(buffers, speciesId) {
  let v = buffers.speciesMem.get(speciesId);
  if (!v) {
    v = new Float32Array(MEMORY_DIM);
    buffers.speciesMem.set(speciesId, v);
  }
  return v;
}

/** Lazy per-group memory vector. */
export function groupMemory(buffers, groupId) {
  let v = buffers.groupMem.get(groupId);
  if (!v) {
    v = new Float32Array(MEMORY_DIM);
    buffers.groupMem.set(groupId, v);
  }
  return v;
}

/** Move dst toward src by `rate` (0 = unchanged, 1 = copy). Returns dst. */
export function blendMemory(dst, src, rate) {
  const r = clamp01(rate);
  for (let i = 0; i < MEMORY_DIM; i++) dst[i] += (src[i] - dst[i]) * r;
  return dst;
}

/** Nudge a memory vector toward a signal vector (missing/NaN channels skipped). */
export function adaptMemory(mem, signals, rate) {
  const r = clamp01(rate);
  for (let i = 0; i < MEMORY_DIM; i++) {
    const s = signals && signals[i];
    if (Number.isFinite(s)) mem[i] += (s - mem[i]) * r;
  }
  return mem;
}

/** Multiply every buffer by a decay factor (memory fades without rehearsal). */
export function decayMemory(buffers, factor) {
  const f = Number.isFinite(factor) ? factor : buffers.cfg.decay;
  for (const v of buffers.speciesMem.values()) {
    for (let i = 0; i < MEMORY_DIM; i++) v[i] *= f;
  }
  for (const v of buffers.groupMem.values()) {
    for (let i = 0; i < MEMORY_DIM; i++) v[i] *= f;
  }
}

/** Drop group memories whose group no longer exists (collapse death). */
export function pruneGroupMemory(buffers, liveGroupIds) {
  for (const id of [...buffers.groupMem.keys()]) {
    if (!liveGroupIds.has(id)) buffers.groupMem.delete(id);
  }
}

/** Clear all memory on simulation restart. */
export function resetMemoryBuffers(buffers) {
  buffers.speciesMem.clear();
  buffers.groupMem.clear();
}

/** Compact read-only snapshot for analytics / narrative. */
export function memorySnapshot(buffers) {
  return {
    species: [...buffers.speciesMem.entries()].map(([id, v]) => ({ id, mem: Array.from(v) })),
    groups: [...buffers.groupMem.entries()].map(([id, v]) => ({ id, mem: Array.from(v) })),
  };
}
