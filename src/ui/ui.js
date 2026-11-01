/**
 * VEPA v3 — Main UI Orchestrator (v2 parity)
 * Initializes all UI panels, wires up tab switching, toolbar controls,
 * and keyboard shortcuts. Called from main.js after boot.
 */
import { createHUD } from './hud.js';
import { createWorldPanel } from './worldPanel.js';
import { createIntelPanel } from './intelPanel.js';
import { createSpeciesPanel } from './speciesPanel.js';
import { createDNAAnalytics } from './dnaAnalytics.js';
import { createNarrativePanel } from './narrativePanel.js';
import { createGroupAnalytics } from './groupAnalytics.js';
import { createEcoPanel } from './ecoPanel.js';
import { createPresetPanel } from './presetPanel.js';
import { createSavePanel } from './savePanel.js';
import { createSettingsPanel } from './settingsPanel.js';
import { initTooltip } from './tooltip.js';
import { resetCamera } from './camera.js';

/**
 * Initialize the full UI layer.
 */
export function initUI(bus, lawStateObj, dnaBuffer) {
  setupTabSwitching();
  setupDrawerMinimize();
  setupDrawerHideShow();
  setupDrawerResize();
  setupDrawerZoom();
  setupDrawerSwipe();
  setupToolbarControls(bus);
  setupKeyboardShortcuts(bus);

  createHUD(bus);
  createWorldPanel(bus, lawStateObj);
  createIntelPanel(bus);
  createSpeciesPanel(bus, dnaBuffer);
  createDNAAnalytics(bus);
  createNarrativePanel(bus);
  createGroupAnalytics(bus);
  createEcoPanel(bus);
  createPresetPanel(bus);
  createSavePanel(bus);
  createSettingsPanel(bus, lawStateObj);
  initTooltip(bus, lawStateObj);
}

export function setupTabSwitching() {
  // Only real tabs carry a data-tab — the drawer's zoom/hide/minimize buttons
  // share the .tab-btn class and must not be treated as tabs (that used to
  // strip the active tab and leave the drawer blank on expand).
  document.querySelectorAll('#main-panel .tab-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#main-panel .tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('#main-panel .tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  // Sub-tabs (e.g. DATA > INTELLIGENCE | DNA | LOGS)
  document.querySelectorAll('#main-panel .sub-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.tab-content');
      if (!parent) return;
      parent.querySelectorAll('.sub-tab-btn').forEach((b) => b.classList.remove('active'));
      parent.querySelectorAll('.sub-tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.sub);
      if (target) target.classList.add('active');
    });
  });
}

/** Shared drawer state — minimize/expand/hide all keep the active tab intact. */
function minimizeDrawer(drawer) {
  drawer.classList.add('minimized');
  drawer.classList.remove('hidden');
  // Clear the custom resize height while minimized, restore it on expand
  drawer.dataset.prevHeight = drawer.style.height || '';
  drawer.style.height = '';
  drawer.style.maxHeight = '';
  const btn = document.getElementById('drawer-minimize-btn');
  if (btn) {
    btn.textContent = '▔';
    btn.title = 'Expand drawer';
    btn.setAttribute('aria-expanded', 'false');
  }
  const showBtn = document.getElementById('drawer-show-btn');
  if (showBtn) showBtn.hidden = true;
}

function expandDrawer(drawer) {
  drawer.classList.remove('hidden', 'minimized');
  if (drawer.dataset.prevHeight) {
    drawer.style.height = drawer.dataset.prevHeight;
    drawer.style.maxHeight = drawer.dataset.prevHeight;
  }
  const btn = document.getElementById('drawer-minimize-btn');
  if (btn) {
    btn.textContent = '▁';
    btn.title = 'Minimize drawer';
    btn.setAttribute('aria-expanded', 'true');
  }
  const showBtn = document.getElementById('drawer-show-btn');
  if (showBtn) showBtn.hidden = true;
  ensureActiveTab();
}

/** If no drawer tab is active (stale state), re-activate the setup tab. */
function ensureActiveTab() {
  if (document.querySelector('#main-panel .tab-content.active')) return;
  let tab = 'tab-setup';
  const activeBtn = document.querySelector('#main-panel .tab-btn.active[data-tab]');
  if (activeBtn) tab = activeBtn.dataset.tab;
  const btn = document.querySelector(`#main-panel .tab-btn[data-tab="${tab}"]`);
  const content = document.getElementById(tab);
  if (btn) btn.classList.add('active');
  if (content) content.classList.add('active');
}

