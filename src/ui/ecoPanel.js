/**
 * VEPA4 — Ecosystem Analytics Panel (Set A.2 "Living World", RRP E·F·A trilogy)
 *
 * DATA > 🌿 ECO: the living-world dashboard. Population curves, biodiversity
 * (Shannon) + oscillation detection, a food-web graph (prey → predator), the
 * niche table (centroid / radius / population), the A.1 speciation feed
 * (burst markers + EXTINCT history), and — new in v9.1.29 — a species
 * leaderboard, because the summary cells answer "is the world balanced" and not
 * "who is winning". Pure canvas + a few DOM cells, redrawn at ~2 Hz from the
 * 'eco:analytics' bus event.
 *
 * The leaderboard rows are the drawer's selection surface: tapping a species
 * selects it in the shared context (`src/state/selection.js`), and every other
 * DATA panel honours that choice.
 */

import { biodiversity, oscillationScore } from '../engines/ecoEngine.js';
import { mountAnalyticsPanel } from './analyticsPanel.js';
import { escapeHtml as esc } from './html.js';

const CURVE_W = 340;
const CURVE_H = 140;
const WEB_W = 340;
const WEB_H = 140;

/** How many species the leaderboard shows. Eight fits the drawer without scrolling. */
export const LEADERBOARD_ROWS = 8;

/** Characters used for a leaderboard sparkline; the width of the cell. */
const SPARK_CHARS = 12;

let host = null;
let setVal = () => {};
let selection = null;

function speciesColor(sp) {
  return `hsl(${(sp * 53 + 20) % 360}, 70%, 60%)`;
}

export function createEcoPanel(bus, selectionContext = null) {
  selection = selectionContext;
  const ctx = mountAnalyticsPanel(bus, {
    mountId: 'eco-dashboard',
    title: 'ECOSYSTEM',
    cells: [
      { id: 'eco-species', label: 'SPECIES' },
      { id: 'eco-bio', label: 'BIODIVERSITY', value: '0.00' },
      { id: 'eco-osc', label: 'OSCILLATION', value: '—' },
      { id: 'eco-pop', label: 'POPULATION' },
      { id: 'eco-peak', label: 'PEAK POP' },
      { id: 'eco-extinct', label: 'EXTINCTIONS' },
      { id: 'eco-predators', label: 'PREDATOR EDGES' },
      { id: 'eco-splits', label: 'SPLITS' },
    ],
    canvases: [
      { id: 'eco-curves', w: CURVE_W, h: CURVE_H },
      { id: 'eco-web', w: WEB_W, h: WEB_H },
    ],
    logs: ['eco-niches', 'eco-feed'],
    subscribe: (b, deliver) => b.on('eco:analytics', ({ eco }) => deliver(eco)),
    draw: (c, eco) => drawAll(c, eco),
  });
  if (!ctx) return;
  host = ctx.host;
  setVal = ctx.setVal;

  // The shell replaced the panel's markup, so the leaderboard is appended
  // after it rather than passed through the shell's `logs` option — it is a
  // list of tappable rows, not a text region.
  const board = document.createElement('div');
  board.id = 'eco-leaderboard';
  board.className = 'intel-log eco-leaderboard';
  host.appendChild(board);
}

/**
 * Peak population over the retained ring window, plus how much of the window
 * is actually retained — so a high "peak" cannot be mistaken for a lifetime
 * high on a world that just booted.
 */
export function peakPopulation(eco) {
  if (!eco || !eco.ring || !eco.ring.length) return { peak: 0, samples: 0 };
  let peak = 0;
  for (const r of eco.ring) if (r.total > peak) peak = r.total;
  return { peak, samples: eco.ring.length };
}

/**
 * The species leaderboard, richest first.
 *
 * Pure and exported so the ordering and the sparkline can be tested without a
 * DOM — the same reasoning that kept `peakPopulation` and the group
 * formatters exportable when the panels' draw bodies were never called.
 *
 * @param {object} eco the eco engine payload
 * @param {number} [limit] how many species to return
 * @returns {{id: number, pop: number, share: number, trend: number[], spark: string}[]}
 */
export function speciesLeaderboard(eco, limit = LEADERBOARD_ROWS) {
  const ring = (eco && eco.ring) || [];
  const last = ring[ring.length - 1];
  if (!last) return [];
  const total = Object.values(last.species || {}).reduce((sum, s) => sum + (s.pop || 0), 0) || 1;

  const rows = Object.entries(last.species || {})
    .map(([sp, s]) => {
      const trend = ring.map((r) => (r.species[sp] ? r.species[sp].pop : 0));
      return {
        id: Number(sp),
        pop: s.pop || 0,
        share: (s.pop || 0) / total,
        trend,
      };
    })
    .sort((a, b) => b.pop - a.pop || a.id - b.id)
    .slice(0, limit);

  // One shared scale for the whole board. Scaling each species against its own
  // maximum makes a species stuck at three particles look identical to the
  // dominant one, which is precisely the comparison the leaderboard exists for.
  const scale = Math.max(1, ...rows.flatMap((r) => r.trend));
  for (const row of rows) row.spark = sparkline(row.trend, SPARK_CHARS, scale);
  return rows;
}

