/**
 * VEPA4 — Group Analytics (Set F.4 "Civilizations", RRP E·F·A trilogy)
 *
 * The live window into the group registry: a summary strip, a territory
 * OVERLAY (top-down projection of each group's bounding box + centroid),
 * a NETWORK GRAPH (groups as nodes, edges where they share species or
 * trade), and an economy SANKEY (treasury bars with trade flows).
 *
 * Fully decoupled: it subscribes to `groups:analytics` (emitted from main.js
 * every 30 ticks with `{registry, metrics}`) and redraws at ~2 Hz. Pure
 * canvas 2D — no DOM churn per frame.
 */

import { mountAnalyticsPanel } from './analyticsPanel.js';

const CANVAS_W = 340;
const CANVAS_H = 150;
let host = null;
let setVal = () => {};

function groupColor(id) {
  return `hsl(${(id * 47) % 360}, 75%, 62%)`;
}

/**
 * Create the civilizations dashboard inside #groups-dashboard.
 */
export function createGroupAnalytics(bus) {
  const ctx = mountAnalyticsPanel(bus, {
    mountId: 'groups-dashboard',
    title: 'GROUPS',
    cells: [
      { id: 'ga-groups', label: 'GROUPS' },
      { id: 'ga-members', label: 'MEMBERS' },
      { id: 'ga-treasury', label: 'TREASURY' },
      { id: 'ga-volume', label: 'TRADE VOLUME' },
      { id: 'ga-leaders', label: 'LEADERS' },
      { id: 'ga-artifacts', label: 'ARTIFACTS' },
      { id: 'ga-alliances', label: 'ALLIANCES' },
      { id: 'ga-conflicts', label: 'CONFLICTS' },
    ],
    canvases: [
      { id: 'ga-overlay', w: CANVAS_W, h: CANVAS_H, className: 'ga-canvas' },
      { id: 'ga-network', w: CANVAS_W, h: CANVAS_H, className: 'ga-canvas' },
      { id: 'ga-sankey', w: CANVAS_W, h: CANVAS_H, className: 'ga-canvas' },
    ],
    logs: ['ga-detail'],
    subscribe: (b, deliver) => b.on('groups:analytics', ({ registry }) => deliver(registry)),
    draw: (c, registry) => drawAll(c, registry),
  });
  if (!ctx) return;
  host = ctx.host;
  setVal = ctx.setVal;
}

/**
 * Per-group detail lines.
 *
 * Pure and exported so it can be tested without a DOM. The civilization panel
 * shipped a runtime ReferenceError for a full release because its formatter was
 * inlined in `draw` and nothing ever called it; this one is called directly by
 * tests/unit/groupAnalytics.test.js.
 *
 * @param {object[]} summaries entries shaped by summariseGroups()
 * @returns {string[]} HTML fragments, sorted richest group first
 */
export function formatGroupLines(summaries) {
  const lines = [];
  const list = [...(summaries || [])].sort((a, b) => b.treasury - a.treasury || b.members - a.members);
  for (const g of list) {
    const parts = [`${g.members} members`, `${g.treasury.toFixed(1)} treasury`];
    if (g.species) parts.push(`${g.species} species`);
    const roles = [];
    if (g.leaders) roles.push(`${g.leaders} lead`);
    if (g.foragers) roles.push(`${g.foragers} forage`);
    if (g.builders) roles.push(`${g.builders} build`);
    if (roles.length) parts.push(roles.join('/'));
    const art = [];
    if (g.tools) art.push(`${g.tools} tool`);
    if (g.weapons) art.push(`${g.weapons} weapon`);
    if (g.barriers) art.push(`${g.barriers} barrier`);
    if (art.length) parts.push(art.join('/'));
    if (g.allies) parts.push(`${g.allies} allied`);
    if (g.conflicts) parts.push(`${g.conflicts} at war`);
    const origin = g.declared ? 'declared' : 'detected';
    lines.push(`<div>· <strong>${g.name}</strong> (${origin}) — ${parts.join(', ')}`
      + ` · stability ${(g.stability ?? 1).toFixed(2)}`
      + ` · policy agg ${(g.policy?.aggression ?? 0).toFixed(2)}/open ${(g.policy?.openness ?? 0).toFixed(2)}/mig ${(g.policy?.migration ?? 0).toFixed(2)}</div>`);
  }
  return lines;
}

