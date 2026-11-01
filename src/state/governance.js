/**
 * VEPA4 — Society & Governance (Set J.1 "Society & Governance", RRP I·J·K trilogy)
 *
 * Civilizations get a government. Every group derives a **policy vector** —
 * AGGRESSION / OPENNESS / MIGRATION, each 0..1 — from what its members have
 * learned (Set G species memory) and what it owns (F.3 treasury):
 *   aggression ← learned THREAT + scarcity (poor, frightened groups get mean)
 *   openness   ← surplus + learned EXPLORATION (rich groups trade)
 *   migration  ← learned EXPLORATION + low density (crowded groups disperse)
 *
 * Relations (decision J.2):
 *   - ALLIANCE: close groups (centroid distance < ALLIANCE_RANGE) with similar
 *     policy (distance < 0.25) ally — marked on both sides and their treasuries
 *     mean-revert toward a shared pool (a tithe, exactly like pairwise trade).
 *   - CONFLICT: close groups with opposed policy (distance > CONFLICT_THRESHOLD)
 *     fight over the border — a negative INFO write at the contested midpoint
 *     and a threat-memory nudge on both member species (feeds H.2 flee + the
 *     next policy derivation). Cooldown-gated (design risk J.3 — no storms),
 *     and the field write decays naturally like any other (reversible).
 *
 * Effects (decision J.1) — policy shifts member behavior, deterministically:
 *   - AGGRESSION  → the group raids its nearest non-ally: a bounded treasury
 *                   transfer from the victim.
 *   - OPENNESS    → commerce: a treasury bonus + market INFO write at the
 *                   centroid (trade volume up).
 *   - MIGRATION   → members get a small outward velocity nudge from the
 *                   centroid (disperse), well under the physics clamps.
 *
 * Stability = 1 − aggression × 0.5, so belligerent groups are brittle
 * (their raids soften) — governance self-bounds.
 */
import { STRIDE_INDEXES } from '../constants.js';
import { writeField } from '../physics/fields.js';
import { MEM } from './memoryBuffers.js';

const MIN_MEMBERS = 3;             // a polity needs real membership
const ALLY_POLICY_DIST = 0.25;     // similar enough to ally
const ALLY_TITHE = 4;              // max treasury units pooled per pass
const ALLY_TITHE_FRACTION = 0.05;  // share of the gap pooled per pass
const RAID_AMOUNT = 5;             // max treasury stolen per raid
const RAID_FRACTION = 0.05;        // share of the victim's treasury per raid
const OPENNESS_INCOME = 1.5;       // commerce bonus per openness unit
const MIGRATION_STRENGTH = 0.02;   // outward velocity nudge (bounded)
const CONFLICT_COOLDOWN = 300;     // ticks between conflicts on a pair
const CONFLICT_INFO = 0.6;         // negative INFO magnitude at the border
const CONFLICT_THREAT = 0.05;      // threat-memory nudge per conflict
const POLICY_RATE_DEFAULT = 0.1;   // policy blend rate per pass
const ALLIANCE_RANGE_DEFAULT = 350;
const CONFLICT_THRESHOLD_DEFAULT = 0.5;
export const GOVERNANCE_CADENCE = 25; // frames between passes

function clamp01(v) {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

function clampTreasury(v) {
  return v < 0 ? 0 : v > 10000 ? 10000 : v;
}

function centroidDist2(a, b) {
  return (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2 + (a.cz - b.cz) ** 2;
}

function policyDist(a, b) {
  return Math.max(
    Math.abs(a.policy.aggression - b.policy.aggression),
    Math.abs(a.policy.openness - b.policy.openness),
    Math.abs(a.policy.migration - b.policy.migration),
  );
}

/**
 * One governance pass: derive policies, update relations, apply effects.
 * `opts.force` bypasses the cadence gate (tests).
 * @returns {{alliances:number, conflicts:number, raids:number, income:number,
 *            events:Array<{type:string, group?:object, other?:object}>}}
 */
export function runGovernance(registry, view, stride, fieldSystem, opts = {}) {
  const res = { alliances: 0, conflicts: 0, raids: 0, income: 0, events: [] };
  if (!opts.force) {
    const tick = opts.tick ?? 0;
    if (tick % GOVERNANCE_CADENCE !== 0) return res;
  }

  const params = opts.worldParams || {};
  const policyRate = Number.isFinite(Number(params.POLICY_SHIFT)) ? Number(params.POLICY_SHIFT) : POLICY_RATE_DEFAULT;
  const allianceRange = Number.isFinite(Number(params.ALLIANCE_RANGE)) ? Number(params.ALLIANCE_RANGE) : ALLIANCE_RANGE_DEFAULT;
  const conflictThreshold = Number.isFinite(Number(params.CONFLICT_THRESHOLD)) ? Number(params.CONFLICT_THRESHOLD) : CONFLICT_THRESHOLD_DEFAULT;
  const tick = opts.tick ?? 0;
  const buffers = opts.memoryBuffers || null;

  const groups = [...registry.groups.values()]
    .filter((g) => g.members.size >= MIN_MEMBERS && g.members.size > 0);

  // ── 1. Policy derivation (from member memory + treasury) ──
  for (const g of groups) {
    derivePolicy(g, buffers, policyRate);
  }

  // ── 2. Relations: alliances + conflicts ──
  const range2 = allianceRange * allianceRange;
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i];
      const b = groups[j];
      if (centroidDist2(a, b) > range2) continue;
      const pd = policyDist(a, b);
      if (pd < ALLY_POLICY_DIST) {
        ally(a, b, res);
      } else if (pd > conflictThreshold) {
        conflict(a, b, fieldSystem, buffers, tick, res);
      }
    }
  }

  // ── 3. Policy effects on members ──
  for (const g of groups) {
    applyEffects(g, registry, view, stride, fieldSystem, res);
  }

  return res;
}

