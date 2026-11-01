/**
 * VEPA4 — Group Artifacts (Set I.1 "Tools & Artifacts", RRP I·J·K trilogy)
 *
 * Civilizations stop being emergent clusters and become tool-using: each group
 * holds a per-group inventory of TOOL / WEAPON / BARRIER artifacts, crafted by
 * spending treasury (its builders do the work — a group without builders can't
 * craft). Artifacts decay over time: every pass levies a small treasury
 * maintenance cost per artifact; when the treasury can't cover it the artifact
 * is lost (design risk I.1 — crafting is bounded by rate, cost and decay).
 *
 * Effects (all field/memory based — no new physics, design decision I.2):
 *   TOOL    → treasury income boost per artifact (an industrial dividend).
 *   WEAPON  → reduces the group's collective THREAT memory, so its member
 *             species flee less (feeds the Set H.2 goal behavior).
 *   BARRIER → writes impassable wall cells at the group's territory edge via
 *             the E.1 wall grid (impassable while COLL is on, like preset
 *             walls). Griefing-capped per pass (design risk #2).
 *
 * Everything is deterministic — no PRNG. Craft choice is the kind the group
 * has fewest of (ties resolve TOOL → WEAPON → BARRIER), so inventories spread
 * naturally instead of stacking one kind.
 */
import { writeWall } from '../physics/fields.js';
import { groupMemory, MEM } from './memoryBuffers.js';

const MIN_MEMBERS = 3;          // a group that crafts needs real membership
const CRAFT_INTERVAL = 6;       // ticks between crafts per group (rate cap)
const MAX_INVENTORY = 12;       // per-kind cap (design risk I.1 bound)
const TOOL_INCOME = 2;          // treasury per TOOL per pass
const WEAPON_THREAT_CUT = 0.02; // threat-memory reduction per WEAPON per pass
const BARRIER_CORNERS = 8;      // wall cells per BARRIER (territory bbox corners)
const MAX_WALL_WRITES = 48;     // griefing cap — bounded writeWall calls
const CRAFT_LOG_CAP = 40;       // ring size for the analytics layer
export const ARTIFACT_CADENCE = 20; // frames between passes

/**
 * One artifacts pass. Call from the intelligence loop while laws are active.
 * `opts.force` bypasses the cadence gate (tests).
 * @returns {{crafted:number, decayed:number, walls:number, income:number}}
 */
export function runArtifacts(registry, fieldSystem, opts = {}) {
  const res = { crafted: 0, decayed: 0, walls: 0, income: 0 };
  if (!opts.force) {
    const tick = opts.tick ?? 0;
    if (tick % ARTIFACT_CADENCE !== 0) return res;
  }
  if (!fieldSystem) return res;

  const params = opts.worldParams || {};
  const craftCost = Number.isFinite(Number(params.CRAFT_COST)) ? Number(params.CRAFT_COST) : 40;
  const decayRate = Number.isFinite(Number(params.ARTIFACT_DECAY)) ? Number(params.ARTIFACT_DECAY) : 0.004;
  const tick = opts.tick ?? 0;
  const buffers = opts.memoryBuffers || null;
  const kinds = ['TOOL', 'WEAPON', 'BARRIER'];

  const groups = [...registry.groups.values()]
    .filter((g) => g.members.size >= MIN_MEMBERS && g.members.size > 0);

  for (const g of groups) {
    const inv = g.artifacts || (g.artifacts = { TOOL: 0, WEAPON: 0, BARRIER: 0 });

    // ── Craft: builders spend treasury; rate + inventory capped ──
    if (g.roles.builder > 0 && tick % CRAFT_INTERVAL === 0) {
      const kind = rarestKind(inv, kinds);
      if (inv[kind] < MAX_INVENTORY && g.treasury >= craftCost) {
        g.treasury -= craftCost;
        inv[kind]++;
        pushCraft(registry, { group: g.id, kind, cost: craftCost, tick });
        res.crafted++;
      }
    }

    // ── Decay: maintenance cost per artifact; unpaid artifacts are lost ──
    for (const kind of kinds) {
      const count = inv[kind];
      if (count <= 0) continue;
      const maintenance = Math.ceil(count * decayRate * craftCost);
      if (g.treasury >= maintenance) {
        g.treasury -= maintenance;
      } else {
        inv[kind] = 0;
        pushCraft(registry, { group: g.id, kind, cost: -count, tick, lost: true });
        res.decayed += count;
      }
    }

    // ── TOOL: industrial dividend straight into the treasury ──
    if (inv.TOOL > 0) {
      const income = inv.TOOL * TOOL_INCOME;
      g.treasury = clampTreasury(g.treasury + income);
      res.income += income;
    }

    // ── WEAPON: damp the group's collective threat memory ──
    if (inv.WEAPON > 0 && buffers) {
      const mem = groupMemory(buffers, g.id);
      mem[MEM.THREAT] = Math.max(0, mem[MEM.THREAT] * (1 - inv.WEAPON * WEAPON_THREAT_CUT));
    }

    // ── BARRIER: wall cells at the territory bbox corners (griefing-capped) ──
    if (inv.BARRIER > 0) {
      const corners = bboxCorners(g, fieldSystem);
      for (let k = 0; k < inv.BARRIER; k++) {
        for (const [x, y, z] of corners) {
          if (res.walls >= MAX_WALL_WRITES) break;
          writeWall(fieldSystem, x, y, z, true);
          res.walls++;
        }
        if (res.walls >= MAX_WALL_WRITES) break;
      }
    }
  }

  return res;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** The kind the group has fewest of (ties → TOOL, WEAPON, BARRIER order). */
function rarestKind(inv, kinds) {
  let best = kinds[0];
  let bestN = inv[best];
  for (let k = 1; k < kinds.length; k++) {
    const n = inv[kinds[k]];
    if (n < bestN) { bestN = n; best = kinds[k]; }
  }
  return best;
}

/** The 8 corners of the group's territory bounding box (world positions). */
function bboxCorners(g, system) {
  const { cell, dim } = system;
  const clampCell = (v) => Math.max(0, Math.min(dim - 1, Math.floor(v / cell)));
  const x0 = (clampCell(g.minX) + 0.5) * cell;
  const x1 = (clampCell(g.maxX) + 0.5) * cell;
  const y0 = (clampCell(g.minY) + 0.5) * cell;
  const y1 = (clampCell(g.maxY) + 0.5) * cell;
  const z0 = (clampCell(g.minZ) + 0.5) * cell;
  const z1 = (clampCell(g.maxZ) + 0.5) * cell;
  return [
    [x0, y0, z0], [x1, y0, z0], [x0, y1, z0], [x1, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x0, y1, z1], [x1, y1, z1],
  ];
}

function clampTreasury(v) {
  return v < 0 ? 0 : v > 10000 ? 10000 : v;
}

function pushCraft(registry, entry) {
  registry.craftLog.push({ ...entry });
  if (registry.craftLog.length > CRAFT_LOG_CAP) registry.craftLog.shift();
}