/** Flatten group records into the shape both the canvases and the log use. */
export function summariseGroups(registry) {
  const groups = registry && registry.groups ? [...registry.groups.values()] : [];
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    declared: g.declared,
    members: g.members.size,
    treasury: g.treasury || 0,
    species: g.species ? g.species.size : 0,
    leaders: g.roles ? g.roles.leader : 0,
    foragers: g.roles ? g.roles.forager : 0,
    builders: g.roles ? g.roles.builder : 0,
    tools: g.artifacts ? (g.artifacts.TOOL || 0) : 0,
    weapons: g.artifacts ? (g.artifacts.WEAPON || 0) : 0,
    barriers: g.artifacts ? (g.artifacts.BARRIER || 0) : 0,
    allies: g.allies ? g.allies.size : 0,
    conflicts: g.conflicts ? g.conflicts.size : 0,
    stability: g.stability,
    policy: g.policy || { aggression: 0, openness: 0, migration: 0 },
    cx: g.cx, cy: g.cy, cz: g.cz,
    minX: g.minX, minY: g.minY, minZ: g.minZ,
    maxX: g.maxX, maxY: g.maxY, maxZ: g.maxZ,
  }));
}

function drawAll(ctx, registry) {
  host = ctx.host;
  setVal = ctx.setVal;
  const summaries = summariseGroups(registry);

  let totalMembers = 0;
  let totalTreasury = 0;
  let totalLeaders = 0;
  let totalArtifacts = 0;
  let totalAllies = 0;
  let totalConflicts = 0;
  for (const g of summaries) {
    totalMembers += g.members;
    totalTreasury += g.treasury;
    totalLeaders += g.leaders;
    totalArtifacts += g.tools + g.weapons + g.barriers;
    totalAllies += g.allies;
    totalConflicts += g.conflicts;
  }
  let volume = 0;
  for (const t of (registry.tradeLog || [])) volume += t.amount;

  setVal('ga-groups', summaries.length);
  setVal('ga-members', totalMembers);
  setVal('ga-treasury', Math.round(totalTreasury));
  setVal('ga-volume', Math.round(volume * 10) / 10);
  setVal('ga-leaders', totalLeaders);
  setVal('ga-artifacts', totalArtifacts);
  // Alliances and conflicts are counted from both directions, so halve to show
  // distinct pairs rather than edges.
  setVal('ga-alliances', Math.round(totalAllies / 2));
  setVal('ga-conflicts', Math.round(totalConflicts / 2));

  drawOverlay(summaries);
  drawNetwork(summaries, registry.tradeLog || []);
  drawSankey(summaries, registry.tradeLog || []);

  const log = host.querySelector('#ga-detail');
  if (!log) return;
  const lines = formatGroupLines(summaries);
  log.innerHTML = lines.length ? lines.join('') : '<div>no groups detected yet</div>';
}

/** World → canvas projection helper shared by overlay + network. */
function projector(summaries) {
  const xs = summaries.flatMap((g) => [g.cx, g.minX, g.maxX]);
  const zs = summaries.flatMap((g) => [g.cz, g.minZ, g.maxZ]);
  if (xs.length === 0) return null;
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const pad = 18;
  const scale = Math.min((CANVAS_W - pad * 2) / spanX, (CANVAS_H - pad * 2) / spanZ);
  const ox = (CANVAS_W - spanX * scale) / 2;
  const oy = (CANVAS_H - spanZ * scale) / 2;
  return (x, z) => [ox + (x - minX) * scale, oy + (z - minZ) * scale];
}

