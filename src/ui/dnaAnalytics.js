/**
 * VEPA v3 — DNA Analytics Panel (DNA tab)
 * Full chart suite: population trends (line), state scatter, diversity trend,
 * histograms, species breakdown, trait profiles, genetic diversity metrics.
 */
import { PARTICLE_STRIDE, STRIDE_INDEXES, WORLD_SIZE } from '../constants.js';

const SPECIES_COLORS = ['#ff5050', '#ffc832', '#50ff78', '#78a0ff', '#643c8c'];
const SPECIES_NAMES = ['Predator', 'Sol', 'Life', 'Aether', 'Void'];

let particleBuffer = null;
let particleCount = 0;
let speciesCount = 5;

// Rolling history for trend charts
const POP_HISTORY_LEN = 120;
const popHistory = []; // array of arrays: [timestep][speciesCount]
const divHistory = []; // diversity over time
const NRG_HISTORY_LEN = 60;
const nrgHistory = [];
const massHistory = [];

let tickAccum = 0;
let chartUpdateCounter = 0;

export function createDNAAnalytics(bus) {
  const container = document.getElementById('dna-analytics');
  if (!container) return;
  setupDNAInteractions();

  bus.on('physics:tick', ({ buffer, particleCount: pc, speciesCount: sc }) => {
    // Skip collection entirely when the DNA tab is hidden — this loop runs
    // every frame and was allocating full-buffer copies + canvas renders
    // even while the user was on another tab.
    const dataTab = document.getElementById('tab-data');
    const dnaSub = document.getElementById('data-dna');
    const visible = dataTab && dataTab.classList.contains('active')
      && dnaSub && dnaSub.classList.contains('active');
    if (!visible) {
      tickAccum = 0;
      return;
    }
    particleBuffer = buffer;
    particleCount = pc;
    if (sc !== undefined) speciesCount = sc;
    tickAccum++;
    chartUpdateCounter++;
    if (tickAccum >= 5) {
      collectAndRenderAll();
      tickAccum = 0;
    }
  });
}