export function setupDrawerMinimize() {
  const drawer = document.getElementById('drawer-container');
  const btn = document.getElementById('drawer-minimize-btn');
  if (!drawer || !btn) return;
  btn.addEventListener('click', () => {
    if (drawer.classList.contains('minimized')) expandDrawer(drawer);
    else minimizeDrawer(drawer);
  });
}

/** Drag the top edge handle to resize the drawer height. */
let drawerResizeActive = false;
function setupDrawerResize() {
  const drawer = document.getElementById('drawer-container');
  const handle = document.getElementById('drawer-resize-handle');
  if (!drawer || !handle) return;
  let dragging = false;
  let startY = 0;
  let startH = 0;
  handle.addEventListener('pointerdown', (e) => {
    drawerResizeActive = true;
    dragging = true;
    startY = e.clientY;
    startH = drawer.getBoundingClientRect().height;
    handle.classList.add('dragging');
    e.preventDefault();
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const h = Math.max(90, Math.min(window.innerHeight * 0.92, startH + (startY - e.clientY)));
    drawer.style.height = h + 'px';
    drawer.style.maxHeight = h + 'px';
  });
  window.addEventListener('pointerup', () => {
    drawerResizeActive = false;
    dragging = false;
    handle.classList.remove('dragging');
  });
}

/** − / + buttons in the drawer tabs scale the drawer content. */
function setupDrawerZoom() {
  const panel = document.getElementById('main-panel');
  const minus = document.getElementById('drawer-zoom-out');
  const plus = document.getElementById('drawer-zoom-in');
  if (!panel || !minus || !plus) return;
  let zoom = 1.0;
  const apply = () => { panel.style.zoom = zoom.toFixed(2); };
  minus.addEventListener('click', () => { zoom = Math.max(0.6, zoom - 0.1); apply(); });
  plus.addEventListener('click', () => { zoom = Math.min(1.6, zoom + 0.1); apply(); });
}

/** Swipe the drawer tabs or its top edge up to expand, down to minimize. */
export function setupDrawerSwipe() {
  const drawer = document.getElementById('drawer-container');
  const zones = document.querySelectorAll('#main-panel .tabs, #drawer-resize-handle');
  if (!drawer || zones.length === 0) return;
  let startY = null;
  let startX = null;
  let dragging = false;
  const down = (e) => {
    if (drawerResizeActive) return;
    startY = e.clientY;
    startX = e.clientX;
    dragging = false;
  };
  const move = (e) => {
    if (startY == null) return;
    if (Math.abs(e.clientY - startY) > 12) dragging = true;
  };
  const up = (e) => {
    if (startY == null) return;
    const dy = e.clientY - startY;
    const dx = e.clientX - startX;
    startY = null;
    if (!dragging || Math.abs(dy) < 24 || Math.abs(dy) < Math.abs(dx)) return;
    if (dy < 0) expandDrawer(drawer);
    else minimizeDrawer(drawer);
  };
  const cancel = () => { startY = null; };
  zones.forEach((zone) => {
    zone.addEventListener('pointerdown', down);
    zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', cancel);
  });
}

function closeDrawer(drawer) {
  drawer.classList.add('hidden');
  const showBtn = document.getElementById('drawer-show-btn');
  if (showBtn) showBtn.hidden = false;
}

export function setupDrawerHideShow() {
  const drawer = document.getElementById('drawer-container');
  const hideBtn = document.getElementById('drawer-hide-btn');
  const showBtn = document.getElementById('drawer-show-btn');
  if (!drawer || !hideBtn || !showBtn) return;
  hideBtn.addEventListener('click', () => {
    drawer.classList.add('hidden');
    showBtn.hidden = false;
    resetCamera();
  });
  showBtn.addEventListener('click', () => {
    expandDrawer(drawer);
    resetCamera();
  });
}

