/**
 * VEPA4 — Enhanced slider control
 *
 * Builds a compact slider row with:
 *  - shortform min/max labels (e.g. "20K") that can be manually redefined by
 *    long-pressing them and typing a new bound
 *  - a LIN/LOG scale toggle (LOG requires a positive lower bound)
 *  - snapping to the parameter's step grid (finer at higher zoom levels)
 *  - hold-still precision zoom: keep the pointer still on the slider to
 *    magnify the current 1/4 of the range to the full slider width (4×);
 *    hold still even longer to magnify 1/16 of the range (16×)
 *
 * The mapping/snap/zoom math is exported as pure functions for unit testing;
 * the DOM factory (createSliderRow) is the only part that touches the page.
 */

export const ZOOM_FACTORS = [1, 4, 16];
export const LONG_PRESS_MS = 500;
export const HOLD_ZOOM_MS = 650;    // hold-still → 4× magnification
export const HOLD_ZOOM_MS_2 = 1600; // hold-still longer → 16× magnification
export const MOVE_TOLERANCE = 6;    // px — movement cancels a pending hold
const SLIDER_STEPS = 1000;          // raw input resolution (0..1000)

// ── Pure helpers ──────────────────────────────────────────────────────────

function trim1(n) {
  const s = n.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/**
 * Compact value formatting: 20000 → "20K", 2500 → "2.5K", 1e6 → "1M",
 * 0.05 → "0.05", -20000 → "-20K". Used for the min/max bound labels.
 */
export function formatShort(v) {
  if (!Number.isFinite(v)) return String(v);
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e6) return sign + trim1(abs / 1e6) + 'M';
  if (abs >= 1e3) return sign + trim1(abs / 1e3) + 'K';
  return sign + String(parseFloat(abs.toFixed(3)));
}

/** Number of decimal places in a step (0.05 → 2, 100 → 0). */
export function decimalsOf(step) {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const s = String(step);
  const i = s.indexOf('.');
  if (i !== -1) return s.length - i - 1;
  if (s.includes('e')) {
    const [m, e] = s.split('e');
    return Math.max(0, decimalsOf(m) - parseInt(e, 10));
  }
  return 0;
}

/** Map a value to a 0..1 position inside a window (lin or log scale). */
export function positionForValue(value, win, mode = 'lin') {
  const { min, max } = win;
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(value)) return 0;
  let p;
  if (mode === 'log') {
    const v = Math.min(max, Math.max(min, value));
    p = Math.log(v / min) / Math.log(max / min);
  } else {
    p = (value - min) / span;
  }
  return Math.min(1, Math.max(0, p));
}

/** Map a 0..1 position back to a value inside a window (lin or log scale). */
export function valueForPosition(p, win, mode = 'lin') {
  const { min, max } = win;
  const span = max - min;
  if (!(span > 0)) return min;
  const t = Math.min(1, Math.max(0, p));
  let v;
  if (mode === 'log') {
    v = min * Math.pow(max / min, t);
  } else {
    v = min + t * span;
  }
  return Math.min(max, Math.max(min, v));
}

/** Snap a value to the step grid anchored at `anchor`, float-safe. */
export function snapToStep(value, step, anchor = 0) {
  if (!Number.isFinite(step) || step <= 0) return value;
  // Stabilize the quotient (0.35 / 0.1 = 3.4999… in floats) so the nearest
  // grid point is picked instead of the one below it.
  const q = ((value - anchor) / step) * 1e12;
  const k = Math.round(Math.round(q) / 1e12);
  const snapped = anchor + k * step;
  const dec = decimalsOf(step);
  return dec > 0 ? Number(snapped.toFixed(dec)) : snapped;
}

/**
 * Visible window for a zoom level, centered on `center` and clamped to the
 * base range. Level 1 shows 1/4 of the range, level 2 shows 1/16.
 */
export function zoomWindow(baseMin, baseMax, center, level) {
  const span = baseMax - baseMin;
  const factor = ZOOM_FACTORS[Math.min(ZOOM_FACTORS.length - 1, Math.max(0, level))] || 1;
  if (factor <= 1 || !(span > 0)) return { min: baseMin, max: baseMax };
  const half = span / (2 * factor);
  const c = Math.min(baseMax, Math.max(baseMin, center));
  return {
    min: Math.max(baseMin, c - half),
    max: Math.min(baseMax, c + half),
  };
}

/** Prefer LOG for wide positive ranges where linear dragging gets coarse. */
export function defaultLogMode(min, max) {
  return min > 0 && max / min >= 50;
}