function collectAndRenderAll() {
  if (!particleBuffer || !particleCount) return;
  const container = document.getElementById('dna-analytics');
  if (!container) return;

  const STRIDE = PARTICLE_STRIDE;
  const view = new Float32Array(particleBuffer);

  const sc = Math.min(speciesCount || 5, 5);
  const speciesCounts = new Array(sc).fill(0);
  const speciesEnergy = new Array(sc).fill(0);
  const speciesMass = new Array(sc).fill(0);
  const speciesAge = new Array(sc).fill(0);
  const speciesVel = new Array(sc).fill(0);
  const speciesTraitSum = new Array(sc).fill(null).map(() => new Array(6).fill(0));
  const speciesTraitCount = new Array(sc).fill(0);
  const massBuckets = new Array(20).fill(0);
  const energyBuckets = new Array(20).fill(0);
  const ageBuckets = new Array(20).fill(0);
  const velBuckets = new Array(20).fill(0);
  const keyTraits = [0, 1, 10, 11, 12, 4]; // Force, Viscosity, Birth, Death, Mutation, Polarity
  const massNrgPairs = [];

  let totalAlive = 0, totalMass = 0, totalEnergy = 0, totalVel = 0;
  let bondedCount = 0, maxBondCount = 0, maxMass = 0;
  let totalCharge = 0, totalSignal = 0, totalArmor = 0;
  let chainCount = 0;

  for (let i = 0; i < particleCount; i++) {
    const ptr = i * STRIDE;
    if (view[ptr + STRIDE_INDEXES.DEAD] >= 0.99) continue;
    totalAlive++;
    const sIdx = Math.floor(view[ptr + STRIDE_INDEXES.SPECIES_ID]);

    const mass = view[ptr + STRIDE_INDEXES.MASS] || 1;
    const energy = view[ptr + STRIDE_INDEXES.ENERGY] || 0;
    const age = view[ptr + STRIDE_INDEXES.AGE] || 0;
    const vx = view[ptr + STRIDE_INDEXES.VEL_X] || 0;
    const vy = view[ptr + STRIDE_INDEXES.VEL_Y] || 0;
    const vz = view[ptr + STRIDE_INDEXES.VEL_Z] || 0;
    const vel = Math.sqrt(vx*vx + vy*vy + vz*vz);
    const bondCount = view[ptr + STRIDE_INDEXES.BOND_COUNT] || 0;
    const chainLen = view[ptr + STRIDE_INDEXES.CHAIN_LENGTH] || 0;
    const charge = view[ptr + STRIDE_INDEXES.CHARGE] || 0;
    const signal = view[ptr + STRIDE_INDEXES.SIGNAL] || 0;
    const armor = view[ptr + STRIDE_INDEXES.ARMOR] || 0;

    totalMass += mass;
    totalEnergy += energy;
    totalVel += vel;
    totalCharge += charge;
    totalSignal += signal;
    totalArmor += armor;
    if (mass > maxMass) maxMass = mass;
    if (bondCount > 0) bondedCount++;
    if (bondCount > maxBondCount) maxBondCount = bondCount;
    if (chainLen > 0) chainCount++;

    if (sIdx >= 0 && sIdx < sc) {
      speciesCounts[sIdx]++;
      speciesEnergy[sIdx] += energy;
      speciesMass[sIdx] += mass;
      speciesAge[sIdx] += age;
      speciesVel[sIdx] += vel;
      speciesTraitCount[sIdx]++;
      for (let t = 0; t < keyTraits.length; t++) {
        speciesTraitSum[sIdx][t] += view[ptr + STRIDE_INDEXES.DNA_CACHE_START + keyTraits[t]] || 0;
      }
    }

    massBuckets[Math.min(19, Math.floor((mass / Math.max(maxMass, 10)) * 19))]++;
    energyBuckets[Math.min(19, Math.floor((energy / 200) * 19))]++;
    ageBuckets[Math.min(19, Math.floor((age / 10000) * 19))]++;
    velBuckets[Math.min(19, Math.floor((vel / 30) * 19))]++;

    if (i % 8 === 0) {
      massNrgPairs.push({ mass, nrg: energy, sid: sIdx >= 0 && sIdx < sc ? sIdx : 0 });
    }
  }

  if (totalAlive === 0) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#444;">No alive particles</div>';
    return;
  }

  const avgMass = (totalMass / totalAlive).toFixed(2);
  const avgEnergy = (totalEnergy / totalAlive).toFixed(1);
  const avgVel = (totalVel / totalAlive).toFixed(2);
  const avgCharge = (totalCharge / totalAlive).toFixed(2);
  const avgSignal = (totalSignal / totalAlive).toFixed(2);
  const avgArmor = (totalArmor / totalAlive).toFixed(2);

  // Update rolling history
  popHistory.push(speciesCounts.slice());
  if (popHistory.length > POP_HISTORY_LEN) popHistory.shift();

  // Diversity metric
  let totalVariance = 0;
  let sampleCountDiv = 0;
  const traitSamples = [0, 4, 10, 12, 15];
  for (const traitIdx of traitSamples) {
    let sum = 0, sumSq = 0, n = 0;
    for (let i = 0; i < Math.min(particleCount, 500); i++) {
      const ptr = i * STRIDE;
      if (view[ptr + STRIDE_INDEXES.DEAD] >= 0.99) continue;
      const val = view[ptr + STRIDE_INDEXES.DNA_CACHE_START + traitIdx] || 0;
      sum += val; sumSq += val * val; n++;
    }
    if (n > 1) { totalVariance += (sumSq / n) - (sum / n) * (sum / n); sampleCountDiv++; }
  }
  const divLevel = sampleCountDiv > 0 ? Math.min(1, (totalVariance / sampleCountDiv) * 50) : 0;
  divHistory.push(divLevel);
  if (divHistory.length > POP_HISTORY_LEN) divHistory.shift();

  nrgHistory.push(totalEnergy / totalAlive);
  if (nrgHistory.length > NRG_HISTORY_LEN) nrgHistory.shift();
  massHistory.push(totalMass / totalAlive);
  if (massHistory.length > NRG_HISTORY_LEN) massHistory.shift();

  // === BUILD HTML ===
  let html = '';

  // Overview Stats Banner
  html += '<div class="dna-overview-grid">'
    + overviewStat('POP', totalAlive, '#0f0', 'population')
    + overviewStat('MASS', avgMass, '#ff4', 'mass')
    + overviewStat('NRG', avgEnergy, '#f44', 'energy')
    + overviewStat('VEL', avgVel, '#4ff', 'velocity')
    + overviewStat('BOND', bondedCount, '#f4f', 'bonds')
    + overviewStat('CHAIN', chainCount, '#ff4', 'chains')
    + overviewStat('CHARGE', avgCharge, '#4ff', 'charge')
    + overviewStat('SIG', avgSignal, '#0ff', 'signal')
    + overviewStat('ARMOR', avgArmor, '#fa4', 'armor')
    + '<div class="dna-overview-hint">TAP A STAT FOR HISTORY</div>'
    + '</div>';

  // Species Breakdown
  html += '<div class="dna-section-title">SPECIES BREAKDOWN</div>';
  const names = SPECIES_NAMES;
  const colors = SPECIES_COLORS;
  for (let s = 0; s < sc; s++) {
    const pct = ((speciesCounts[s] / totalAlive) * 100).toFixed(1);
    const sM = speciesTraitCount[s] > 0 ? (speciesMass[s] / speciesTraitCount[s]).toFixed(2) : '-';
    const sE = speciesTraitCount[s] > 0 ? (speciesEnergy[s] / speciesTraitCount[s]).toFixed(1) : '-';
    const sA = speciesTraitCount[s] > 0 ? (speciesAge[s] / speciesTraitCount[s]).toFixed(0) : '-';
    const sV = speciesTraitCount[s] > 0 ? (speciesVel[s] / speciesTraitCount[s]).toFixed(2) : '-';
    html += '<div class="dna-stat-row">'
      + '<div class="dna-stat-label"><span style="color:' + colors[s] + '">■</span> ' + names[s] + '</div>'
      + '<div class="dna-stat-bar-bg"><div class="dna-stat-bar" style="width:' + pct + '%;background:' + colors[s] + '"></div></div>'
      + '<div class="dna-stat-val">' + speciesCounts[s] + ' (' + pct + '%)</div></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:1px;font-size:6px;color:#888;padding:0 0 4px 20px;">'
      + '<div>M:' + sM + '</div><div>E:' + sE + '</div><div>A:' + sA + '</div><div>V:' + sV + '</div></div>';
  }

  // Species Trait Profiles
  html += '<div class="dna-section-title" style="margin-top:14px;">TRAIT PROFILES</div>';
  const traitNames = ['Force', 'Viscosity', 'Birth Rate', 'Death Rate', 'Mutation', 'Polarity'];
  for (let s = 0; s < sc; s++) {
    if (speciesTraitCount[s] > 0) {
      html += '<div style="margin:3px 0;font-size:7px;color:' + colors[s] + ';">' + names[s] + '</div>';
      for (let t = 0; t < keyTraits.length; t++) {
        const avg = (speciesTraitSum[s][t] / speciesTraitCount[s]).toFixed(3);
        const barW = Math.min(100, Math.abs(parseFloat(avg)) * 50);
        const barColor = parseFloat(avg) >= 0 ? '#4f4' : '#f44';
        html += '<div class="dna-stat-row" style="font-size:6px;">'
          + '<div class="dna-stat-label">' + traitNames[t] + '</div>'
          + '<div class="dna-stat-bar-bg"><div class="dna-stat-bar" style="width:' + barW + '%;background:' + barColor + ';opacity:0.6;"></div></div>'
          + '<div class="dna-stat-val">' + avg + '</div></div>';
      }
    }
  }

  // Genetic Distance Matrix
  html += '<div class="dna-section-title" style="margin-top:14px;">GENETIC DISTANCE</div>';
  html += '<div style="font-size:6px;font-family:monospace;line-height:10px;">';
  html += '<div style="display:grid;grid-template-columns:repeat(' + (sc + 1) + ',auto);gap:1px;">';
  html += '<div></div>';
  for (let s = 0; s < sc; s++) html += '<div style="color:' + colors[s] + ';">' + names[s].substring(0,3) + '</div>';
  for (let a = 0; a < sc; a++) {
    html += '<div style="color:' + colors[a] + ';">' + names[a].substring(0,3) + '</div>';
    for (let b = 0; b < sc; b++) {
      if (a === b) { html += '<div style="color:#333;">0</div>'; continue; }
      let dist = 0, count = 0;
      for (let t = 0; t < keyTraits.length; t++) {
        const va = speciesTraitCount[a] > 0 ? speciesTraitSum[a][t] / speciesTraitCount[a] : 0;
        const vb = speciesTraitCount[b] > 0 ? speciesTraitSum[b][t] / speciesTraitCount[b] : 0;
        dist += Math.abs(va - vb);
        count++;
      }
      const d = count > 0 ? (dist / count * 10).toFixed(1) : '?';
      const intensity = Math.min(9, Math.floor(parseFloat(d) * 2));
      const hexChars = '0123456789';
      html += '<div style="color:' + (parseFloat(d) > 0.5 ? '#f44' : '#444') + ';">' + hexChars[intensity] || d + '</div>';
    }
  }
  html += '</div></div>';

  // Genetic Diversity Gauge
  const dPct = (divLevel * 100).toFixed(1);
  const dColor = divLevel > 0.5 ? '#4f4' : divLevel > 0.2 ? '#ff4' : '#f44';
  html += '<div class="dna-stat-row" style="margin-top:8px;">'
    + '<div class="dna-stat-label">Genetic Diversity</div>'
    + '<div class="dna-stat-bar-bg"><div class="dna-stat-bar" style="width:' + dPct + '%;background:' + dColor + '"></div></div>'
    + '<div class="dna-stat-val">' + dPct + '%</div></div>';

  container.innerHTML = html;

  // Draw all charts
  window.requestAnimationFrame(() => {
    drawHistogram('mass-histogram', massBuckets, '#ff4', 'Mass');
    drawHistogram('energy-distribution', energyBuckets, '#f44', 'Energy');
    drawHistogram('age-demographics', ageBuckets, '#4ff', 'Age');
    drawHistogram('velocity-distribution', velBuckets, '#f4f', 'Velocity');
    drawLineChart('pop-line-graph', popHistory, colors, names);
    drawScatterPlot('mass-nrg-scatter', massNrgPairs, colors);
    drawLineChartSimple('diversity-trend-graph', divHistory, '#4f4', 'Diversity');
    drawLineChartSimple('nrg-trend-graph', nrgHistory, '#f44', 'Avg Energy');
    drawLineChartSimple('mass-trend-graph', massHistory, '#ff4', 'Avg Mass');
  });
}

