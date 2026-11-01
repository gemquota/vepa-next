/**
 * VEPA v3 — Settings Panel
 * Camera configuration (focal distance, orthographic blend, rotate/pan
 * sensitivity), meta/render tunables, plus the full law toggle panel.
 */
import { setCameraConfig, resetCamera } from './camera.js';
import { runtimeConfig } from '../state/runtimeConfig.js';
import { createLawPanel } from './lawPanel.js';
import { isDebugVisible, setDebugVisible, debugSnapshot, logDebug } from '../debug.js';
import { createSliderRow } from './sliderControl.js';

const CAMERA_FIELDS = [
  { key: 'focalLength',       label: 'FOCAL DISTANCE',     min: 400,  max: 4000, step: 50,   value: 1200 },
  { key: 'ortho',             label: 'ORTHOGRAPHIC',       min: 0,    max: 1,    step: 0.05, value: 0 },
  { key: 'rotateSensitivity', label: 'ROTATE SENSITIVITY', min: 0.1,  max: 5,    step: 0.1,  value: 1 },
  { key: 'panSensitivity',    label: 'PAN SENSITIVITY',    min: 0.1,  max: 5,    step: 0.1,  value: 1 },
];

const META_FIELDS = [
  { key: 'visualScale', label: 'BASE SIZE',     min: 0.1, max: 5, step: 0.1,  value: 1.0,  set: (v) => runtimeConfig.visualScale = v },
  { key: 'globalAlpha', label: 'PARTICLE ALPHA', min: 0.1, max: 1, step: 0.05, value: 1.0, set: (v) => runtimeConfig.globalAlpha = v },
  { key: 'starMass',    label: 'STAR MASS',      min: 4,   max: 100, step: 1,  value: 12,   set: (v) => runtimeConfig.starMass = v },
  { key: 'simSpeed',    label: 'SIM SPEED',      min: 0.1, max: 10, step: 0.1, value: 1.0,  set: (v) => runtimeConfig.simSpeed = v },
];

/**
 * Build the settings panel into #laws-panel.
 * @param {import('../core/eventBus.js').EventBus} bus
 * @param {{ lowFlags: Uint32Array, highFlags: Uint32Array, extFlags: Uint32Array }} lawStateObj
 */
