/**
 * VEPA4 — Group Economy (Set F.3 "Civilizations", RRP E·F·A trilogy)
 *
 * The social layer gets a full (if toy) economy:
 *
 *   - Treasury: each group holds a shared pool. Foragers earn income by
 *     ranging (their activity is the group's production), and the leader
 *     tithes a small bonus. Capped so prices stay meaningful.
 *   - Pairwise trade: groups whose territories are close (within TRADE_RANGE)
 *     exchange treasury proportional to their difference — the richer group
 *     pays down the poorer, a simple mean-reverting price discovery.
 *   - Market prices: each group's price (treasury per member) is written into
 *     the INFO scalar field at its centroid via the unified writeField API,
 *     so prices live on the grid (and decay like any other field write).
 *
 * Trade history is appended to `registry.tradeLog` (a bounded ring) so the
 * F.4 analytics can draw the network graph + economy Sankey. Everything is
 * deterministic — no PRNG.
 */
import { writeField } from '../physics/fields.js';

const MIN_MEMBERS = 2;            // a lone particle does not trade
const TRADE_RANGE = 450;          // centroid distance for a trade route
const MAX_TRADE_AMOUNT = 6;       // max units per direction per pass
const TRADE_FRACTION = 0.06;      // share of the gap exchanged per pass
const FORAGER_INCOME = 0.5;       // treasury per forager per pass
const LEADER_TITHE = 2;           // leader bonus per pass
const MAX_TREASURY = 10000;       // price sanity cap
const PRICE_WRITE = 0.1;          // INFO magnitude per treasury/member unit
const TRADE_LOG_CAP = 40;         // ring size for the analytics layer
export const ECONOMY_CADENCE = 20; // frames between passes

/**
 * One economy pass. Call from the intelligence loop while laws are active.
 * `opts.force` bypasses the cadence gate (tests).
 * @returns {{trades:number, volume:number, treasuries:Object<number,number>}}
 */
export function runEconomy(registry, view, stride, fieldSystem, opts = {}) {
  const res = { trades: 0, volume: 0, treasuries: {} };
  if (!opts.force) {
    const tick = opts.tick ?? 0;
    if (tick % ECONOMY_CADENCE !== 0) return res;
  }

  const groups = [...registry.groups.values()]
    .filter((g) => g.members.size >= MIN_MEMBERS && g.members.size > 0);

  // ── Income: foragers produce, leaders tithe ──
  for (const g of groups) {
    g.treasury = clampTreasury(
      g.treasury + g.roles.forager * FORAGER_INCOME + (g.roles.leader ? LEADER_TITHE : 0),
    );
    res.treasuries[g.id] = g.treasury;
  }

  // ── Pairwise trade between close groups ──
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i];
      const b = groups[j];
      const d2 = (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2 + (a.cz - b.cz) ** 2;
      if (d2 > TRADE_RANGE * TRADE_RANGE) continue;
      const gap = a.treasury - b.treasury;
      const amount = Math.min(MAX_TRADE_AMOUNT, Math.abs(gap) * TRADE_FRACTION);
      if (amount < 1) continue; // no fractional dust trades
      if (gap > 0) {
        a.treasury = clampTreasury(a.treasury - amount);
        b.treasury = clampTreasury(b.treasury + amount);
      } else {
        b.treasury = clampTreasury(b.treasury - amount);
        a.treasury = clampTreasury(a.treasury + amount);
      }
      pushTrade(registry, { from: gap > 0 ? a.id : b.id, to: gap > 0 ? b.id : a.id, amount });
      res.trades++;
      res.volume += amount;
      res.treasuries[a.id] = a.treasury;
      res.treasuries[b.id] = b.treasury;
      if (fieldSystem) {
        writeField(fieldSystem, 'INFO', a.cx, a.cy, a.cz, (b.treasury / Math.max(1, b.members.size)) * PRICE_WRITE);
      }
    }
  }

  // ── Market prices on the grid at every centroid ──
  if (fieldSystem) {
    for (const g of groups) {
      writeField(fieldSystem, 'INFO', g.cx, g.cy, g.cz, (g.treasury / Math.max(1, g.members.size)) * PRICE_WRITE);
    }
  }

  return res;
}

function clampTreasury(v) {
  return v < 0 ? 0 : v > MAX_TREASURY ? MAX_TREASURY : v;
}

function pushTrade(registry, entry) {
  if (!registry.tradeLog) registry.tradeLog = [];
  registry.tradeLog.push({ ...entry, tick: registry.frame });
  if (registry.tradeLog.length > TRADE_LOG_CAP) registry.tradeLog.shift();
}