function overviewStat(label, value, color, historyKey) {
  return '<button class="dna-overview-stat" type="button" data-dna-history="' + historyKey + '">'
    + '<span>' + label + '</span><strong style="color:' + color + '">' + value + '</strong></button>';
}

function setupDNAInteractions() {
  const charts = document.getElementById('dna-charts');
  const analytics = document.getElementById('dna-analytics');
  if (!charts || charts.dataset.interactionsReady === 'true') return;
  charts.dataset.interactionsReady = 'true';
  // Expanding used to be bound to double-click alone: a desktop gesture, in a
  // drawer that was reworked touch-first, with no visible affordance saying a
  // graph could be expanded at all. Every chart section now carries explicit
  // EXPAND and PIN controls, so the gesture is visible, reachable by keyboard,
  // and works on a pointer with no double-tap.
  //
  // Double-click is kept as a shortcut rather than removed — it costs nothing
  // and preserves the muscle memory of anyone already using it.
  charts.addEventListener('click', (event) => {
    if (event.target.closest('[data-dna-expand]')) {
      const section = event.target.closest('.chart-section');
      if (section) toggleChart(section);
    } else if (event.target.closest('[data-dna-pin]')) {
      const section = event.target.closest('.chart-section');
      if (section) pinChart(section);
    }
  });
  for (const section of charts.querySelectorAll('.chart-section')) ensureChartControls(section);
  // Expanding moved from long-press to double-click on purpose. Long-press is
  // now the universal "explain this" gesture (helpOverlay.js) across every tab,
  // and it has to mean the same thing everywhere or users cannot learn it.
  // Expanding is a mode change rather than a question, so a deliberate
  // double-click is the better fit. Long-press help on a graph is handled by
  // the delegated handler on document, which is why nothing here listens for it.
  charts.addEventListener('dblclick', (event) => {
    const canvas = event.target.closest('canvas');
    if (!canvas) return;
    const section = canvas.closest('.chart-section');
    if (!section) return;
    // Double-clicking an already-expanded chart collapses it, so the gesture
    // is its own inverse and there is no dead end.
    if (section.classList.contains('dna-chart-expanded')) collapseChart(section);
    else expandChart(section);
  });
  if (analytics) analytics.addEventListener('click', (event) => {
    const stat = event.target.closest('[data-dna-history]');
    if (stat) openHistoryModule(stat.dataset.dnaHistory, stat.querySelector('span')?.textContent || stat.dataset.dnaHistory);
  });
}

