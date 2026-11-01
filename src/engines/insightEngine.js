/**
 * VEPA v3 — Insight Engine
 * Spatio-temporal cluster detection and "interestingness" scoring.
 *
 * Iterates live particles each scanInterval frames, groups neighbours
 * within clusterRadius, and emits cluster:detected events with aggregated
 * per-cluster statistics.  Maintains a rolling history buffer so the
 * narrative engine can observe trends (growing / shrinking / stable).
 */

import { STRIDE_INDEXES } from '../constants.js';

const DEFAULTS = {
  scanInterval:   60,
  minClusterSize: 5,
  clusterRadius:  50,
  historyLength:  120,   // how many snapshots to retain
};

/**
 * Create an insight engine instance.
 *
 * @param {import('../core/eventBus.js').EventBus} bus
 * @param {object} [config]  Override any DEFAULTS key.
 * @returns {object} Engine handle.
 */
export function createInsightEngine(bus, config = {}) {
  const cfg = { ...DEFAULTS, ...config };

  const engine = {
    bus,
    cfg,
    frame: 0,
    history: [],            // array of {timestamp, clusters}
    lastClusters: null,
  };

  return engine;
}

/* ------------------------------------------------------------------ */
/*  Main update — call every frame; engine gates on scanInterval      */
/* ------------------------------------------------------------------ */

/**
 * @param {object}  engine
 * @param {Float32Array} particleBuffer
 * @param {number}  particleCount  How many particles to inspect.
 * @param {number}  stride         Particle stride (100).
 * @param {number}  worldSize      World dimension for toroidal wrapping.
 * @param {object}  [opts]         Optional activity gates (v8.1.1):
 *   { lawActiveCount, motionGate } — when provided, scanning is skipped on
 *   a lawless and/or motionless world so the log never fires at idle.
 */
export function update(engine, particleBuffer, particleCount, stride, worldSize, opts = {}) {
  engine.frame++;
  if (engine.frame % engine.cfg.scanInterval !== 0) return;

  // v8.1.1 activity gates — no active laws, or particles standing still,
  // means there is nothing meaningful to detect. Opt-in (tests omit opts).
  if (opts.lawActiveCount !== undefined && opts.lawActiveCount <= 0) return;
  if (opts.motionGate && !hasMotion(particleBuffer, particleCount, stride, 0.05)) return;

  const clusters = detectClusters(
    particleBuffer, particleCount, stride, worldSize,
    engine.cfg.clusterRadius, engine.cfg.minClusterSize,
  );

  if (clusters.length > 0) {
    const snapshot = { timestamp: engine.frame, clusters };
    engine.lastClusters = snapshot;
    engine.history.push(snapshot);
    if (engine.history.length > engine.cfg.historyLength) {
      engine.history.shift();
    }
    engine.bus.emit('cluster:detected', snapshot);
  }
}

/* ------------------------------------------------------------------ */
/*  Activity gate — mean speed of alive particles                      */
/* ------------------------------------------------------------------ */

function hasMotion(buf, count, stride, threshold) {
  let speedSum = 0;
  let n = 0;
  for (let i = 0; i < count; i++) {
    const base = i * stride;
    if (buf[base + STRIDE_INDEXES.DEAD] >= 0.5) continue;
    const vx = buf[base + STRIDE_INDEXES.VEL_X] || 0;
    const vy = buf[base + STRIDE_INDEXES.VEL_Y] || 0;
    const vz = buf[base + STRIDE_INDEXES.VEL_Z] || 0;
    speedSum += Math.sqrt(vx * vx + vy * vy + vz * vz);
    n++;
  }
  if (n === 0) return false;
  return speedSum / n >= threshold;
}

/* ------------------------------------------------------------------ */
/*  Cluster detection (grid-accelerated neighbour grouping)            */
/* ------------------------------------------------------------------ */

