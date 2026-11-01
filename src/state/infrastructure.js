/**
 * VEPA4 — Infrastructure & Energy (Set K.1 "Infrastructure & Energy", RRP I·J·K trilogy)
 *
 * The capstone of the I·J·K trilogy: civilizations stop living off the land
 * and start powering it.
 *
 *   1. EXTRACTION (decision K.1) — every group harvests ambient field energy
 *      at its territory: the INFO + THERMAL scalar values at the centroid
 *      cell become treasury, and the SAME amount is consumed from the field
 *      (conservation — design risk K.4, no free energy). `g.infra.harvested`
 *      tracks the take.
 *   2. ENERGY GRIDS (decision K.1) — allied groups share power: each group
 *      with allies spends a small treasury cost per member and feeds that
 *      member's ENERGY pool (harvest → treasury → members; still conserved).
 *   3. MEGA-STRUCTURES (decision K.2) — long-horizon coordinated builds:
 *      WALL (impassable ring at the territory corners), BRIDGE (INFO corridor
 *      toward the nearest non-ally), HUB (THERMAL + INFO heart at the
 *      centroid). A group with treasury ≥ MEGA_START_TREASURY and no active
 *      project initiates one (kind rotates by group id — deterministic);
 *      each pass it invests MEGA_INVEST treasury into progress, advancing
 *      faster in later eras (era-progressed); at target the build executes
 *      with hard write caps (design risk #2 — no griefing) and journals.
 *
 * Everything is deterministic — no PRNG.
 */
import { STRIDE_INDEXES } from '../constants.js';
import { writeField, writeWall } from '../physics/fields.js';

const MIN_MEMBERS = 3;               // a civilization needs real membership
const HARVEST_RATE_DEFAULT = 0.1;    // share of cell energy harvested per pass
const GRID_FEED_DEFAULT = 0.05;      // member ENERGY feed per ally
const GRID_COST_FACTOR = 0.5;        // treasury cost per feed unit
const MEGA_INVEST_DEFAULT = 20;      // treasury per progress tick
const MEGA_START_TREASURY = 300;     // threshold to initiate a project
const MEGA_TARGET = 20;              // progress ticks to complete
const MEGA_ERA_BONUS = 0.5;          // extra progress per era (era-progressed)
const MEGA_MAX_WRITES = 24;          // griefing cap per completed build
const BRIDGE_RANGE = 700;            // corridor length cap (world units)
const ENERGY_FEED_CAP = 100;         // per-member ENERGY ceiling
export const INFRA_CADENCE = 25;     // frames between passes

function clampTreasury(v) {
  return v < 0 ? 0 : v > 10000 ? 10000 : v;
}

/** Scalar field value at a world position (direct grid read, no allocation). */
function fieldAt(system, name, px, py, pz) {
  const { cell, dim } = system;
  const x = Math.max(0, Math.min(dim - 1, Math.floor(px / cell)));
  const y = Math.max(0, Math.min(dim - 1, Math.floor(py / cell)));
  const z = Math.max(0, Math.min(dim - 1, Math.floor(pz / cell)));
  return system.scalars[name][(z * dim + y) * dim + x] || 0;
}

/** Subtract a bounded amount from a scalar cell (consumption, ≥ 0). */
function consumeField(system, name, px, py, pz, amount) {
  const { cell, dim } = system;
  const x = Math.max(0, Math.min(dim - 1, Math.floor(px / cell)));
  const y = Math.max(0, Math.min(dim - 1, Math.floor(py / cell)));
  const z = Math.max(0, Math.min(dim - 1, Math.floor(pz / cell)));
  const i = (z * dim + y) * dim + x;
  const taken = Math.min(amount, system.scalars[name][i] || 0);
  system.scalars[name][i] -= taken;
  return taken;
}

