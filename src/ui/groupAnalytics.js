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

const CANVAS_W = 340;
const CANVAS_H = 150;
let host = null;
let lastDraw = 0;

function groupColor(id) {
  return `hsl(${(id * 47) % 360}, 75%, 62%)`;
}

/**
 * Create the civilizations dashboard inside #groups-dashboard.
 */
export function createGroupAnalytics(bus) {
  const target = document.getElementById('groups-dashboard');
  if (!target) return;
  host = target;

  host.innerHTML = `
    <div class="intel-header">CIVILIZATIONS</div>
    <div class="intel-grid">
      <div class="intel-cell"><span class="intel-label">GROUPS</span><span id="ga-groups" class="intel-value">0</span></div>
      <div class="intel-cell"><span class="intel-label">MEMBERS</span><span id="ga-members" class="intel-value">0</span></div>
      <div class="intel-cell"><span class="intel-label">TREASURY</span><span id="ga-treasury" class="intel-value">0</span></div>
      <div class="intel-cell"><span class="intel-label">TRADE VOLUME</span><span id="ga-volume" class="intel-value">0</span></div>
    </div>
    <canvas id="ga-overlay" class="ga-canvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
    <canvas id="ga-network" class="ga-canvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
    <canvas id="ga-sankey" class="ga-canvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
  `;

  bus.on('groups:analytics', ({ registry }) => {
    const now = performance.now();
    if (now - lastDraw < 500) return; // ~2 Hz
    lastDraw = now;
    drawAll(registry);
  });
}

function drawAll(registry) {
  const groups = [...registry.groups.values()];
  const summaries = groups.map((g) => ({
    id: g.id,
    name: g.name,
    declared: g.declared,
    members: g.members.size,
    treasury: g.treasury || 0,
    species: g.species ? g.species.size : 0,
    cx: g.cx, cy: g.cy, cz: g.cz,
    minX: g.minX, minY: g.minY, minZ: g.minZ,
    maxX: g.maxX, maxY: g.maxY, maxZ: g.maxZ,
  }));

  let totalMembers = 0;
  let totalTreasury = 0;
  let volume = 0;
  for (const g of summaries) { totalMembers += g.members; totalTreasury += g.treasury; }
  for (const t of registry.tradeLog || []) volume += t.amount;

  setVal('ga-groups', summaries.length);
  setVal('ga-members', totalMembers);
  setVal('ga-treasury', Math.round(totalTreasury));
  setVal('ga-volume', Math.round(volume * 10) / 10);

  drawOverlay(summaries);
  drawNetwork(summaries, registry.tradeLog || []);
  drawSankey(summaries, registry.tradeLog || []);
}

function setVal(id, text) {
  const el = host && host.querySelector('#' + id);
  if (el) el.textContent = String(text);
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