function detectClusters(buf, count, stride, worldSize, radius, minSize) {
  if (count === 0) return [];

  const cellSize = radius;
  const gridDim = Math.ceil(worldSize / cellSize);
  const grid = new Map();

  // --- Populate spatial grid ---
  for (let i = 0; i < count; i++) {
    const base = i * stride;
    const px = buf[base + STRIDE_INDEXES.POS_X];
    const py = buf[base + STRIDE_INDEXES.POS_Y];
    const dead = buf[base + STRIDE_INDEXES.DEAD];
    if (dead >= 0.5) continue;                     // skip dead / soul particles

    const cx = Math.floor(px / cellSize);
    const cy = Math.floor(py / cellSize);
    const key = `${cx},${cy}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  }

  // --- Union-Find for merging overlapping clusters ---
  const parent = new Int32Array(count);
  for (let i = 0; i < count; i++) parent[i] = i;

  function find(a) {
    while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
    return a;
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  // --- Pairwise within grid cells & neighbours ---
  const radiusSq = radius * radius;
  const keys = [...grid.keys()];
  for (const key of keys) {
    const [gcx, gcy] = key.split(',').map(Number);
    // Check 3×3 neighbourhood
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nKey = `${gcx + dx},${gcy + dy}`;
        const neighbors = grid.get(nKey);
        if (!neighbors) continue;

        const current = grid.get(key);
        for (const a of current) {
          const ax = buf[a * stride + STRIDE_INDEXES.POS_X];
          const ay = buf[a * stride + STRIDE_INDEXES.POS_Y];
          for (const b of neighbors) {
            if (b <= a) continue;                   // avoid duplicate checks
            const bx = buf[b * stride + STRIDE_INDEXES.POS_X];
            const by = buf[b * stride + STRIDE_INDEXES.POS_Y];
            // Toroidal distance
            let ddx = ax - bx;
            let ddy = ay - by;
            if (ddx > worldSize / 2) ddx -= worldSize;
            else if (ddx < -worldSize / 2) ddx += worldSize;
            if (ddy > worldSize / 2) ddy -= worldSize;
            else if (ddy < -worldSize / 2) ddy += worldSize;
            if (ddx * ddx + ddy * ddy <= radiusSq) {
              union(a, b);
            }
          }
        }
      }
    }
  }

  // --- Aggregate clusters ---
  const groups = new Map();
  for (let i = 0; i < count; i++) {
    const dead = buf[i * stride + STRIDE_INDEXES.DEAD];
    if (dead >= 0.5) continue;
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }

  const clusters = [];
  for (const [, members] of groups) {
    if (members.length < minSize) continue;

    let cx = 0, cy = 0, cz = 0;
    let energy = 0;
    let dominantSpecies = 0;
    const speciesCounts = {};

    for (const idx of members) {
      const base = idx * stride;
      cx += buf[base + STRIDE_INDEXES.POS_X];
      cy += buf[base + STRIDE_INDEXES.POS_Y];
      cz += buf[base + STRIDE_INDEXES.POS_Z];
      energy += buf[base + STRIDE_INDEXES.ENERGY];
      const sp = buf[base + STRIDE_INDEXES.SPECIES_ID] | 0;
      speciesCounts[sp] = (speciesCounts[sp] || 0) + 1;
    }

    // Dominant species
    let maxCount = 0;
    for (const sp of Object.keys(speciesCounts)) {
      if (speciesCounts[sp] > maxCount) {
        maxCount = speciesCounts[sp];
        dominantSpecies = Number(sp);
      }
    }

    const n = members.length;
    // Toroidal average for centre
    let refX = buf[members[0] * stride + STRIDE_INDEXES.POS_X];
    let sumDx = 0;
    for (const idx of members) {
      let dx = buf[idx * stride + STRIDE_INDEXES.POS_X] - refX;
      if (dx > worldSize / 2) dx -= worldSize;
      else if (dx < -worldSize / 2) dx += worldSize;
      sumDx += dx;
    }
    cx = refX + sumDx / n;
    // Wrap into [0, worldSize)
    cx = ((cx % worldSize) + worldSize) % worldSize;

    let refY = buf[members[0] * stride + STRIDE_INDEXES.POS_Y];
    let sumDy = 0;
    for (const idx of members) {
      let dy = buf[idx * stride + STRIDE_INDEXES.POS_Y] - refY;
      if (dy > worldSize / 2) dy -= worldSize;
      else if (dy < -worldSize / 2) dy += worldSize;
      sumDy += dy;
    }
    cy = refY + sumDy / n;
    cy = ((cy % worldSize) + worldSize) % worldSize;

    cz /= n;

    clusters.push({
      center: { x: cx, y: cy, z: cz },
      count: n,
      speciesId: dominantSpecies,
      avgEnergy: energy / n,
    });
  }

  return clusters;
}

/* ------------------------------------------------------------------ */
/*  Trend helpers (consume from narrative / goal engine)               */
/* ------------------------------------------------------------------ */

/**
 * Return the ratio of current cluster count vs previous snapshot.
 * >1 = growing, <1 = shrinking, 1 = stable.
 */
export function clusterTrend(engine) {
  const h = engine.history;
  if (h.length < 2) return 1;
  const prev = h[h.length - 2].clusters.length;
  const curr = h[h.length - 1].clusters.length;
  if (prev === 0) return curr > 0 ? Infinity : 1;
  return curr / prev;
}
