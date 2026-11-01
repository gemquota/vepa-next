// ============================================================================
// VEPA4 — World States Panel (SAVES tab)
// Save / load / compare / export / import full world states, plus the
// toolbar quick-save (💾) and undo (⏪) buttons. The undo ring itself lives
// in main.js (world:undo / world:redo) — this panel is pure presentation and
// talks to it exclusively through the bus.
// ============================================================================

const WS_STYLES_ID = 'ws-styles';

function ensureStyles() {
  if (document.getElementById(WS_STYLES_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = WS_STYLES_ID;
  styleEl.textContent = `
    .ws-header { font-family: var(--font-mono); letter-spacing: 2px; color: var(--accent-red); font-size: 10px; padding: 8px 2px 4px; }
    .ws-sub { font-size: 9px; color: var(--text-secondary); letter-spacing: 1px; padding: 0 2px 6px; }
    .ws-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; flex-wrap: wrap; }
    .ws-row input[type="text"] { flex: 1; min-width: 90px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 3px; color: var(--text-primary); font-family: var(--font-mono); font-size: 10px; letter-spacing: 1px; padding: 5px 6px; }
    .ws-btn { background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 3px; color: var(--text-secondary); font-family: var(--font-mono); font-size: 9px; letter-spacing: 1px; cursor: pointer; padding: 5px 8px; }
    .ws-btn:hover:not(:disabled) { border-color: var(--accent-red); color: var(--accent-red); }
    .ws-btn:disabled { opacity: 0.35; cursor: default; }
    .ws-btn.primary { color: var(--accent-red); border-color: rgba(255,74,74,0.4); }
    .ws-check { display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 1px; color: var(--text-secondary); cursor: pointer; }
    .ws-status { font-family: var(--font-mono); font-size: 9px; letter-spacing: 1px; color: var(--text-secondary); min-height: 12px; }
    .ws-list { display: flex; flex-direction: column; gap: 3px; max-height: 240px; overflow-y: auto; border: 1px solid var(--border); border-radius: 4px; padding: 4px; margin: 6px 0; }
    .ws-item { display: flex; align-items: center; gap: 6px; font-size: 9px; letter-spacing: 1px; color: var(--text-secondary); padding: 4px 6px; border-radius: 3px; }
    .ws-item:hover { background: rgba(255,255,255,0.03); }
    .ws-item .ws-name { flex: 0 0 34%; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ws-item .ws-meta { flex: 1; font-size: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ws-item .ws-actions { display: flex; gap: 3px; }
    .ws-item .ws-actions button { background: none; border: 1px solid var(--border); border-radius: 3px; color: var(--text-secondary); font-size: 9px; cursor: pointer; padding: 2px 4px; }
    .ws-item .ws-actions button:hover { border-color: var(--accent-red); color: var(--accent-red); }
    .ws-empty { font-size: 9px; color: var(--text-secondary); letter-spacing: 1px; padding: 8px 4px; }
    .ws-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); display: flex; align-items: flex-start; justify-content: center; padding: 6vh 4vw; z-index: 1000; }
    .ws-overlay.hidden { display: none; }
    .ws-overlay-card { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 6px; max-width: 92vw; max-height: 88vh; overflow: auto; padding: 12px; }
    .ws-overlay-head { display: flex; align-items: center; justify-content: space-between; font-family: var(--font-mono); letter-spacing: 2px; color: var(--accent-red); font-size: 10px; padding-bottom: 8px; }
    .ws-overlay-close { background: none; border: 1px solid var(--border); border-radius: 3px; color: var(--text-secondary); cursor: pointer; font-size: 10px; padding: 2px 8px; }
    .ws-overlay-close:hover { border-color: var(--accent-red); color: var(--accent-red); }
    .ws-compare { border-collapse: collapse; width: 100%; font-size: 9px; }
    .ws-compare th, .ws-compare td { padding: 4px 8px; text-align: right; white-space: nowrap; font-family: var(--font-mono); letter-spacing: 1px; }
    .ws-compare thead th { color: var(--text-secondary); border-bottom: 1px solid var(--border); }
    .ws-compare tbody td:first-child { text-align: left; color: var(--text-secondary); }
    .ws-compare .best { color: var(--accent-red); font-weight: bold; background: rgba(255,74,74,0.10); }
  `;
  document.head.appendChild(styleEl);
}

function fmtTime(savedAt) {
  if (!savedAt) return '—';
  const d = new Date(savedAt);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtCount(v) {
  return Number.isFinite(v) ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)) : '—';
}

/** Download a text file (used for .vepa.json exports). */
export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function createSavePanel(bus) {
  const host = document.getElementById('saves-panel');
  if (!host) return null;
  ensureStyles();

  // ── Toolbar quick actions ──
  const saveBtn = document.getElementById('save-btn');
  const undoBtn = document.getElementById('undo-btn');
  const quickName = () => {
    const d = new Date();
    return `QUICK ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  if (saveBtn) saveBtn.addEventListener('click', () => {
    bus.emit('world:save', { name: quickName() });
    flashStatus('Saving…');
  });
  if (undoBtn) {
    undoBtn.addEventListener('click', () => bus.emit('world:undo'));
  }

  // ── Panel markup ──
  host.innerHTML = `
    <div class="ws-header">WORLD STATES</div>
    <div class="ws-sub">SAVE · LOAD · COMPARE · UNDO — full world snapshots</div>
    <div class="ws-row">
      <input id="ws-name" type="text" placeholder="Save name…" maxlength="40">
      <button id="ws-save" class="ws-btn primary">💾 SAVE</button>
    </div>
    <div class="ws-row">
      <button id="ws-undo" class="ws-btn" disabled>⏪ UNDO</button>
      <button id="ws-redo" class="ws-btn" disabled>⏩ REDO</button>
      <label class="ws-check" title="Snapshot the world before Chaos / Restart / Reset / preset load / species edits / world-param changes">
        <input id="ws-auto" type="checkbox" checked>AUTO
      </label>
      <span id="ws-status" class="ws-status"></span>
    </div>
    <div id="ws-list" class="ws-list"></div>
    <div class="ws-row">
      <button id="ws-compare-all" class="ws-btn" disabled>⇄ COMPARE ALL</button>
      <button id="ws-import" class="ws-btn">📂 IMPORT</button>
      <input id="ws-import-file" type="file" accept=".json,application/json" hidden>
    </div>
    <div id="ws-compare-overlay" class="ws-overlay hidden">
      <div class="ws-overlay-card">
        <div class="ws-overlay-head">
          <span>WORLD COMPARISON</span>
          <button class="ws-overlay-close" type="button">✕</button>
        </div>
        <div id="ws-compare-body"></div>
      </div>
    </div>`;

  const nameInput = host.querySelector('#ws-name');
  const statusEl = host.querySelector('#ws-status');
  const listEl = host.querySelector('#ws-list');
  const undoPanelBtn = host.querySelector('#ws-undo');
  const redoPanelBtn = host.querySelector('#ws-redo');
  const autoToggle = host.querySelector('#ws-auto');
  const compareAllBtn = host.querySelector('#ws-compare-all');
  const overlay = host.querySelector('#ws-compare-overlay');
  const overlayBody = host.querySelector('#ws-compare-body');
  let lastSaves = [];

  const flashStatus = (text, isError = false) => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = isError ? 'var(--accent-red)' : '';
    clearTimeout(statusEl._t);
    statusEl._t = setTimeout(() => { statusEl.textContent = ''; }, 2500);
  };

  // ── Actions ──
  host.querySelector('#ws-save').addEventListener('click', () => {
    const name = (nameInput.value || '').trim();
    if (!name) {
      nameInput.focus();
      flashStatus('NAME REQUIRED', true);
      return;
    }
    bus.emit('world:save', { name });
  });
  undoPanelBtn.addEventListener('click', () => bus.emit('world:undo'));
  redoPanelBtn.addEventListener('click', () => bus.emit('world:redo'));
  autoToggle.addEventListener('change', () => {
    bus.emit('world:toggleAutoUndo', { enabled: autoToggle.checked });
  });
  compareAllBtn.addEventListener('click', () => {
    bus.emit('world:compare', { names: lastSaves.map((s) => s.name) });
  });
  host.querySelector('#ws-import').addEventListener('click', () => {
    host.querySelector('#ws-import-file').click();
  });
  host.querySelector('#ws-import-file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => bus.emit('world:import', { json: String(reader.result || '') });
    reader.readAsText(file);
    e.target.value = '';
  });
  overlay.querySelector('.ws-overlay-close').addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });

  // ── Render the save list ──
  function renderList(saves) {
    lastSaves = saves || [];
    if (!lastSaves.length) {
      listEl.innerHTML = '<div class="ws-empty">No saved worlds yet — name one above and hit SAVE.</div>';
    } else {
      listEl.innerHTML = lastSaves.map((s) => {
        const meta = s.summary || {};
        const alive = meta.alive != null ? `ALIVE ${meta.alive}` : `N ${s.particleCount || 0}`;
        const sp = meta.species != null ? `SP ${meta.species}` : `SP ${s.speciesCount || 0}`;
        const laws = meta.lawsOn != null ? `LAWS ${meta.lawsOn}` : '';
        return `<div class="ws-item">
          <span class="ws-name" title="${s.name}">${s.name}</span>
          <span class="ws-meta">${fmtTime(s.savedAt)} · ${alive} · ${sp}${laws ? ' · ' + laws : ''}</span>
          <span class="ws-actions">
            <button data-load="${s.name}" title="Load this world">📂</button>
            <button data-compare="${s.name}" title="Compare vs live">⇄</button>
            <button data-export="${s.name}" title="Export .vepa.json">⬇</button>
            <button data-del="${s.name}" title="Delete">🗑</button>
          </span>
        </div>`;
      }).join('');
      listEl.querySelectorAll('[data-load]').forEach((b) => {
        b.addEventListener('click', () => bus.emit('world:load', { name: b.dataset.load }));
      });
      listEl.querySelectorAll('[data-compare]').forEach((b) => {
        b.addEventListener('click', () => bus.emit('world:compare', { names: [b.dataset.compare] }));
      });
      listEl.querySelectorAll('[data-export]').forEach((b) => {
        b.addEventListener('click', () => bus.emit('world:export', { name: b.dataset.export }));
      });
      listEl.querySelectorAll('[data-del]').forEach((b) => {
        b.addEventListener('click', () => {
          if (window.confirm(`Delete world “${b.dataset.del}”?`)) bus.emit('world:remove', { name: b.dataset.del });
        });
      });
    }
    compareAllBtn.disabled = lastSaves.length < 1;
  }

  // ── Render the compare matrix ──
  function renderCompare(matrix) {
    if (!matrix || !matrix.rows || !matrix.columns) return;
    const fmt = (v) => (Number.isFinite(v) ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)) : '—');
    overlayBody.innerHTML = `
      <table class="ws-compare">
        <thead><tr>
          <th></th>
          ${matrix.columns.map((c) => `<th>${c}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${matrix.rows.map((row) => `
            <tr>
              <td title="${row.key} (${row.mode})">${row.key.toUpperCase()}</td>
              ${row.values.map((v, i) => {
                const best = i === row.bestId ? ' class="best"' : '';
                return `<td${best}>${fmt(v)}</td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>`;
    overlay.classList.remove('hidden');
  }

  // ── Bus wiring ──
  bus.on('world:listResponse', ({ saves }) => renderList(saves));
  bus.on('world:saved', ({ name, ok, error }) => {
    flashStatus(ok ? `Saved “${name}”` : `Save failed: ${error || 'storage error'}`, !ok);
  });
  bus.on('world:loaded', ({ name }) => flashStatus(`Loaded “${name}”`));
  bus.on('world:imported', ({ ok, error }) => {
    flashStatus(ok ? 'Imported world' : `Import failed: ${error}`, !ok);
  });
  bus.on('world:exported', ({ name, json }) => {
    downloadTextFile(`${name.replace(/[^a-z0-9-_ ]/gi, '_').trim() || 'world'}.vepa.json`, json);
    flashStatus(`Exported “${name}”`);
  });
  bus.on('world:compareResponse', ({ matrix }) => renderCompare(matrix));
  bus.on('world:undoState', ({ canUndo, canRedo, enabled }) => {
    undoPanelBtn.disabled = !canUndo;
    redoPanelBtn.disabled = !canRedo;
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (autoToggle && enabled !== undefined && autoToggle.checked !== enabled) autoToggle.checked = enabled;
  });

  // Initial list + undo state.
  bus.emit('world:list');
  bus.emit('world:undoState', { canUndo: false, canRedo: false, enabled: true });
  return { refresh: () => bus.emit('world:list') };
}