function openHistoryModule(key, label) {
  const existing = document.getElementById('dna-history-module');
  if (existing) existing.remove();
  const source = key === 'population' ? popHistory.map((frame) => frame.reduce((sum, value) => sum + value, 0))
    : key === 'energy' ? nrgHistory : key === 'mass' ? massHistory : [];
  const values = source.length ? source.slice(-24) : ['No history yet'];
  const module = document.createElement('section');
  module.id = 'dna-history-module';
  module.className = 'dna-history-module';
  module.innerHTML = '<header><strong>' + label + ' HISTORY</strong><button type="button" aria-label="Close history">×</button></header>'
    + '<p>Recent samples from the DNA analytics cadence.</p><div class="dna-history-values">'
    + values.map((value) => '<span>' + (typeof value === 'number' ? Number(value).toFixed(2) : value) + '</span>').join('')
    + '</div>';
  document.getElementById('data-dna')?.appendChild(module);
  module.querySelector('button').addEventListener('click', () => module.remove());
}

/**
 * Add the EXPAND and PIN controls to a chart section if it has neither.
 *
 * Built through the DOM rather than markup because the chart sections are
 * static HTML in index.html and this keeps the affordance next to the drawing
 * code that gives it meaning.
 */
function ensureChartControls(section) {
  if (!section || section.querySelector('[data-dna-expand]')) return;
  const expand = document.createElement('button');
  expand.type = 'button';
  expand.className = 'dna-chart-expand';
  expand.setAttribute('data-dna-expand', '');
  expand.textContent = section.classList.contains('dna-chart-expanded') ? 'CLOSE' : 'EXPAND';

  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'dna-chart-pin';
  pin.setAttribute('data-dna-pin', '');
  pin.textContent = 'PIN';
  pin.title = 'Keep this graph open when another is expanded, so two can be compared';

  section.appendChild(expand);
  section.appendChild(pin);
}

