/**
 * VEPA4 — Ecosystem Analytics Panel (Set A.2 "Living World", RRP E·F·A trilogy)
 *
 * DATA > 🌿 ECO: the living-world dashboard. Population curves, biodiversity
 * (Shannon) + oscillation detection, a food-web graph (prey → predator), the
 * niche table (centroid / radius / population), and the A.1 speciation feed
 * (burst markers + EXTINCT history). Pure canvas + a few DOM cells, redrawn
 * at ~2 Hz from the 'eco:analytics' bus event.
 */

import { biodiversity, oscillationScore } from '../engines/ecoEngine.js';

const CURVE_W = 340;
const CURVE_H = 140;
const WEB_W = 340;
const WEB_H = 140;
let host = null;
let lastDraw = 0;

function speciesColor(sp) {
  return `hsl(${(sp * 53 + 20) % 360}, 70%, 60%)`;
}

export function createEcoPanel(bus) {
  const target = document.getElementById('eco-dashboard');
  if (!target) return;
  host = target;

  host.innerHTML = `
    <div class="intel-header">ECOSYSTEM</div>
    <div class="intel-grid">
      <div class="intel-cell"><span class="intel-label">SPECIES</span><span id="eco-species" class="intel-value">0</span></div>
      <div class="intel-cell"><span class="intel-label">BIODIVERSITY</span><span id="eco-bio" class="intel-value">0.00</span></div>
      <div class="intel-cell"><span class="intel-label">OSCILLATION</span><span id="eco-osc" class="intel-value">—</span></div>
      <div class="intel-cell"><span class="intel-label">POPULATION</span><span id="eco-pop" class="intel-value">0</span></div>
    </div>
    <canvas id="eco-curves" class="ga-canvas" width="${CURVE_W}" height="${CURVE_H}"></canvas>
    <canvas id="eco-web" class="ga-canvas" width="${WEB_W}" height="${WEB_H}"></canvas>
    <div id="eco-niches" class="intel-log"></div>
    <div id="eco-feed" class="intel-log"></div>
  `;

  bus.on('eco:analytics', ({ eco }) => {
    const now = performance.now();
    if (now - lastDraw < 500) return; // ~2 Hz
    lastDraw = now;
    drawAll(eco);
  });
}

function drawAll(eco) {
  const last = eco.ring[eco.ring.length - 1];
  const pop = last ? last.total : 0;
  const shannon = biodiversity(eco);
  const osc = oscillationScore(eco);

  setVal('eco-species', last ? last.speciesAlive : 0);
  setVal('eco-pop', pop);
  setVal('eco-bio', shannon.toFixed(2));
  setVal('eco-osc', osc < 0.02 ? 'STABLE' : osc < 0.1 ? 'MILD' : 'WILD');

  drawCurves(eco);
  drawFoodWeb(eco);
  drawNicheList(eco);
  drawFeed(eco);
}

function setVal(id, text) {
  const el = host && host.querySelector('#' + id);
  if (el) el.textContent = String(text);
}

/** Per-species population curves across the ring window. */
function drawCurves(eco) {
  const cv = host.querySelector('#eco-curves');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, CURVE_W, CURVE_H);
  const ring = eco.ring;
  if (ring.length < 2) { emptyText(ctx, 'population curves — warm-up'); return; }

  // Collect every species that ever appeared in the window.
  const speciesIds = new Set();
  for (const r of ring) for (const sp of Object.keys(r.species)) speciesIds.add(Number(sp));
  const maxPop = Math.max(4, ...ring.map((r) => r.total));

  for (const sp of speciesIds) {
    ctx.strokeStyle = speciesColor(sp);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < ring.length; i++) {
      const s = ring[i].species[sp];
      const v = s ? s.pop : 0;
      const x = 8 + (i / (ring.length - 1)) * (CURVE_W - 16);
      const y = CURVE_H - 8 - (v / maxPop) * (CURVE_H - 20);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Species label at the latest point.
    const lastV = ring[ring.length - 1].species[sp];
    if (lastV) {
      ctx.fillStyle = speciesColor(sp);
      ctx.font = '9px monospace';
      const lx = 8 + (ring.length - 1) / Math.max(1, ring.length - 1) * (CURVE_W - 16);
      ctx.fillText(`S${sp}`, lx + 4, CURVE_H - 8 - (lastV.pop / maxPop) * (CURVE_H - 20));
    }
  }
}

/** Food-web graph: nodes = species, arrows prey → predator. */
function drawFoodWeb(eco) {
  const cv = host.querySelector('#eco-web');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, WEB_W, WEB_H);
  const web = [...eco.foodWeb.values()];
  if (web.length === 0) { emptyText(ctx, 'food-web — predation edges'); return; }

  const nodePos = new Map();
  const ids = new Set();
  for (const e of web) { ids.add(e.prey); ids.add(e.predator); }
  const list = [...ids];
  list.forEach((sp, i) => {
    nodePos.set(sp, [30 + (i / Math.max(1, list.length - 1)) * (WEB_W - 60), WEB_H / 2 + (i % 2 ? 26 : -26)]);
  });

  for (const e of web) {
    const [x0, y0] = nodePos.get(e.prey);
    const [x1, y1] = nodePos.get(e.predator);
    ctx.strokeStyle = `rgba(255,120,90,${0.2 + e.strength * 0.6})`;
    ctx.lineWidth = 1 + e.strength * 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    // Arrowhead.
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 7 * Math.cos(ang - 0.4), y1 - 7 * Math.sin(ang - 0.4));
    ctx.lineTo(x1 - 7 * Math.cos(ang + 0.4), y1 - 7 * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fill();
  }
  for (const [sp, [x, y]] of nodePos) {
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = speciesColor(sp);
    ctx.fill();
    ctx.fillStyle = '#061016';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(sp), x, y + 3);
    ctx.textAlign = 'start';
  }
}

function drawNicheList(eco) {
  const el = host.querySelector('#eco-niches');
  const lines = [];
  for (const [sp, n] of eco.niches) {
    lines.push(
      `S${sp}  pop ${n.pop}  @ (${Math.round(n.cx)}, ${Math.round(n.cy)}, ${Math.round(n.cz)})  r ${Math.round(n.radius)}`,
    );
  }
  el.textContent = lines.length ? lines.join('\n') : 'no live niches yet';
}

function drawFeed(eco) {
  const el = host.querySelector('#eco-feed');
  const lines = [];
  for (const e of eco.splits.slice(-4)) {
    lines.push(`✦ S${e.parent} → S${e.child} split (iso ${e.isolation.toFixed(2)})`);
  }
  for (const e of eco.extinct.slice(-4)) {
    lines.push(`✖ S${e.species} extinct — slot freed`);
  }
  el.textContent = lines.length ? lines.join('\n') : 'speciation feed';
}

function emptyText(ctx, text) {
  ctx.fillStyle = 'rgba(140,160,200,0.6)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, (ctx.canvas.width || CURVE_W) / 2, (ctx.canvas.height || CURVE_H) / 2);
  ctx.textAlign = 'start';
}