function drawOverlay(summaries) {
  const cv = host.querySelector('#ga-overlay');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  if (summaries.length === 0) { emptyText(ctx, 'no groups yet — form under laws'); return; }
  const proj = projector(summaries);

  for (const g of summaries) {
    const [x0, y0] = proj(g.minX, g.minZ);
    const [x1, y1] = proj(g.maxX, g.maxZ);
    ctx.strokeStyle = groupColor(g.id);
    ctx.fillStyle = groupColor(g.id);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.globalAlpha = 1;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    const [px, py] = proj(g.cx, g.cz);
    ctx.beginPath();
    ctx.arc(px, py, Math.max(3, Math.sqrt(g.members) * 1.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '9px monospace';
    ctx.fillText(g.name, px + 6, py - 4);
  }
}

function drawNetwork(summaries, tradeLog) {
  const cv = host.querySelector('#ga-network');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  if (summaries.length === 0) { emptyText(ctx, 'network graph'); return; }
  const proj = projector(summaries);

  // Edges: groups that appear together in a trade.
  const traded = new Set();
  for (const t of tradeLog) {
    traded.add(`${Math.min(t.from, t.to)}-${Math.max(t.from, t.to)}`);
  }
  ctx.globalAlpha = 0.4;
  for (const pair of traded) {
    const [a, b] = pair.split('-').map(Number);
    const ga = summaries.find((g) => g.id === a);
    const gb = summaries.find((g) => g.id === b);
    if (!ga || !gb) continue;
    ctx.strokeStyle = '#8ab4ff';
    ctx.beginPath();
    ctx.moveTo(...proj(ga.cx, ga.cz));
    ctx.lineTo(...proj(gb.cx, gb.cz));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (const g of summaries) {
    const [px, py] = proj(g.cx, g.cz);
    ctx.beginPath();
    ctx.arc(px, py, Math.max(4, Math.sqrt(g.members) * 1.8), 0, Math.PI * 2);
    ctx.fillStyle = groupColor(g.id);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#cfe3ff';
    ctx.font = '9px monospace';
    ctx.fillText(g.name, px + 7, py + 3);
  }
}

function drawSankey(summaries, tradeLog) {
  const cv = host.querySelector('#ga-sankey');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  if (summaries.length === 0) { emptyText(ctx, 'economy sankey — treasury per group'); return; }

  const maxT = Math.max(1, ...summaries.map((g) => g.treasury));
  const barW = (g) => Math.max(2, (g.treasury / maxT) * 60);
  const y = (i) => 12 + i * (CANVAS_H - 24) / Math.max(1, summaries.length);

  for (let i = 0; i < summaries.length; i++) {
    const g = summaries[i];
    const yy = y(i);
    ctx.fillStyle = groupColor(g.id);
    ctx.fillRect(14, yy, barW(g), 10);
    ctx.fillStyle = '#cfe3ff';
    ctx.font = '9px monospace';
    ctx.fillText(`${g.name} ${Math.round(g.treasury)}`, 80, yy + 9);
  }

  // Trade flows: arrows from payer → payee, width ∝ volume.
  const flows = new Map();
  for (const t of tradeLog) {
    const key = `${t.from}-${t.to}`;
    flows.set(key, (flows.get(key) || 0) + t.amount);
  }
  const maxFlow = Math.max(1, ...flows.values());
  for (const [key, amount] of flows) {
    const [fromId, toId] = key.split('-').map(Number);
    const fi = summaries.findIndex((g) => g.id === fromId);
    const ti = summaries.findIndex((g) => g.id === toId);
    if (fi === -1 || ti === -1) continue;
    const x0 = 80 + barW(summaries[fi]);
    const x1 = 14 + barW(summaries[ti]) + 2;
    const y0 = y(fi) + 5;
    const y1 = y(ti) + 5;
    const w = Math.max(1, (amount / maxFlow) * 6);
    ctx.strokeStyle = 'rgba(138,180,255,0.55)';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(Math.max(x0, x1), y1);
    ctx.stroke();
  }
}

function emptyText(ctx, text) {
  ctx.fillStyle = 'rgba(140,160,200,0.6)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
  ctx.textAlign = 'start';
}
