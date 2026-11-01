/**
 * VEPA4 — Debug Overlay & Message Log
 * One floating overlay that collects every debug message since the page
 * started. Tap the header (or the ⧉ button) to copy the entire log as a
 * single JSON object. Visibility is controlled by the DEBUG section in the
 * SETTINGS tab and persists in localStorage.
 */

import pkg from '../package.json';

const STORAGE_KEY = 'vepa4.debugOverlay';
const APP_VERSION = pkg.version;

let visible = (() => {
  try { return localStorage.getItem(STORAGE_KEY) !== 'false'; } catch (e) { return true; }
})();

const startedAt = Date.now();
const messages = [];
let overlayEl = null;
let bodyEl = null;
let statsEl = null;
let countEl = null;
let copyEl = null;

const liveStats = { fps: 0, tick: 0, particles: 0, species: 0, laws: 0, frameMs: 0, tickMs: 0, renderMs: 0 };

function fmtClock(t) {
  const d = new Date(t);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function levelClass(level) {
  if (level === 'error') return 'dbg-error';
  if (level === 'warn') return 'dbg-warn';
  return 'dbg-info';
}

/**
 * Append a debug message. Kept for the lifetime of the page.
 */
export function logDebug(text, level = 'info') {
  const entry = { t: Date.now(), level, text: String(text) };
  messages.push(entry);
  if (overlayEl && visible) renderBody();
}

/**
 * All messages since the window started, as one copyable object.
 */
export function debugSnapshot() {
  return {
    app: 'VEPA4',
    version: APP_VERSION,
    url: typeof location !== 'undefined' ? location.href : '',
    startedAt,
    messageCount: messages.length,
    messages: messages.map((m) => ({ at: fmtClock(m.t), level: m.level, text: m.text })),
  };
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ }
  document.body.removeChild(ta);
}

function flashCopied() {
  const orig = copyEl.textContent;
  copyEl.textContent = '✓ COPIED';
  copyEl.classList.add('dbg-copied');
  setTimeout(() => {
    copyEl.textContent = orig;
    copyEl.classList.remove('dbg-copied');
  }, 1200);
}

function copyAll() {
  copyText(JSON.stringify(debugSnapshot(), null, 2));
  flashCopied();
}

/**
 * Show or hide the overlay. Persists the choice.
 */
export function setDebugVisible(v) {
  visible = !!v;
  try { localStorage.setItem(STORAGE_KEY, visible ? 'true' : 'false'); } catch (e) { /* ignore */ }
  if (overlayEl) overlayEl.classList.toggle('hidden', !visible);
  if (visible && bodyEl) renderBody();
}

export function isDebugVisible() {
  return visible;
}

/**
 * Refresh the live stat readout (called by the render loop).
 */
export function updateLiveStats(stats) {
  Object.assign(liveStats, stats);
  if (overlayEl && visible && statsEl) {
    const perf =
      liveStats.frameMs || liveStats.tickMs || liveStats.renderMs
        ? ` · f:${liveStats.frameMs.toFixed(1)}ms t:${liveStats.tickMs.toFixed(2)}ms r:${liveStats.renderMs.toFixed(2)}ms`
        : '';
    statsEl.textContent =
      `fps:${liveStats.fps} tick:${liveStats.tick} n:${liveStats.particles} sp:${liveStats.species} laws:${liveStats.laws}` + perf;
  }
}

const MAX_SHOWN = 300;

function renderBody() {
  if (!bodyEl) return;
  bodyEl.textContent = '';
  const slice = messages.slice(-MAX_SHOWN);
  for (const m of slice) {
    const line = document.createElement('div');
    line.className = levelClass(m.level);
    line.textContent = `[${fmtClock(m.t)}] ${m.level.toUpperCase()} ${m.text}`;
    bodyEl.appendChild(line);
  }
  bodyEl.scrollTop = bodyEl.scrollHeight;
  if (countEl) countEl.textContent = messages.length;
}

function ensureOverlay() {
  // Adopt a fallback overlay created by the inline probe if it exists
  overlayEl = document.getElementById('vepa-debug');
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.id = 'vepa-debug';
    document.body.prepend(overlayEl);
  }
  overlayEl.className = 'vepa-debug' + (visible ? '' : ' hidden');
  overlayEl.textContent = '';

  const header = document.createElement('div');
  header.className = 'vepa-debug-header';
  header.title = 'Tap to copy all debug messages';

  const dot = document.createElement('span');
  dot.className = 'vepa-debug-dot';
  dot.textContent = '●';

  const title = document.createElement('span');
  title.className = 'vepa-debug-title';
  title.textContent = 'DEBUG';

  const versionEl = document.createElement('span');
  versionEl.id = 'vepa-debug-version';
  versionEl.className = 'vepa-debug-version';
  versionEl.textContent = 'v' + APP_VERSION;

  countEl = document.createElement('span');
  countEl.id = 'vepa-debug-count';
  countEl.className = 'vepa-debug-count';

  statsEl = document.createElement('span');
  statsEl.id = 'vepa-debug-stats';
  statsEl.className = 'vepa-debug-stats';

  copyEl = document.createElement('button');
  copyEl.id = 'vepa-debug-copy';
  copyEl.className = 'vepa-debug-btn';
  copyEl.textContent = '⧉ COPY';
  copyEl.title = 'Copy all debug messages as JSON';
  copyEl.addEventListener('click', (ev) => { ev.stopPropagation(); copyAll(); });

  const hideEl = document.createElement('button');
  hideEl.id = 'vepa-debug-hide';
  hideEl.className = 'vepa-debug-btn';
  hideEl.textContent = '✕';
  hideEl.title = 'Hide debug overlay';
  hideEl.addEventListener('click', (ev) => { ev.stopPropagation(); setDebugVisible(false); });

  header.append(dot, title, versionEl, countEl, statsEl, copyEl, hideEl);

  bodyEl = document.createElement('pre');
  bodyEl.id = 'vepa-debug-body';
  bodyEl.className = 'vepa-debug-body';

  overlayEl.append(header, bodyEl);

  // Tap anywhere on the header (not the buttons) to copy everything
  header.addEventListener('click', copyAll);
  renderBody();
}

/**
 * Initialize the debug overlay. Call at module load, before boot().
 */
export function initDebug() {
  // Adopt messages recorded by the inline probe (before modules loaded)
  const pre = window.__VEPA_DEBUG__;
  if (pre && Array.isArray(pre.messages)) {
    for (const m of pre.messages) {
      messages.push({ t: m.t || Date.now(), level: m.level || 'info', text: String(m.text) });
    }
  }
  if (pre) pre._active = true;

  ensureOverlay();

  // Capture runtime errors into the log (single source of truth)
  window.addEventListener('error', (e) => {
    logDebug('GLOBAL ERROR: ' + (e.error ? (e.error.stack || e.error.message || e.error) : (e.message || 'unknown')), 'error');
  });
  window.addEventListener('unhandledrejection', (e) => {
    logDebug('UNHANDLED REJECTION: ' + (e.reason ? (e.reason.stack || e.reason.message || e.reason) : 'unknown'), 'error');
  });

  logDebug('VEPA4 v' + APP_VERSION + ' — debug overlay active');
}
