/**
 * VEPA4 — World Intelligence Panel
 * Live dashboard for the five intelligence engines: cluster detection,
 * lineage tracking, goal tuning, and timeline recording/scrubbing.
 */

import { setCellValue } from './analyticsPanel.js';

let host = null;
let clusterCount = 0;
let births = 0, deaths = 0, longestGen = 0;
let largestCluster = 0, clusterEnergy = 0;
let timelineCount = 0;
let recording = false;
let goalLog = [];

/**
 * Create the intelligence dashboard inside #intel-dashboard.
 */
export function createIntelPanel(bus) {
  const target = document.getElementById('intel-dashboard');
  if (!target) return;
  host = target;

  host.innerHTML = `
    <div class="intel-header">INTELLIGENCE</div>
    <div class="intel-grid">
      <div class="intel-cell"><span class="intel-label">CLUSTERS</span><span id="intel-clusters" class="intel-value">0</span></div>
      <div class="intel-cell"><span class="intel-label">LARGEST CLUSTER</span><span id="intel-largest" class="intel-value">0</span></div>
      <div class="intel-cell"><span class="intel-label">CLUSTER ENERGY</span><span id="intel-cluster-energy" class="intel-value">0</span></div>
      <div class="intel-cell"><span class="intel-label">BIRTHS</span><span id="intel-births" class="intel-value">0</span></div>
      <div class="intel-cell"><span class="intel-label">DEATHS</span><span id="intel-deaths" class="intel-value">0</span></div>
      <div class="intel-cell"><span class="intel-label">NET GROWTH</span><span id="intel-net" class="intel-value">0</span></div>
      <div class="intel-cell"><span class="intel-label">LINEAGE DEPTH</span><span id="intel-lineage" class="intel-value">0</span></div>
      <div class="intel-cell"><span class="intel-label">SNAPSHOTS</span><span id="intel-snapshots" class="intel-value">0</span></div>
      <div class="intel-cell"><span class="intel-label">RECORDING</span><span id="intel-rec" class="intel-value">OFF</span></div>
    </div>
    <div class="intel-row">
      <button id="intel-record-btn" class="intel-btn">● REC</button>
      <input id="intel-scrub" type="range" min="0" max="0" value="0" disabled title="Scrub timeline" />
      <button id="intel-clear-btn" class="intel-btn" title="Clear timeline">✕</button>
    </div>
    <div id="intel-goal-log" class="intel-log"></div>
  `;

  const recordBtn = host.querySelector('#intel-record-btn');
  const clearBtn = host.querySelector('#intel-clear-btn');
  const scrub = host.querySelector('#intel-scrub');

  recordBtn.addEventListener('click', () => {
    recording = !recording;
    bus.emit('timeline:record', { enabled: recording });
    recordBtn.classList.toggle('recording', recording);
    recordBtn.textContent = recording ? '■ STOP' : '● REC';
    setValue('intel-rec', recording ? 'ON' : 'OFF');
  });

  clearBtn.addEventListener('click', () => {
    bus.emit('timeline:clear');
    scrub.value = 0;
  });

  scrub.addEventListener('input', () => {
    bus.emit('timeline:scrubTo', Number(scrub.value));
  });

  // ── Event subscriptions ──
  bus.on('cluster:detected', (data) => {
    const clusters = (data && data.clusters) || [];
    clusterCount = clusters.length;
    // Derived from the same detection pass, so these cannot drift from the
    // cluster count they sit next to.
    let biggest = 0;
    let energy = 0;
    for (const c of clusters) {
      if ((c.size || 0) > biggest) biggest = c.size || 0;
      energy += c.energy || 0;
    }
    largestCluster = biggest;
    clusterEnergy = energy;
    setValue('intel-clusters', clusterCount);
    setValue('intel-largest', largestCluster);
    setValue('intel-cluster-energy', Math.round(clusterEnergy));
  });
  bus.on('lineage:branch', (data) => {
    births++;
    if (data.generation > longestGen) longestGen = data.generation;
    setValue('intel-births', births);
    setValue('intel-lineage', longestGen);
    setValue('intel-net', births - deaths);
  });
  bus.on('lineage:death', () => {
    deaths++;
    setValue('intel-deaths', deaths);
    // Signed so the direction of the population is readable at a glance;
    // BIRTHS and DEATHS side by side makes you subtract them yourself.
    setValue('intel-net', births - deaths);
  });
  bus.on('goal:applied', (adj) => {
    pushGoalLog(`${adj.parameter} ${Number(adj.oldValue).toFixed(2)} → ${Number(adj.newValue).toFixed(2)}`);
  });
  bus.on('timeline:snapshot', (data) => {
    timelineCount = data.count || timelineCount + 1;
    setValue('intel-snapshots', timelineCount);
    scrub.max = String(Math.max(0, timelineCount - 1));
    scrub.disabled = timelineCount === 0;
  });
  bus.on('timeline:cleared', () => {
    timelineCount = 0;
    setValue('intel-snapshots', 0);
    scrub.max = '0';
    scrub.disabled = true;
  });
  bus.on('timeline:restored', () => {
    pushGoalLog('timeline scrubbed');
  });
}

function setValue(id, text) {
  setCellValue(host, id, text);
}

function pushGoalLog(text) {
  const log = host && host.querySelector('#intel-goal-log');
  if (!log) return;
  goalLog.push(`t+${Date.now() % 100000} ${text}`);
  if (goalLog.length > 4) goalLog.shift();
  log.textContent = goalLog.join('\n');
}