export function createSettingsPanel(bus, lawStateObj) {
  const panel = document.getElementById('laws-panel');
  if (!panel) return;

  let html = '';

  // ── Camera section ──
  html += '<div class="panel-section">';
  html += '<h3 class="law-category-header" style="color:#0ff">CAMERA</h3>';
  for (const f of CAMERA_FIELDS) {
    html += `<div data-slider-slot="cam-${f.key}"></div>`;
  }
  html += '<div class="setting-row">';
  html += '<button id="cam-reset" class="btn tiny-btn" type="button">RESET CAMERA</button>';
  html += '</div>';
  html += '</div>';

  // ── Compute backend section ──
  html += '<div class="panel-section">';
  html += '<h3 class="law-category-header" style="color:#7cf">COMPUTE</h3>';
  html += '<div class="setting-row">';
  html += '<label class="setting-label" for="compute-engine">PHYSICS BACKEND</label>';
  html += '<select id="compute-engine" class="setting-select" title="Choose the physics compute backend">';
  html += '<option value="gpu">GPU (WebGPU)</option>';
  html += '<option value="cpu">CPU</option>';
  html += '</select>';
  html += '</div>';
  html += '<div id="compute-engine-status" class="setting-status" role="status">GPU is selected by default. WebGPU currently accelerates the gravity/collision subset; CPU handles the remaining laws and is used when WebGPU is unavailable.</div>';
  html += '</div>';

  // ── Meta / render section ──
  html += '<div class="panel-section">';
  html += '<h3 class="law-category-header" style="color:#f8c">META</h3>';
  for (const f of META_FIELDS) {
    html += `<div data-slider-slot="meta-${f.key}"></div>`;
  }
  html += '</div>';

  // ── Debug section ──
  html += '<div class="panel-section">';
  html += '<h3 class="law-category-header" style="color:#4aff8a">DEBUG</h3>';
  html += '<div class="setting-row">';
  html += '<label class="setting-label" for="debug-visible">DEBUG OVERLAY</label>';
  html += `<button id="debug-visible" class="btn tiny-btn" type="button">${isDebugVisible() ? 'HIDE' : 'SHOW'}</button>`;
  html += `<button id="debug-copy" class="btn tiny-btn" type="button" title="Copy all debug messages as JSON">COPY LOG</button>`;
  html += '</div>';
  html += '</div>';

  panel.innerHTML = html;

  const computeSelect = document.getElementById('compute-engine');
  const computeStatus = document.getElementById('compute-engine-status');
  if (computeSelect) {
    computeSelect.value = runtimeConfig.computeEngine;
    computeSelect.addEventListener('change', () => {
      runtimeConfig.computeEngine = computeSelect.value === 'cpu' ? 'cpu' : 'gpu';
      if (computeStatus) {
        computeStatus.textContent = runtimeConfig.computeEngine === 'gpu'
          ? 'GPU selected. The worker will use WebGPU when available and report CPU fallback otherwise.'
          : 'CPU selected. Physics stays on the validated synchronous CPU path.';
      }
      bus.emit('compute:changed', { engine: runtimeConfig.computeEngine });
    });
  }

  const debugVisibleBtn = document.getElementById('debug-visible');
  if (debugVisibleBtn) {
    debugVisibleBtn.addEventListener('click', () => {
      const next = !isDebugVisible();
      setDebugVisible(next);
      debugVisibleBtn.textContent = next ? 'HIDE' : 'SHOW';
    });
  }
  const debugCopyBtn = document.getElementById('debug-copy');
  if (debugCopyBtn) {
    debugCopyBtn.addEventListener('click', () => {
      copyDebugLog();
    });
  }

  // ── Enhanced slider rows (unified with WORLD / DNA / Species) ──
  const camRows = {};
  panel.querySelectorAll('[data-slider-slot^="cam-"]').forEach((slot) => {
    const key = slot.dataset.sliderSlot.slice(4);
    const f = CAMERA_FIELDS.find((x) => x.key === key);
    if (!f) return;
    const row = createSliderRow({
      label: f.label,
      min: f.min,
      max: f.max,
      step: f.step,
      value: f.value,
      key: `cam-${key}`,
      title: `${f.label} (camera)`,
      onChange: (value) => setCameraConfig({ [key]: value }),
    });
    camRows[key] = row;
    slot.replaceWith(row.el);
  });

  const metaRows = {};
  panel.querySelectorAll('[data-slider-slot^="meta-"]').forEach((slot) => {
    const key = slot.dataset.sliderSlot.slice(5);
    const f = META_FIELDS.find((x) => x.key === key);
    if (!f) return;
    const row = createSliderRow({
      label: f.label,
      min: f.min,
      max: f.max,
      step: f.step,
      value: f.value,
      key: `meta-${key}`,
      title: `${f.label} (meta)`,
      onChange: (value) => f.set(value),
    });
    metaRows[key] = row;
    slot.replaceWith(row.el);
  });

  const resetBtn = document.getElementById('cam-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetCamera();
      for (const f of CAMERA_FIELDS) {
        const row = camRows[f.key];
        if (row) row.setValue(f.value, { emit: false, snap: true });
      }
    });
  }

  // Law toggles below the settings sections
  createLawPanel(bus, lawStateObj);
}

/** Copy the full debug log to the clipboard (used by the DEBUG section). */
function copyDebugLog() {
  const text = JSON.stringify(debugSnapshot(), null, 2);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
  } else {
    fallbackCopyText(text);
  }
  logDebug('debug log copied from settings');
}

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ }
  document.body.removeChild(ta);
}
