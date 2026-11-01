/**
 * VEPA v3 — Narrative / Log Panel
 * Scrollback display for narrative entries with voice-based coloring.
 * Newest entries render at the TOP (v8.1.1) and the panel autoscrolls to
 * keep the newest entry visible; caps at 100 entries (oldest trimmed).
 */

const MAX_ENTRIES = 100;

const VOICE_COLORS = {
  Stabilizer: 'var(--accent-blue)',
  Diverger:   'var(--accent-red)',
  Observer:   'var(--accent-green)',
  Dissolver:  'var(--accent-purple)',
};

const DEFAULT_VOICE_COLOR = 'var(--text-secondary)';

let container = null;
let entryCount = 0;

/**
 * Pin the container to the newest entry (top).
 */
function scrollToNewest() {
  if (container) container.scrollTop = 0;
}

/**
 * Append a single narrative entry to the top of the panel.
 * @param {{ voice?: string, text: string, timestamp?: number }} entry
 */
function appendEntry(entry) {
  if (!container) return;

  const voice = entry.voice || 'System';
  const color = VOICE_COLORS[voice] || DEFAULT_VOICE_COLOR;
  const ts = entry.timestamp
    ? new Date(entry.timestamp).toLocaleTimeString()
    : new Date().toLocaleTimeString();

  const div = document.createElement('div');
  div.className = 'narrative-entry';
  div.innerHTML = `<span class="narrative-voice" style="color:${color}">[${voice}]</span> `
                + `<span class="narrative-time">${ts}</span> `
                + `<span class="narrative-text">${escapeHtml(entry.text)}</span>`;

  // Newest on top. When the user is already reading near the newest entry
  // (pinned), autoscroll to keep it visible; otherwise preserve their
  // reading position as older entries are pushed down below the viewport.
  const wasPinned = container.scrollTop <= 24;
  const prevHeight = container.scrollHeight;
  container.prepend(div);
  entryCount++;

  // Trim oldest entries (bottom) if over cap
  while (entryCount > MAX_ENTRIES && container.lastChild) {
    container.removeChild(container.lastChild);
    entryCount--;
  }

  if (wasPinned) {
    scrollToNewest();
  } else {
    container.scrollTop += container.scrollHeight - prevHeight;
  }
}

/**
 * Escape HTML entities to prevent XSS from narrative text.
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Create the narrative panel in #narrative-panel.
 *
 * @param {import('../core/eventBus.js').EventBus} bus
 */
export function createNarrativePanel(bus) {
  const panel = document.getElementById('narrative-panel');
  if (!panel) return;

  // Build inner structure
  panel.innerHTML = `
    <div class="narrative-header">
      <span class="narrative-title">Narrative Log</span>
      <button id="narrative-clear-btn" class="narrative-clear-btn" title="Clear log">✕</button>
    </div>
    <div id="narrative-scroll" class="narrative-scroll"></div>
  `;

  container = document.getElementById('narrative-scroll');
  entryCount = 0;

  // Clear button
  document.getElementById('narrative-clear-btn')?.addEventListener('click', () => {
    if (container) {
      container.innerHTML = '';
      entryCount = 0;
    }
  });

  // Subscribe to narrative entries
  bus.on('narrative:entry', (entry) => {
    appendEntry(entry);
  });

  // Batch entries support
  bus.on('narrative:batch', (entries) => {
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        appendEntry(entry);
      }
    }
  });

  // System messages (no voice)
  bus.on('narrative:system', ({ text, timestamp } = {}) => {
    appendEntry({ voice: 'System', text: text || '', timestamp: timestamp || Date.now() });
  });
}