// ── Policy ───────────────────────────────────────────────────────────────────

function derivePolicy(g, buffers, rate) {
  const species = [...(g.species || [])];
  let threat = 0, exploration = 0;
  if (buffers && species.length > 0) {
    for (const sp of species) {
      const mem = buffers.speciesMem.get(sp);
      if (!mem) continue;
      threat += mem[MEM.THREAT] || 0;
      exploration += mem[MEM.EXPLORATION] || 0;
    }
    threat /= species.length;
    exploration /= species.length;
  }
  const surplus = clamp01(g.treasury / 1000);
  const scarcity = clamp01(1 - g.treasury / 1000);
  const density = clamp01(g.members.size / 50);

  const target = {
    aggression: clamp01(threat * 0.6 + scarcity * 0.4),
    openness: clamp01(surplus * 0.6 + exploration * 0.4),
    migration: clamp01(exploration * 0.7 + (1 - density) * 0.3),
  };
  const p = g.policy;
  p.aggression = clamp01(p.aggression + (target.aggression - p.aggression) * rate);
  p.openness = clamp01(p.openness + (target.openness - p.openness) * rate);
  p.migration = clamp01(p.migration + (target.migration - p.migration) * rate);
  g.stability = clamp01(1 - p.aggression * 0.5);
}

// ── Relations ────────────────────────────────────────────────────────────────

function ally(a, b, res) {
  a.allies.add(b.id);
  b.allies.add(a.id);
  // Shared pool: mean-revert the treasuries (a tithe, like pairwise trade).
  const gap = a.treasury - b.treasury;
  const amount = Math.min(ALLY_TITHE, Math.abs(gap) * ALLY_TITHE_FRACTION);
  if (amount >= 1) {
    if (gap > 0) {
      a.treasury = clampTreasury(a.treasury - amount);
      b.treasury = clampTreasury(b.treasury + amount);
    } else {
      b.treasury = clampTreasury(b.treasury - amount);
      a.treasury = clampTreasury(a.treasury + amount);
    }
  }
  res.alliances++;
  res.events.push({ type: 'governance:alliance', group: a, other: b });
}

function conflict(a, b, fieldSystem, buffers, tick, res) {
  // Cooldown per pair (both sides store each other).
  const ac = a.conflicts.get(b.id);
  const bc = b.conflicts.get(a.id);
  if ((ac && tick < ac.cooldownUntil) || (bc && tick < bc.cooldownUntil)) return;
  a.conflicts.set(b.id, { since: tick, cooldownUntil: tick + CONFLICT_COOLDOWN });
  b.conflicts.set(a.id, { since: tick, cooldownUntil: tick + CONFLICT_COOLDOWN });
  // Contested border: negative INFO at the midpoint (tension on the field).
  if (fieldSystem) {
    writeField(fieldSystem, 'INFO', (a.cx + b.cx) / 2, (a.cy + b.cy) / 2, (a.cz + b.cz) / 2, -CONFLICT_INFO);
  }
  // Fear spreads: nudge both member species' THREAT memory (feeds H.2 flee +
  // the next policy derivation — aggression begets aggression, clamp01-bounded).
  if (buffers) {
    for (const g of [a, b]) {
      for (const sp of g.species || []) {
        const mem = buffers.speciesMem.get(sp);
        if (!mem) continue;
        mem[MEM.THREAT] = clamp01((mem[MEM.THREAT] || 0) + CONFLICT_THREAT);
      }
    }
  }
  res.conflicts++;
  res.events.push({ type: 'governance:conflict', group: a, other: b });
}

// ── Effects ──────────────────────────────────────────────────────────────────

function applyEffects(g, registry, view, stride, fieldSystem, res) {
  const p = g.policy;

  // AGGRESSION: raid the nearest non-ally (bounded treasury transfer).
  if (p.aggression > 0.5) {
    let victim = null;
    let best = Infinity;
    for (const o of registry.groups.values()) {
      if (o === g || o.members.size === 0 || g.allies.has(o.id)) continue;
      const d2 = centroidDist2(g, o);
      if (d2 < best) { best = d2; victim = o; }
    }
    if (victim && victim.treasury > 0) {
      const take = Math.min(RAID_AMOUNT * p.aggression * g.stability, victim.treasury * RAID_FRACTION);
      if (take >= 0.5) {
        victim.treasury = clampTreasury(victim.treasury - take);
        g.treasury = clampTreasury(g.treasury + take);
        res.raids++;
        res.events.push({ type: 'governance:raid', group: g, other: victim, amount: take });
      }
    }
  }

  // OPENNESS: commerce — treasury bonus + market INFO at the centroid.
  if (p.openness > 0.3) {
    const income = p.openness * OPENNESS_INCOME;
    g.treasury = clampTreasury(g.treasury + income);
    res.income += income;
    if (fieldSystem) {
      writeField(fieldSystem, 'INFO', g.cx, g.cy, g.cz, p.openness * 0.15);
    }
  }

  // MIGRATION: disperse — outward velocity nudges on members.
  if (p.migration > 0.3 && view && stride) {
    const S = STRIDE_INDEXES;
    const strength = p.migration * MIGRATION_STRENGTH;
    for (const m of g.members) {
      const base = m * stride;
      if (view[base + S.DEAD] >= 0.5) continue;
      const dx = view[base + S.POS_X] - g.cx;
      const dy = view[base + S.POS_Y] - g.cy;
      const dz = view[base + S.POS_Z] - g.cz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      view[base + S.VEL_X] += (dx / dist) * strength;
      view[base + S.VEL_Y] += (dy / dist) * strength;
      view[base + S.VEL_Z] += (dz / dist) * strength;
    }
  }
}