function centroidDist2(a, b) {
  return (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2 + (a.cz - b.cz) ** 2;
}

/** Nearest non-ally group (bridges connect civilizations). */
function nearestNonAlly(registry, g) {
  let target = null;
  let best = Infinity;
  for (const o of registry.groups.values()) {
    if (o === g || o.members.size === 0 || g.allies.has(o.id)) continue;
    const d2 = centroidDist2(g, o);
    if (d2 < best) { best = d2; target = o; }
  }
  return target;
}

/**
 * One infrastructure pass. Call from the intelligence loop while laws are
 * active. `opts.force` bypasses the cadence gate (tests).
 * @returns {{harvested:number, fed:number, megaStarted:number,
 *            megaCompleted:number, events:Array}}
 */
export function runInfrastructure(registry, view, stride, fieldSystem, opts = {}) {
  const res = { harvested: 0, fed: 0, megaStarted: 0, megaCompleted: 0, events: [] };
  if (!opts.force) {
    const tick = opts.tick ?? 0;
    if (tick % INFRA_CADENCE !== 0) return res;
  }
  if (!fieldSystem) return res;

  const params = opts.worldParams || {};
  const harvestRate = Number.isFinite(Number(params.HARVEST_RATE)) ? Number(params.HARVEST_RATE) : HARVEST_RATE_DEFAULT;
  const gridFeed = Number.isFinite(Number(params.GRID_FEED)) ? Number(params.GRID_FEED) : GRID_FEED_DEFAULT;
  const megaInvest = Number.isFinite(Number(params.MEGA_INVEST)) ? Number(params.MEGA_INVEST) : MEGA_INVEST_DEFAULT;
  const era = opts.era || 0;

  const groups = [...registry.groups.values()]
    .filter((g) => g.members.size >= MIN_MEMBERS && g.members.size > 0);

  for (const g of groups) {
    // ── 1. Extraction: ambient field energy → treasury (conserved) ──
    let take = 0;
    for (const name of ['INFO', 'THERMAL']) {
      const available = fieldAt(fieldSystem, name, g.cx, g.cy, g.cz);
      const amount = available * harvestRate;
      if (amount > 0) take += consumeField(fieldSystem, name, g.cx, g.cy, g.cz, amount);
    }
    if (take > 0) {
      g.treasury = clampTreasury(g.treasury + take);
      g.infra.harvested += take;
      res.harvested += take;
      res.events.push({ type: 'infra:harvest', group: g, amount: take });
    }

    // ── 2. Energy grids: allied power → member ENERGY (treasury-paid) ──
    if (g.allies.size > 0 && view && stride) {
      const feed = gridFeed * g.allies.size;
      const cost = g.members.size * feed * GRID_COST_FACTOR;
      if (g.treasury >= cost && feed > 0) {
        g.treasury = clampTreasury(g.treasury - cost);
        const S = STRIDE_INDEXES;
        let fed = 0;
        for (const m of g.members) {
          const base = m * stride;
          if (view[base + S.DEAD] >= 0.5) continue;
          view[base + S.ENERGY] = Math.min(ENERGY_FEED_CAP, (view[base + S.ENERGY] || 0) + feed);
          fed++;
        }
        g.infra.grid = g.allies.size;
        res.fed += fed;
        res.events.push({ type: 'infra:grid', group: g, fed });
      }
    }

    // ── 3. Mega-structures: long-horizon coordinated builds ──
    if (!g.mega && g.treasury >= MEGA_START_TREASURY) {
      const kinds = ['WALL', 'BRIDGE', 'HUB'];
      g.mega = { kind: kinds[g.id % kinds.length], progress: 0, target: MEGA_TARGET };
      res.megaStarted++;
      res.events.push({ type: 'infra:mega-init', group: g, kind: g.mega.kind });
    }
    if (g.mega && g.treasury >= megaInvest) {
      g.treasury = clampTreasury(g.treasury - megaInvest);
      g.mega.progress += 1 + era * MEGA_ERA_BONUS;
      if (g.mega.progress >= g.mega.target) {
        const kind = g.mega.kind;
        const bridgeTarget = kind === 'BRIDGE' ? nearestNonAlly(registry, g) : null;
        executeMega(g, fieldSystem, bridgeTarget, res);
        g.mega = null;
        res.megaCompleted++;
        res.events.push({ type: 'infra:mega-complete', group: g, kind });
      }
    }
  }

  return res;
}

// ── Mega-structure execution ─────────────────────────────────────────────────

function executeMega(g, fieldSystem, bridgeTarget, res) {
  const { cell, dim } = fieldSystem;
  const clampCell = (v) => Math.max(0, Math.min(dim - 1, Math.floor(v / cell)));
  let writes = 0;
  const canWrite = () => writes++ < MEGA_MAX_WRITES;

  if (g.mega.kind === 'WALL') {
    // Impassable ring at the territory corners (like Set I barriers, denser).
    const x0 = (clampCell(g.minX) + 0.5) * cell;
    const x1 = (clampCell(g.maxX) + 0.5) * cell;
    const y0 = (clampCell(g.minY) + 0.5) * cell;
    const y1 = (clampCell(g.maxY) + 0.5) * cell;
    const z0 = (clampCell(g.minZ) + 0.5) * cell;
    const z1 = (clampCell(g.maxZ) + 0.5) * cell;
    const corners = [
      [x0, y0, z0], [x1, y0, z0], [x0, y1, z0], [x1, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x0, y1, z1], [x1, y1, z1],
    ];
    for (const [x, y, z] of corners) {
      if (!canWrite()) break;
      writeWall(fieldSystem, x, y, z, true);
    }
  } else if (g.mega.kind === 'BRIDGE') {
    // INFO corridor toward the nearest non-ally (or the world centre).
    const cells = bridgeCells(g, fieldSystem, bridgeTarget);
    for (const [x, y, z] of cells) {
      if (!canWrite()) break;
      writeField(fieldSystem, 'INFO', x, y, z, 2);
    }
  } else {
    // HUB: THERMAL + INFO heart at the centroid (a powered civic centre).
    if (canWrite()) writeField(fieldSystem, 'THERMAL', g.cx, g.cy, g.cz, 1);
    if (canWrite()) writeField(fieldSystem, 'INFO', g.cx, g.cy, g.cz, 4);
  }
}

// ── Bridge geometry ──────────────────────────────────────────────────────────

/** World-space cells along the line from g toward the bridge target. */
function bridgeCells(g, system, target) {
  const { cell, dim, worldSize } = system;
  const clampCell = (v) => Math.max(0, Math.min(dim - 1, Math.floor(v / cell)));
  const ax = clampCell(g.cx), ay = clampCell(g.cy), az = clampCell(g.cz);
  let tx, ty, tz;
  if (target) {
    tx = clampCell(target.cx); ty = clampCell(target.cy); tz = clampCell(target.cz);
  } else {
    // No neighbour: corridor toward the world centre (deterministic stub).
    const mid = clampCell(worldSize / 2);
    tx = mid; ty = mid; tz = mid;
  }
  const dist = Math.max(1, Math.abs(tx - ax), Math.abs(ty - ay), Math.abs(tz - az));
  const len = Math.min(dist, Math.round(BRIDGE_RANGE / cell));
  const out = [];
  for (let s = 1; s <= len; s++) {
    const t = s / len;
    const x = Math.round(ax + (tx - ax) * t);
    const y = Math.round(ay + (ty - ay) * t);
    const z = Math.round(az + (tz - az) * t);
    out.push([(x + 0.5) * cell, (y + 0.5) * cell, (z + 0.5) * cell]);
  }
  return out;
}
