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
import { copyText } from '../core/clipboard.js';
import { readLaunchSettings, writeLaunchSettings, normaliseLaunchSettings } from '../state/launchSettings.js';

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
  // The launch modal asks the same two questions this section does. The
  // precedence, which was previously unstated and therefore unresolvable, is:
  // the modal sets the *initial* value; this panel is the live authority; and
  // "use as launch default" writes the live value back to the modal.
  html += '<div class="panel-section">';
  html += '<h3 class="law-category-header" style="color:#7cf">COMPUTE</h3>';
  html += '<div class="setting-note">The launch modal sets the starting value; this panel is the live value. '
    + 'Changes that need a reload say so.</div>';
  html += '<div class="setting-row">';
  html += '<label class="setting-label" for="compute-engine">PHYSICS BACKEND</label>';
  html += '<select id="compute-engine" class="setting-select" title="Choose the physics compute backend">';
  html += '<option value="gpu">GPU (WebGPU)</option>';
  html += '<option value="cpu">CPU</option>';
  html += '</select>';
  html += '<span id="compute-engine-badge" class="setting-badge" role="status"></span>';
  html += '</div>';
  html += '<div id="compute-engine-status" class="setting-status" role="status">GPU is selected by default. WebGPU currently accelerates the gravity/collision subset; CPU handles the remaining laws and is used when WebGPU is unavailable.</div>';
  html += '<div class="setting-row">';
  html += '<label class="setting-label" for="render-backend">RENDERER</label>';
  html += '<select id="render-backend" class="setting-select" title="Choose the particle renderer">';
  html += '<option value="canvas2d">Canvas2D (reference)</option>';
  html += '<option value="pixi">PixiJS (GPU)</option>';
  html += '</select>';
  html += '<span id="render-backend-badge" class="setting-badge" role="status"></span>';
  html += '</div>';
  html += '<div id="render-backend-status" class="setting-status" role="status">Canvas2D is the reference renderer. PixiJS uses a pooled GPU particle path when the browser supports WebGL.</div>';
  html += '<div class="setting-row">';
  html += '<button id="compute-reload" class="btn tiny-btn" type="button" hidden>↻ RELOAD TO APPLY</button>';
  html += '<button id="compute-use-launch" class="btn tiny-btn" type="button" title="Make this the value the launch modal starts from">USE AS LAUNCH DEFAULT</button>';
  html += '<button id="compute-reset" class="btn tiny-btn" type="button" title="Return both to what the launch modal chose">RESET TO LAUNCH</button>';
  html += '</div>';
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
  const computeBadge = document.getElementById('compute-engine-badge');
  const renderSelect = document.getElementById('render-backend');
  const renderStatus = document.getElementById('render-backend-status');
  const renderBadge = document.getElementById('render-backend-badge');
  const reloadBtn = document.getElementById('compute-reload');

  // What is actually running right now. A change to either is not live until a
  // reload, and the badge says so rather than letting the select imply the
  // world already switched.
  const activeCompute = runtimeConfig.computeEngine;
  const activeRender = runtimeConfig.renderBackend;

  const pending = () => runtimeConfig.computeEngine !== activeCompute || runtimeConfig.renderBackend !== activeRender;

  function syncBadges() {
    const waiting = pending();
    if (computeBadge) computeBadge.textContent = runtimeConfig.computeEngine === activeCompute ? 'ACTIVE' : 'PENDING';
    if (renderBadge) renderBadge.textContent = runtimeConfig.renderBackend === activeRender ? 'ACTIVE' : 'PENDING';
    if (computeBadge) computeBadge.classList.toggle('pending', runtimeConfig.computeEngine !== activeCompute);
    if (renderBadge) renderBadge.classList.toggle('pending', runtimeConfig.renderBackend !== activeRender);
    if (reloadBtn) reloadBtn.hidden = !waiting;
  }

  if (computeSelect) {
    computeSelect.value = activeCompute;
    computeSelect.addEventListener('change', () => {
      runtimeConfig.computeEngine = computeSelect.value === 'cpu' ? 'cpu' : 'gpu';
      if (computeStatus) {
        computeStatus.textContent = runtimeConfig.computeEngine === 'gpu'
          ? 'GPU selected. The worker will use WebGPU when available and report CPU fallback otherwise.'
          : 'CPU selected. Physics stays on the validated synchronous CPU path.';
      }
      syncBadges();
      bus.emit('compute:changed', { engine: runtimeConfig.computeEngine });
    });
  }

  if (renderSelect) {
    renderSelect.value = activeRender;
    renderSelect.addEventListener('change', () => {
      runtimeConfig.renderBackend = renderSelect.value === 'pixi' ? 'pixi' : 'canvas2d';
      try { localStorage.setItem('vepa-render-backend', runtimeConfig.renderBackend); } catch { /* storage optional */ }
      if (renderStatus) {
        renderStatus.textContent = runtimeConfig.renderBackend === 'pixi'
          ? 'PixiJS selected. Reload to initialize the GPU renderer; Canvas2D remains the automatic fallback.'
          : 'Canvas2D selected as the reference renderer.';
      }
      syncBadges();
    });
  }

  // One honest path from "live value" to "launch default", so the modal and
  // this panel cannot silently diverge again.
  const useLaunchBtn = document.getElementById('compute-use-launch');
  if (useLaunchBtn) {
    useLaunchBtn.addEventListener('click', () => {
      const next = normaliseLaunchSettings({
        ...readLaunchSettings(),
        renderBackend: runtimeConfig.renderBackend,
        computeEngine: runtimeConfig.computeEngine,
      });
      writeLaunchSettings(next);
      if (computeStatus) {
        computeStatus.textContent = 'Launch default set to '
          + `${next.renderBackend} / ${next.computeEngine}. The next launch modal opens on these.`;
      }
      logDebug(`launch default set to ${next.renderBackend}/${next.computeEngine}`);
    });
  }

  const computeResetBtn = document.getElementById('compute-reset');
  if (computeResetBtn) {
    computeResetBtn.addEventListener('click', () => {
      const launch = readLaunchSettings();
      runtimeConfig.computeEngine = launch.computeEngine;
      runtimeConfig.renderBackend = launch.renderBackend;
      if (computeSelect) computeSelect.value = runtimeConfig.computeEngine;
      if (renderSelect) renderSelect.value = runtimeConfig.renderBackend;
      try { localStorage.setItem('vepa-render-backend', runtimeConfig.renderBackend); } catch { /* storage optional */ }
      syncBadges();
      bus.emit('compute:changed', { engine: runtimeConfig.computeEngine });
      if (computeStatus) {
        computeStatus.textContent = `Reset to the launch choice: ${runtimeConfig.renderBackend} / ${runtimeConfig.computeEngine}.`;
      }
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => { window.location.reload(); });
  }
  syncBadges();

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
  copyText(JSON.stringify(debugSnapshot(), null, 2));
  logDebug('debug log copied from settings');
}