function toggleChart(section) {
  if (section.classList.contains('dna-chart-expanded')) collapseChart(section);
  else expandChart(section);
}

/**
 * Pin a chart so it stays expanded while another is opened.
 *
 * Without this, expanding a second graph closes the first, which makes
 * comparing two graphs — the entire reason to expand one — impossible.
 */
function pinChart(section) {
  const wasPinned = section.classList.contains('dna-chart-pinned');
  document.querySelectorAll('.dna-chart-pinned').forEach((el) => {
    el.classList.remove('dna-chart-pinned');
    syncExpandControl(el);
  });
  if (wasPinned) {
    collapseChart(section);
    return;
  }
  if (!section.classList.contains('dna-chart-expanded')) expandChart(section);
  section.classList.add('dna-chart-pinned');
  syncExpandControl(section);
}

function syncExpandControl(section) {
  const button = section && section.querySelector('[data-dna-expand]');
  if (button) {
    const expanded = section.classList.contains('dna-chart-expanded');
    button.textContent = expanded ? 'CLOSE' : 'EXPAND';
    button.setAttribute('aria-label', expanded ? 'Close this graph' : 'Expand this graph');
  }
  const pin = section && section.querySelector('[data-dna-pin]');
  if (pin) {
    const pinned = section.classList.contains('dna-chart-pinned');
    pin.textContent = pinned ? 'PINNED' : 'PIN';
    pin.setAttribute('aria-pressed', pinned ? 'true' : 'false');
  }
}

function expandChart(section) {
  document.querySelectorAll('.dna-chart-expanded').forEach((el) => {
    if (el === section) return;
    el.classList.remove('dna-chart-expanded');
    syncExpandControl(el);
  });
  document.querySelectorAll('.dna-chart-close').forEach((el) => el.remove());
  section.classList.add('dna-chart-expanded');
  const close = document.createElement('button');
  close.className = 'dna-chart-close';
  close.type = 'button';
  close.textContent = 'CLOSE GRAPH';
  close.addEventListener('click', () => collapseChart(section));
  section.appendChild(close);
  syncExpandControl(section);
}

/** Shrink a chart, removing the close control. Safe to call when not expanded. */
function collapseChart(section) {
  if (!section) return;
  section.classList.remove('dna-chart-expanded');
  section.classList.remove('dna-chart-pinned');
  const close = section.querySelector('.dna-chart-close');
  if (close) close.remove();
  syncExpandControl(section);
}

// ── Line Chart (multi-species population) ──