function setupToolbarControls(bus) {
  const playPauseBtn = document.getElementById('play-pause-btn');
  const restartBtn = document.getElementById('restart-btn');
  const hardResetBtn = document.getElementById('hard-reset-btn');
  const chaosBtn = document.getElementById('chaos-btn');
  const chaosMultiplexBtn = document.getElementById('chaos-multiplex-btn');
  const helpToggle = document.getElementById('help-toggle');

  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => bus.emit('sim:togglePause'));
  }
  if (restartBtn) {
    restartBtn.addEventListener('click', () => bus.emit('sim:restart'));
  }
  if (hardResetBtn) {
    hardResetBtn.addEventListener('click', () => bus.emit('sim:hardReset'));
  }
  if (chaosBtn) {
    let chaosPressTimer = null;
    chaosBtn.addEventListener('pointerdown', () => {
      chaosPressTimer = setTimeout(() => {
        chaosPressTimer = null;
        if (typeof window.openChaosMultiplex === 'function') window.openChaosMultiplex();
      }, 600);
    });
    chaosBtn.addEventListener('pointerup', () => {
      if (chaosPressTimer) {
        clearTimeout(chaosPressTimer);
        chaosPressTimer = null;
        // Short click = randomize first, then restart on a fresh population
        // (restart preserves the randomized laws + DNA)
        bus.emit('sim:chaos');
        bus.emit('sim:restart', { preserveLaws: true, preserveDNA: true });
      }
    });
    chaosBtn.addEventListener('pointerleave', () => {
      if (chaosPressTimer) {
        clearTimeout(chaosPressTimer);
        chaosPressTimer = null;
      }
    });
  }
  if (chaosMultiplexBtn) {
    chaosMultiplexBtn.addEventListener('click', () => {
      if (typeof window.openChaosMultiplex === 'function') window.openChaosMultiplex();
    });
  }
  if (helpToggle) {
    helpToggle.addEventListener('click', () => bus.emit('help:toggle'));
  }
  bus.on('sim:paused', ({ paused }) => {
    if (playPauseBtn) {
      playPauseBtn.textContent = paused ? '▶' : '⏸';
      playPauseBtn.classList.toggle('active', !paused);
    }
  });
}

function setupKeyboardShortcuts(bus) {
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        bus.emit('sim:togglePause');
        break;
      case 'r':
      case 'R':
        if (e.shiftKey) { bus.emit('sim:hardReset'); }
        else { bus.emit('sim:restart'); }
        break;
      case '1': case '2': case '3': case '4': case '5': {
        const tabIdx = parseInt(e.key, 10) - 1;
        const tabs = document.querySelectorAll('#main-panel .tab-btn');
        if (tabs[tabIdx]) tabs[tabIdx].click();
        break;
      }
      default: break;
    }
  });
}


function showChaosMenu(bus) {
  var old = document.getElementById("chaos-menu");
  if (old) old.remove();
  var cats = [
    { id: "physics", label: "PHYS" },
    { id: "biology", label: "BIOL" },
    { id: "chemistry", label: "CHEM" },
    { id: "thermodynamics", label: "THERMO" },
    { id: "metaphysics", label: "META" }
  ];
  var menu = document.createElement("div");
  menu.id = "chaos-menu";
  menu.className = "chaos-menu";
  var html = "<div class=\"chaos-menu-content\">";
  html += "<div class=\"chaos-menu-title\">CHAOS CONTROL</div>";
  html += "<div class=\"chaos-menu-cats\">";
  for (var i = 0; i < cats.length; i++) {
    html += "<label class=\"chaos-cat-row\"><input type=\"checkbox\" data-cat=\"" + cats[i].id + "\" checked><span>" + cats[i].label + "</span></label>";
  }
  html += "</div>";
  html += "<div class=\"chaos-menu-actions\">";
  html += "<button class=\"chaos-btn-action\" data-action=\"randomize\">RANDOMIZE</button>";
  html += "<button class=\"chaos-btn-action\" data-action=\"clear\">CLEAR ALL</button>";
  html += "<button class=\"chaos-btn-action\" data-action=\"close\">CLOSE</button>";
  html += "</div></div>";
  menu.innerHTML = html;
  document.body.appendChild(menu);
  menu.querySelectorAll(".chaos-btn-action").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var action = btn.dataset.action;
      if (action === "close") { menu.remove(); return; }
      if (action === "clear") { bus.emit("sim:chaosClear"); menu.remove(); return; }
      if (action === "randomize") {
        var checked = [];
        menu.querySelectorAll("input[type=\"checkbox\"]:checked").forEach(function(cb) {
          checked.push(cb.dataset.cat);
        });
        bus.emit("sim:chaosSelective", { categories: checked });
        menu.remove();
      }
    });
  });
  menu.addEventListener("click", function(e) {
    if (e.target === menu) menu.remove();
  });
}
