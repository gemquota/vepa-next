/**
 * VEPA4 — Group Construction (Set F.2 "Civilizations", RRP E·F·A trilogy)
 *
 * Groups leave their mark on the medium: each group with a real membership
 * builds a NEST/HIVE at its territory centroid (a warm pocket of INFO), and
 * neighbouring groups connect their territories with ROADS (an INFO corridor
 * along the straight line between centroids). Everything is written through
 * the unified `writeField` API from the E.1 field system, so constructions
 * are visible to physics (gradient forces, advection) and decay naturally.
 *
 * Griefing safety (design risk #4): writes are hard-capped per pass, so a
 * chaotic world with many groups can never flood the grid. The pass runs on
 * a gentle cadence from main.js (every CADENCE ticks, laws must be active).
 */
import { writeField } from '../physics/fields.js';

const MIN_MEMBERS = 4;         // a nest needs a real group
const NEST_RADIUS_CELLS = 1;   // nest footprint around the centroid (3³ cells)
const NEST_INFO = 4;           // INFO magnitude per nest cell
const NEST_THERMAL = 0.8;      // a hive runs slightly warm (centre only)
const ROAD_INFO = 2;           // INFO magnitude per road cell
const MAX_WRITES_PER_PASS = 96; // griefing cap — bounded writeField calls
const MAX_ROAD_LENGTH_CELLS = 40; // cap a single road so distant groups
                                  // don't paint the whole dish in one go
export const CONSTRUCTION_CADENCE = 15; // frames between passes

/**
 * One construction pass. Call from the intelligence loop while laws are
 * active. `opts.force` bypasses the cadence gate (tests / restart sweeps).
 * @returns {{writes:number, nests:number, roads:number}}
 */
export function applyConstructions(registry, fieldSystem, opts = {}) {
  const res = { writes: 0, nests: 0, roads: 0 };
  if (!fieldSystem) return res;
  if (!opts.force) {
    const tick = opts.tick ?? 0;
    if (tick % CONSTRUCTION_CADENCE !== 0) return res;
  }

  const groups = [...registry.groups.values()]
    .filter((g) => g.members.size >= MIN_MEMBERS && g.members.size > 0);

  // ── Nests / hives at each territory centroid ──
  for (const g of groups) {
    if (res.writes >= MAX_WRITES_PER_PASS) break;
    const cells = nestCells(fieldSystem, g.cx, g.cy, g.cz, NEST_RADIUS_CELLS);
    for (let k = 0; k < cells.length; k++) {
      if (res.writes >= MAX_WRITES_PER_PASS) break;
      const [x, y, z] = cells[k];
      writeField(fieldSystem, 'INFO', x, y, z, NEST_INFO);
      res.writes++;
      // Only the hive's heart (the centroid cell, listed first) runs warm.
      if (k === 0) {
        writeField(fieldSystem, 'THERMAL', x, y, z, NEST_THERMAL);
        res.writes++;
      }
    }
    res.nests++;
  }

  // ── Roads between group centroids (INFO corridors) ──
  const pairs = centroidPairs(groups);
  for (const [a, b] of pairs) {
    if (res.writes >= MAX_WRITES_PER_PASS) break;
    const cells = roadCells(fieldSystem, a, b, MAX_ROAD_LENGTH_CELLS);
    for (const [x, y, z] of cells) {
      if (res.writes >= MAX_WRITES_PER_PASS) break;
      writeField(fieldSystem, 'INFO', x, y, z, ROAD_INFO);
      res.writes++;
    }
    if (cells.length > 0) res.roads++;
  }

  return res;
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

/** Cell centres within a cube of `radius` cells around a world position. */
function nestCells(system, px, py, pz, radius) {
  const { cell, dim } = system;
  const cx = clamp(Math.floor(px / cell), 0, dim - 1);
  const cy = clamp(Math.floor(py / cell), 0, dim - 1);
  const cz = clamp(Math.floor(pz / cell), 0, dim - 1);
  const out = [];
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = clamp(cx + dx, 0, dim - 1);
        const y = clamp(cy + dy, 0, dim - 1);
        const z = clamp(cz + dz, 0, dim - 1);
        out.push([(x + 0.5) * cell, (y + 0.5) * cell, (z + 0.5) * cell]);
      }
    }
  }
  return out;
}

/** Every unordered pair of distinct centroids (only nearest neighbours are
 * connected to keep the road web sparse: each group links to its closest
 * two others). */
function centroidPairs(groups) {
  const out = [];
  for (let i = 0; i < groups.length; i++) {
    const a = groups[i];
    // Nearest two neighbours by centroid distance.
    const dists = groups
      .map((b, j) => ({ j, d2: dist2(a, b) }))
      .filter(({ j }) => j !== i)
      .sort((p, q) => p.d2 - q.d2)
      .slice(0, 2);
    for (const { j } of dists) {
      if (j > i) out.push([a, groups[j]]);
    }
  }
  return out;
}

function dist2(a, b) {
  return (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2 + (a.cz - b.cz) ** 2;
}

/** Cell centres along the straight line a→b (3D DDA), capped in length. */
function roadCells(system, a, b, maxCells) {
  const { cell, dim } = system;
  const clampCell = (v) => clamp(Math.floor(v / cell), 0, dim - 1);
  const ax = clampCell(a.cx), ay = clampCell(a.cy), az = clampCell(a.cz);
  const bx = clampCell(b.cx), by = clampCell(b.cy), bz = clampCell(b.cz);
  const dist = Math.max(1, Math.abs(bx - ax), Math.abs(by - ay), Math.abs(bz - az));
  if (dist > maxCells) return []; // too far — no road this pass
  const out = [];
  for (let s = 0; s <= dist; s++) {
    const t = s / dist;
    const x = clamp(Math.round(ax + (bx - ax) * t), 0, dim - 1);
    const y = clamp(Math.round(ay + (by - ay) * t), 0, dim - 1);
    const z = clamp(Math.round(az + (bz - az) * t), 0, dim - 1);
    out.push([(x + 0.5) * cell, (y + 0.5) * cell, (z + 0.5) * cell]);
  }
  return out;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