function drawLineChart(canvasId, history, speciesColors, speciesNames) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || history.length < 2) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(rect.width * dpr);
  const h = Math.floor(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const pad = { top: 8, bottom: 12, left: 8, right: 8 };
  const plotW = rect.width - pad.left - pad.right;
  const plotH = rect.height - pad.top - pad.bottom;

  // Find max population across all history
  let maxPop = 1;
  for (const frame of history) {
    const sum = frame.reduce((a, b) => a + b, 0);
    if (sum > maxPop) maxPop = sum;
  }

  const sc = history[0].length;

  // Draw axes
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, rect.height - pad.bottom);
  ctx.lineTo(rect.width - pad.right, rect.height - pad.bottom);
  ctx.stroke();

  // Draw lines for each species
  for (let s = 0; s < sc && s < speciesColors.length; s++) {
    ctx.strokeStyle = speciesColors[s];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const x = pad.left + (i / (history.length - 1)) * plotW;
      const y = rect.height - pad.bottom - (history[i][s] / maxPop) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Y-axis labels
  ctx.fillStyle = '#555';
  ctx.font = '6px monospace';
  ctx.fillText(maxPop, 2, pad.top + 6);
  ctx.fillText('0', 2, rect.height - pad.bottom);
}

// ── Simple single-line chart ──

function drawLineChartSimple(canvasId, history, color, label) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || history.length < 2) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(rect.width * dpr);
  const h = Math.floor(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const pad = { top: 8, bottom: 10, left: 6, right: 6 };
  const plotW = rect.width - pad.left - pad.right;
  const plotH = rect.height - pad.top - pad.bottom;

  let minVal = Infinity, maxVal = -Infinity;
  for (const v of history) {
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }
  if (maxVal - minVal < 0.001) { maxVal = minVal + 1; minVal = Math.max(0, minVal - 0.5); }

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, rect.height - pad.bottom);
  ctx.lineTo(rect.width - pad.right, rect.height - pad.bottom);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < history.length; i++) {
    const x = pad.left + (i / (history.length - 1)) * plotW;
    const y = rect.height - pad.bottom - ((history[i] - minVal) / (maxVal - minVal)) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = '#555';
  ctx.font = '5px monospace';
  ctx.fillText(maxVal.toFixed(1), pad.left, pad.top + 5);
  ctx.fillText(minVal.toFixed(1), pad.left, rect.height - pad.bottom);
}

// ── Scatter Plot (Mass vs Energy) ──

function drawScatterPlot(canvasId, pairs, speciesColors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || pairs.length === 0) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(rect.width * dpr);
  const h = Math.floor(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const pad = { top: 8, bottom: 14, left: 10, right: 8 };
  const plotW = rect.width - pad.left - pad.right;
  const plotH = rect.height - pad.top - pad.bottom;
  const pointR = 2;

  // Find bounds
  let maxMass = 0.1, maxNrg = 0.1;
  for (const p of pairs) {
    if (p.mass > maxMass) maxMass = p.mass;
    if (p.nrg > maxNrg) maxNrg = p.nrg;
  }

  // Draw axes
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, rect.height - pad.bottom);
  ctx.lineTo(rect.width - pad.right, rect.height - pad.bottom);
  ctx.stroke();

  // Draw points (subsample for performance)
  const step = Math.max(1, Math.floor(pairs.length / 200));
  for (let i = 0; i < pairs.length; i += step) {
    const p = pairs[i];
    const x = pad.left + (p.mass / maxMass) * plotW;
    const y = rect.height - pad.bottom - (p.nrg / maxNrg) * plotH;
    const color = speciesColors[p.sid] || '#fff';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(x, y, pointR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Labels
  ctx.fillStyle = '#555';
  ctx.font = '5px monospace';
  ctx.fillText(maxMass.toFixed(1), pad.left, rect.height - 1);
  ctx.fillText('0', pad.left, rect.height - pad.bottom + 8);
  ctx.fillText(maxNrg.toFixed(1), 1, pad.top + 5);
}

// ── Histogram ──

function drawHistogram(canvasId, buckets, color, label) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(rect.width * dpr);
  const h = Math.floor(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const maxVal = Math.max(1, ...buckets);
  const pad = { top: 4, bottom: 10, left: 4, right: 4 };
  const barW = (rect.width - pad.left - pad.right) / buckets.length;
  const barH = rect.height - pad.top - pad.bottom;

  buckets.forEach((val, i) => {
    const x = pad.left + i * barW;
    const hgt = (val / maxVal) * barH;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(x, rect.height - pad.bottom - hgt, barW - 0.5, hgt);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, rect.height - pad.bottom - hgt, barW - 0.5, hgt);
  });
}