/**
 * Eight-level block sparkline: '▁' low → '█' high.
 *
 * @param {number[]} values
 * @param {number} [chars] width, taking the most recent values
 * @param {number} [scaleMax] the value that reads as full height; defaults to
 *   the series' own maximum
 */
export function sparkline(values, chars = SPARK_CHARS, scaleMax = null) {
  if (!values.length) return '';
  const recent = values.slice(-chars);
  const max = scaleMax === null ? Math.max(1, ...recent) : Math.max(1, scaleMax);
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  // Floor, not round: a species sitting at a tenth of the board maximum should
  // read as the bottom block, not the second one up.
  return recent
    .map((v) => blocks[Math.min(blocks.length - 1, Math.floor((v / max) * (blocks.length - 1)))])
    .join('');
}

function drawAll(ctx, eco) {
  host = ctx.host;
  setVal = ctx.setVal;
  const last = eco.ring[eco.ring.length - 1];
  const pop = last ? last.total : 0;
  const shannon = biodiversity(eco);
  const osc = oscillationScore(eco);
  const { peak } = peakPopulation(eco);

  setVal('eco-species', last ? last.speciesAlive : 0);
  setVal('eco-pop', pop);
  setVal('eco-bio', shannon.toFixed(2));
  setVal('eco-osc', osc < 0.02 ? 'STABLE' : osc < 0.1 ? 'MILD' : 'WILD');
  setVal('eco-peak', peak);
  setVal('eco-extinct', eco.extinct ? eco.extinct.length : 0);
  setVal('eco-predators', eco.foodWeb ? eco.foodWeb.size : 0);
  setVal('eco-splits', eco.splits ? eco.splits.length : 0);

  drawLeaderboard(eco);
  drawCurves(eco);
  drawFoodWeb(eco);
  drawNicheList(eco);
  drawFeed(eco);
}

/**
 * The leaderboard rows. Rebuilt through the DOM (not innerHTML) because each
 * row is a tap target bound to the shared selection.
 */
function drawLeaderboard(eco) {
  const el = host.querySelector('#eco-leaderboard');
  if (!el) return;
  const rows = speciesLeaderboard(eco);
  if (!rows.length) {
    el.innerHTML = '<div class="eco-board-head">LEADERBOARD — no live species yet</div>';
    return;
  }

  let html = '<div class="eco-board-head">LEADERBOARD — tap a species to focus every DATA panel</div>';
  for (const row of rows) {
    const focused = selection && selection.matches('species', row.id);
    const pct = (row.share * 100).toFixed(1);
    html += `<button class="eco-board-row${focused ? ' selected' : ''}" data-species="${row.id}"`
      + ` style="border-left-color:${speciesColor(row.id)}" aria-pressed="${focused ? 'true' : 'false'}">`
      + `<span class="eco-board-name">S${row.id}</span>`
      + `<span class="eco-board-spark">${esc(row.spark)}</span>`
      + `<span class="eco-board-pop">${row.pop}</span>`
      + `<span class="eco-board-share">${pct}%</span></button>`;
  }
  el.innerHTML = html;

  if (!selection) return;
  for (const btn of el.querySelectorAll('.eco-board-row')) {
    const id = Number(btn.dataset.species);
    btn.addEventListener('click', () => {
      // Tapping the selected species clears it, so a second tap is a way out.
      if (selection.matches('species', id)) selection.clear();
      else selection.select({ species: id });
    });
  }
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

/**
 * The speciation + extinction feed.
 *
 * Extinctions now carry their tick, because "species 3 is gone" is a different
 * statement from "species 3 was gone 400 ticks ago and the slot is still
 * empty" — and only one of them tells you whether the world is recovering.
 */
function drawFeed(eco) {
  const el = host.querySelector('#eco-feed');
  const lines = [];
  for (const e of eco.splits.slice(-4)) {
    lines.push(`✦ S${e.parent} → S${e.child} split (iso ${e.isolation.toFixed(2)})`);
  }
  for (const e of eco.extinct.slice(-4)) {
    const at = Number.isFinite(e.tick) ? ` tick ${e.tick}` : '';
    lines.push(`✖ S${e.species} extinct — slot freed${at}`);
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