/** Display formatting for a value given the current step precision. */
export function formatValue(v, step) {
  if (!Number.isFinite(v)) return String(v);
  const dec = Math.min(6, Math.max(0, decimalsOf(step || 0)));
  return v.toFixed(dec);
}

// ── DOM factory ───────────────────────────────────────────────────────────

/**
 * Build an enhanced slider row element.
 *
 * @param {object} opts
 * @param {string} opts.label   row label
 * @param {number} opts.min     base minimum
 * @param {number} opts.max     base maximum
 * @param {number} opts.step    snap increment
 * @param {number} opts.value   initial value
 * @param {string} [opts.key]   stable row key (data attribute)
 * @param {string} [opts.title] hover title for the label
 * @param {(value:number, state:object)=>void} [opts.onChange] fired on user change
 * @param {'lin'|'log'} [opts.initialMode] override the default scale
 * @returns {{el:HTMLElement, setValue:(v:number, o?:object)=>void, getValue:()=>number}}
 */
export function createSliderRow(opts = {}) {
  const {
    label = '',
    min = 0,
    max = 1,
    step = 0.01,
    value = min,
    key = '',
    title = '',
    onChange = () => {},
    initialMode,
  } = opts;

  const state = {
    baseMin: min,
    baseMax: max,
    step,
    mode: initialMode || (defaultLogMode(min, max) ? 'log' : 'lin'),
    level: 0,
    value: Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)),
  };
  state.min = state.baseMin;
  state.max = state.baseMax;

  const el = document.createElement('div');
  el.className = 'sc-row' + (state.mode === 'log' ? ' sc-log' : '');
  if (key) el.dataset.key = key;
  el.innerHTML = `
    <div class="sc-controls">
      <label class="sc-label" title="${escAttr(title)}">${escHtml(label)}</label>
      <button type="button" class="sc-bound sc-min" title="Long-press to edit minimum">${formatShort(state.baseMin)}</button>
      <input type="range" class="sc-input" min="0" max="${SLIDER_STEPS}" step="1" value="0" />
      <button type="button" class="sc-bound sc-max" title="Long-press to edit maximum">${formatShort(state.baseMax)}</button>
      <span class="sc-value">${formatValue(state.value, step)}</span>
      <button type="button" class="sc-mode" title="Toggle linear / logarithmic scale">${state.mode.toUpperCase()}</button>
      <button type="button" class="sc-zoom" title="Precision zoom: hold the slider still to magnify around your finger. Click to reset.">1×</button>
    </div>
    <div class="sc-zoombar"><div class="sc-zoombar-fill"></div></div>
  `;

  const input = el.querySelector('.sc-input');
  const valueEl = el.querySelector('.sc-value');
  const minBtn = el.querySelector('.sc-min');
  const maxBtn = el.querySelector('.sc-max');
  const modeBtn = el.querySelector('.sc-mode');
  const zoomBtn = el.querySelector('.sc-zoom');
  const zoomFill = el.querySelector('.sc-zoombar-fill');

  function currentWindow() {
    return { min: state.min, max: state.max };
  }

  function emitChange() {
    onChange(state.value, state);
  }

  function render() {
    const win = currentWindow();
    const p = positionForValue(state.value, win, state.mode);
    input.value = String(Math.round(p * SLIDER_STEPS));
    const effStep = state.step / ZOOM_FACTORS[state.level];
    valueEl.textContent = formatValue(state.value, effStep);
  }

  function applyValue(v, { emit = true, snap = true } = {}) {
    let out = Number.isFinite(v) ? v : state.value;
    if (snap) {
      const effStep = state.step / ZOOM_FACTORS[state.level];
      out = snapToStep(out, effStep, state.min);
      out = Math.min(state.max, Math.max(state.min, out));
    }
    state.value = out;
    render();
    if (emit) emitChange();
    return out;
  }

  function updateZoomUI() {
    const span = state.baseMax - state.baseMin;
    const left = span > 0 ? ((state.min - state.baseMin) / span) * 100 : 0;
    const width = span > 0 ? ((state.max - state.min) / span) * 100 : 100;
    zoomFill.style.left = `${left}%`;
    zoomFill.style.width = `${Math.max(0.5, width)}%`;
    zoomBtn.textContent = `${ZOOM_FACTORS[state.level]}×`;
    zoomBtn.classList.toggle('is-zoomed', state.level > 0);
    el.classList.toggle('sc-zoomed', state.level > 0);
  }

  function setZoomLevel(level) {
    state.level = level;
    const win = zoomWindow(state.baseMin, state.baseMax, state.value, level);
    state.min = win.min;
    state.max = win.max;
    applyValue(state.value, { emit: false, snap: true }); // re-snap to the new grid
    updateZoomUI();
    render();
  }

  function resetZoom() {
    setZoomLevel(0);
  }

  function updateBoundLabels() {
    minBtn.textContent = formatShort(state.baseMin);
    maxBtn.textContent = formatShort(state.baseMax);
  }

  // ── Slider input ──
  input.addEventListener('input', () => {
    const p = parseInt(input.value, 10) / SLIDER_STEPS;
    const v = valueForPosition(p, currentWindow(), state.mode);
    applyValue(v);
  });

  // Hold-still precision zoom state machine.
  let down = false;
  let moved = false;
  let holdTimer = null;
  const downPoint = { x: 0, y: 0 };

  function cancelHold() {
    clearTimeout(holdTimer);
    holdTimer = null;
  }

  function scheduleHold() {
    cancelHold();
    const delay = state.level === 0 ? HOLD_ZOOM_MS : HOLD_ZOOM_MS_2 - HOLD_ZOOM_MS;
    holdTimer = setTimeout(() => {
      if (!down || moved) return;
      if (state.level < 2) {
        setZoomLevel(state.level + 1);
        scheduleHold(); // chain to the next zoom stage
      }
    }, delay);
  }

  input.addEventListener('pointerdown', (e) => {
    down = true;
    moved = false;
    downPoint.x = e.clientX;
    downPoint.y = e.clientY;
    scheduleHold();
  });

  input.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dist = Math.hypot(e.clientX - downPoint.x, e.clientY - downPoint.y);
    if (dist > MOVE_TOLERANCE) {
      moved = true;
      cancelHold();
    } else if (moved) {
      moved = false;
      scheduleHold();
    }
  });

  input.addEventListener('pointerup', () => {
    down = false;
    cancelHold();
  });
  input.addEventListener('pointercancel', () => {
    down = false;
    cancelHold();
  });

  // ── Zoom chip: click resets to the full range ──
  zoomBtn.addEventListener('click', () => resetZoom());

  // ── LIN/LOG toggle ──
  function setMode(mode) {
    state.mode = mode;
    el.classList.toggle('sc-log', mode === 'log');
    modeBtn.textContent = mode.toUpperCase();
    modeBtn.classList.toggle('is-log', mode === 'log');
    render();
  }

  modeBtn.addEventListener('click', () => {
    if (state.baseMin <= 0) return; // log scale needs a positive lower bound
    setMode(state.mode === 'lin' ? 'log' : 'lin');
  });
  if (state.baseMin <= 0) modeBtn.disabled = true;

  // ── Long-press to edit the min/max bounds ──
  function beginEdit(btn, which) {
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.className = 'sc-edit';
    inputEl.value = String(which === 'min' ? state.baseMin : state.baseMax);
    inputEl.spellcheck = false;
    btn.replaceWith(inputEl);
    inputEl.focus();
    inputEl.select();

    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      if (commit) {
        const v = parseFloat(inputEl.value);
        const other = which === 'min' ? state.baseMax : state.baseMin;
        if (Number.isFinite(v) && (which === 'min' ? v < other : v > other)) {
          if (which === 'min') state.baseMin = v;
          else state.baseMax = v;
          resetZoom();
          updateBoundLabels();
          if (state.mode === 'log' && state.baseMin <= 0) setMode('lin');
          state.value = Math.min(state.baseMax, Math.max(state.baseMin, state.value));
          render();
          emitChange();
        }
      }
      inputEl.replaceWith(btn);
    };

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    inputEl.addEventListener('blur', () => finish(true));
    inputEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  function wireBoundEdit(btn, which) {
    let timer = null;
    let startX = 0;
    let startY = 0;
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      startX = e.clientX;
      startY = e.clientY;
      timer = setTimeout(() => beginEdit(btn, which), LONG_PRESS_MS);
    });
    btn.addEventListener('pointermove', (e) => {
      if (timer && Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_TOLERANCE) {
        clearTimeout(timer);
        timer = null;
      }
    });
    const cancel = () => {
      clearTimeout(timer);
      timer = null;
    };
    btn.addEventListener('pointerup', cancel);
    btn.addEventListener('pointerleave', cancel);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  wireBoundEdit(minBtn, 'min');
  wireBoundEdit(maxBtn, 'max');

  // ── Public API ──
  updateZoomUI();
  render();

  return {
    el,
    setValue: (v, o) => applyValue(v, o),
    getValue: () => state.value,
  };
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function escAttr(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  })[c]);
}
