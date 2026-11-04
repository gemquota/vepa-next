// ============================================================================
// VEPA4 — Chaos Multiplex Help & Tooltips
// Long-press any multiplex control (setup screen, drawer, metrics) for a
// quick description, or open the full-screen guide from the ? button in the
// controls drawer.
// ============================================================================

const TOOLTIP_ID = 'mpx-tooltip';
const HELP_OVERLAY_ID = 'mpx-help-overlay';
const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10; // px — cancels the long-press while dragging

/**
 * Descriptive help entries for every multiplex control. Each entry carries
 * the four-tier spirit of LAW_HELP_DB: title, hint (one line) and a longer
 * explanation. `section` groups entries in the full-screen guide.
 */
export const MULTIPLEX_HELP_DB = {
  // ── Setup screen ──
  grid: {
    section: 'setup',
    title: 'GRID',
    hint: 'How many concurrent simulations to run.',
    explanation: 'Columns × Rows (1×1 up to 4×4, max 16 shards). Each shard is an independent simulation derived from the selected one. More shards shrink the per-shard population cap on an inverse-square-root curve so the combined physics budget stays bounded.',
  },
  randomize: {
    section: 'setup',
    title: 'RANDOMIZE ASPECTS',
    hint: 'Which aspects get varied between shards.',
    explanation: 'Laws, DNA, Population and World Parameters can be randomized independently. Unchecking an aspect keeps it identical to the source across every shard — e.g. vary DNA only to explore behaviour with fixed laws, or disable Params to keep every shard in the same physics regime.',
  },
  variation: {
    section: 'setup',
    title: 'VARIATION',
    hint: 'Master divergence knob between shards.',
    explanation: 'How far each shard drifts from the source simulation. 0% produces identical clones; 100% produces wildly divergent futures. LAW VAR / DNA VAR / POP VAR / PARAM VAR scale this master knob per aspect.',
  },
  lawVar: {
    section: 'setup',
    title: 'LAW VAR',
    hint: 'Per-aspect multiplier on VARIATION for laws.',
    explanation: 'Controls how aggressively law toggles are randomized when shards are built. 0 blocks law randomization entirely; 1 applies the full master VARIATION strength.',
  },
  dnaVar: {
    section: 'setup',
    title: 'DNA VAR',
    hint: 'Per-aspect multiplier on VARIATION for DNA.',
    explanation: 'Controls how much each shard\u2019s species genomes mutate during derivation. 0 keeps genomes identical to the source; 1 applies the full master VARIATION strength.',
  },
  popVar: {
    section: 'setup',
    title: 'POP VAR',
    hint: 'Per-aspect multiplier on VARIATION for population.',
    explanation: 'Controls how much positions and velocities are jittered when a shard is derived. 0 keeps the population layout identical; 1 applies the full master VARIATION strength.',
  },
  paramVar: {
    section: 'setup',
    title: 'PARAM VAR',
    hint: 'Per-aspect multiplier on VARIATION for world parameters.',
    explanation: 'Controls how aggressively each shard\u2019s law-tuning knobs (the WORLD panel sliders: GLOBAL_G, TIDAL_SCALE, ACIDITY_PH, COULOMB_CONSTANT, …) are perturbed when the shard is derived. Each shard solves under its own parameter regime — a different gravity well, a different acid bath, a different quantum world. 0 keeps every knob identical to the source; 1 applies the full master VARIATION strength. The COMPARE tab\u2019s PARAMS row shows how many knobs each shard has drifted from the world you configured.',
  },
  derive: {
    section: 'setup',
    title: 'DERIVE',
    hint: 'How each shard gets its starting population.',
    explanation: 'CLONE copies positions, DNA and laws from the selected simulation, then applies variation. SPAWN builds a fresh, evenly distributed population grid while keeping the source DNA and laws.',
  },
  popScale: {
    section: 'setup',
    title: 'POP SCALE',
    hint: 'Scales the dynamic per-shard population cap.',
    explanation: 'A 0.25–1 multiplier on the per-shard population cap. Lower values make shards lighter and faster to simulate; the cap never drops below 250 particles per shard.',
  },
  seed: {
    section: 'setup',
    title: 'SEED',
    hint: 'Deterministic shard lineage.',
    explanation: '0 uses a random source seed every start. A value above 0 makes the shard lineage deterministic — the same seed reproduces the same derived shard set.',
  },
  substeps: {
    section: 'setup',
    title: 'SUBSTEPS',
    hint: 'Solver sub-steps per shard tick (1–8).',
    explanation: 'Each shard tick runs the solver this many times with a smaller time step. Higher substeps integrate physics more finely (stable fast worlds) but multiply the per-tick cost across every shard.',
  },
  spawnSpecies: {
    section: 'setup',
    title: 'SPAWN SPECIES',
    hint: 'Species count for freshly SPAWNED shard populations (1–5).',
    explanation: 'Used by the SPAWN derive mode when building a fresh, evenly distributed population. The species genomes come from the source DNA, but the grid starts with this many balanced species instead of copying the source layout. CLONE mode ignores it.',
  },
  // ── Iteration ──
  autoIterate: {
    section: 'iteration',
    title: 'AUTO-ITERATE',
    hint: 'Regenerate all shards on a fixed cadence.',
    explanation: 'Guided evolution on autopilot: every interval ticks, all shards are rebuilt from the selected shard with fresh seeds and variation. Combined with AFTER ITERATE, the multiplex keeps following the best future.',
  },
  interval: {
    section: 'iteration',
    title: 'EVERY',
    hint: 'Ticks between auto-iterations (50–2000).',
    explanation: 'The auto-iterate cadence. Smaller intervals churn generations quickly; larger intervals let each generation play out longer before being replaced.',
  },
  selectAfter: {
    section: 'iteration',
    title: 'AFTER ITERATE',
    hint: 'What selection happens after each iteration.',
    explanation: 'NONE keeps the current selection. FITTEST jumps to the shard with the highest weighted fitness. FOLLOW jumps to the shard whose metric profile is closest to the previous selection — the world that was on screen.',
  },
  keepSelected: {
    section: 'iteration',
    title: 'KEEP SELECTED',
    hint: 'Anchor the selected shard through regeneration.',
    explanation: 'When iterating, the selected shard is left untouched: its full view, DNA, laws and PRNG state are snapshotted before the rebuild and restored into the new grid, so your current world survives as a stable anchor.',
  },
  maxIters: {
    section: 'iteration',
    title: 'MAX ITERS',
    hint: 'Hard cap on auto-iterations (0 = unlimited).',
    explanation: 'Stops auto-iteration after this many generations. The grid keeps running; only the regeneration stops.',
  },
  drift: {
    section: 'iteration',
    title: 'DRIFT',
    hint: 'Evolutionary pressure per generation.',
    explanation: 'Each generation raises VARIATION by this amount (0–0.05, capped at 1), so later generations explore more broadly while early generations stay close to the source.',
  },
  // ── Runtime ──
  simSpeed: {
    section: 'runtime',
    title: 'SIM SPEED',
    hint: 'Timescale multiplier for the shard grid.',
    explanation: '0.25–3× effective simulation speed. The main sim is paused while the multiplex runs, so this only affects the shard grid.',
  },
  paused: {
    section: 'runtime',
    title: 'PAUSE GRID',
    hint: 'Freeze shard stepping.',
    explanation: 'Stops the physics loop for all shards while keeping the grid, camera and metrics interactive.',
  },
  eco: {
    section: 'runtime',
    title: 'GPU ECO',
    hint: 'Cheap preview rendering for the shard grid.',
    explanation: 'Skips the reference grid and soft-glow halos and renders at 1.25× device-pixel-ratio. Default on — the full-quality render is only worth the cost on the main sim, not 16 previews.',
  },
  importOnExit: {
    section: 'runtime',
    title: 'IMPORT ON EXIT',
    hint: 'Import the selected shard when leaving.',
    explanation: 'On exit, the selected shard\u2019s particles, species DNA and law state are copied into the main simulation, and the world resets its offspring/intelligence systems around them.',
  },
  // ── Fitness ──
  fitnessWeights: {
    section: 'fitness',
    title: 'FITNESS WEIGHTS',
    hint: '14 weighted metrics ranking the shards.',
    explanation: 'The weighted composite score drives FITTEST selection and the per-shard chips. When every weight is 0 the ranking falls back to population. MAX/MIN flips whether high or low values count as good for each metric.',
  },
  'metric-population': {
    section: 'fitness',
    title: 'POPULATION',
    hint: 'Living particle count.',
    explanation: 'The number of alive particles in the shard. The default tie-breaker when all weights are 0.',
  },
  'metric-growth': {
    section: 'fitness',
    title: 'GROWTH',
    hint: 'Alive-count change vs the previous tick.',
    explanation: 'Positive growth means the shard population is expanding; negative means it is shrinking.',
  },
  'metric-longevity': {
    section: 'fitness',
    title: 'LONGEVITY',
    hint: 'Mean age of living particles.',
    explanation: 'Older populations imply stable, long-lived organisms rather than constant turnover.',
  },
  'metric-stability': {
    section: 'fitness',
    title: 'STABILITY',
    hint: '1 − coefficient-of-variation² of the alive window.',
    explanation: 'A 0–1 score measuring how steady the population is over the rolling window — steady populations score 1, oscillating ones score low.',
  },
  'metric-energy': {
    section: 'fitness',
    title: 'ENERGY',
    hint: 'Mean metabolic energy of living particles.',
    explanation: 'Higher average energy suggests a thriving economy of life, not a starving dish.',
  },
  'metric-reserves': {
    section: 'fitness',
    title: 'RESERVES',
    hint: 'Mean stored energy (capacitance / fusion).',
    explanation: 'Averaged STORED_ENERGY across living particles — how much buffer the population carries for lean times.',
  },
  'metric-armor': {
    section: 'fitness',
    title: 'ARMOR',
    hint: 'Mean defense rating.',
    explanation: 'Average armor of living particles; armored populations survive predation and collisions better.',
  },
  'metric-mobility': {
    section: 'fitness',
    title: 'MOBILITY',
    hint: 'Mean speed (velocity magnitude).',
    explanation: 'How mobile the average particle is — fast populations explore more, slow ones settle.',
  },
  'metric-signal': {
    section: 'fitness',
    title: 'SIGNAL',
    hint: 'Mean pulse / signal strength.',
    explanation: 'Average SIGNAL across living particles; strong signals imply an active communication network.',
  },
  'metric-bonds': {
    section: 'fitness',
    title: 'BONDS',
    hint: 'Mean active bond count.',
    explanation: 'Average valence bonds per particle — bonded populations form structures and chains.',
  },
  'metric-diversity': {
    section: 'fitness',
    title: 'DIVERSITY',
    hint: 'Shannon evenness over the species present.',
    explanation: 'J = H / ln(S): 1 when species are perfectly balanced, 0 when a single species dominates.',
  },
  'metric-exploration': {
    section: 'fitness',
    title: 'EXPLORATION',
    hint: 'Spatial entropy over a 4×4×4 occupancy grid.',
    explanation: 'How spread out the population is across the world, normalized by the grid\u2019s bin count — colonizing species explore more cells.',
  },
  'metric-novelty': {
    section: 'fitness',
    title: 'NOVELTY',
    hint: 'Mean normalized genome distance vs the source DNA.',
    explanation: 'How far the shard\u2019s species genomes have drifted from the DNA it was derived from — 0 is identical, 1 is maximally divergent.',
  },
  'metric-delta': {
    section: 'fitness',
    title: 'DELTA',
    hint: 'Mean deviation from the other shards\u2019 scores.',
    explanation: 'A derived metric: how much this shard\u2019s profile differs from the rest. High delta = an outlier future worth watching.',
  },
  // ── Drawer & metrics ──
  drawer: {
    section: 'drawer',
    title: 'CONTROLS BAR',
    hint: 'Bottom bar with grid stats and the iterate/exit actions.',
    explanation: 'Collapse it with the ▼ button (a slim ⚡ strip remains). All live settings now live in the initial setup screen; this bar is for actions and state only.',
  },
  iterate: {
    section: 'drawer',
    title: '⚡ ITERATE',
    hint: 'Regenerate all shards from the selected shard now.',
    explanation: 'Rebuilds every shard from the selected one with fresh seeds and variation — one manual generation. KEEP SELECTED and AFTER ITERATE apply to it just like auto-iteration.',
  },
  exit: {
    section: 'drawer',
    title: '✕ EXIT',
    hint: 'Leave the multiplex.',
    explanation: 'Tears down the shard grid and returns to the main sim. With IMPORT ON EXIT on, the selected shard is imported into the main world first.',
  },
  help: {
    section: 'drawer',
    title: '? HELP',
    hint: 'Open the full-screen multiplex guide.',
    explanation: 'Shows every control with its description. You can also long-press any multiplex control for a quick tooltip.',
  },
  metrics: {
    section: 'drawer',
    title: 'METRICS',
    hint: 'Per-shard fitness chips + live stats bar.',
    explanation: 'Each chip shows a shard\u2019s weighted fitness (S01 0.74) — tap one to select it. The stats line shows ALIVE, CAP, ΔSEL, ΔAVG, ITER and MS (EMA-smoothed shard tick time).',
  },
};

/** Section order + labels for the full-screen guide. */
export const MULTIPLEX_HELP_SECTIONS = [
  { id: 'setup', label: 'SETUP' },
  { id: 'iteration', label: 'ITERATION' },
  { id: 'runtime', label: 'RUNTIME' },
  { id: 'fitness', label: 'FITNESS' },
  { id: 'drawer', label: 'DRAWER & METRICS' },
];

// ── Long-press tooltip ──────────────────────────────────────────────────────

let tooltipEl = null;
let timer = null;
let activeTarget = null;
let pressX = 0;
let pressY = 0;

function ensureTooltip() {
  if (tooltipEl) return tooltipEl;
  tooltipEl = document.createElement('div');
  tooltipEl.id = TOOLTIP_ID;
  tooltipEl.className = 'hidden';
  document.body.appendChild(tooltipEl);
  // The tooltip body is rebuilt per show; keep it out of pointer events so
  // long-press interactions underneath still register.
  tooltipEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  return tooltipEl;
}

/** Find the help entry for an event target (delegated). */
function helpEntryFor(el) {
  const node = el && el.closest ? el.closest('[data-mpx-help]') : null;
  if (!node) return null;
  const key = node.dataset.mpxHelp;
  return { key, node, entry: MULTIPLEX_HELP_DB[key] };
}

function showTooltip(el, key, entry) {
  const tip = ensureTooltip();
  tip.innerHTML = `
    <div class="mpx-tip-head">
      <span class="mpx-tip-title">${entry.title}</span>
      <span class="mpx-tip-actions">
        <button id="mpx-tooltip-guide" class="mpx-tip-guide" type="button" title="Full guide">GUIDE</button>
        <button id="mpx-tooltip-close" class="mpx-tip-close" type="button" title="Close">✕</button>
      </span>
    </div>
    <div class="mpx-tip-hint">${entry.hint}</div>
    <div class="mpx-tip-expl">${entry.explanation}</div>`;
  const closeBtn = tip.querySelector('#mpx-tooltip-close');
  const guideBtn = tip.querySelector('#mpx-tooltip-guide');
  closeBtn.addEventListener('click', hideTooltip);
  guideBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideTooltip();
    openMultiplexHelp();
  });
  tip.classList.remove('hidden');

  // Position: centered above the control, flipped below when near the top.
  const rect = el.getBoundingClientRect();
  const tipW = tip.offsetWidth || 260;
  const tipH = tip.offsetHeight || 120;
  let left = rect.left + rect.width / 2 - tipW / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
  let top = rect.top - tipH - 10;
  if (top < 8) top = rect.bottom + 10;
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
  activeTarget = el;
}

export function hideTooltip() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (tooltipEl) tooltipEl.classList.add('hidden');
  activeTarget = null;
}

/**
 * Wire long-press tooltips for every `[data-mpx-help]` element inside root.
 * Delegated, so dynamically built controls (e.g. fitness rows) work too.
 */
export function initMultiplexHelp(root = document.body) {
  root.addEventListener('pointerdown', (e) => {
    const hit = helpEntryFor(e.target);
    hideTooltip();
    if (!hit || !hit.entry) return;
    pressX = e.clientX;
    pressY = e.clientY;
    timer = setTimeout(() => {
      timer = null;
      showTooltip(hit.node, hit.key, hit.entry);
    }, LONG_PRESS_MS);
  });
  root.addEventListener('pointermove', (e) => {
    if (!timer) return;
    const dx = e.clientX - pressX;
    const dy = e.clientY - pressY;
    if (dx * dx + dy * dy > MOVE_TOLERANCE * MOVE_TOLERANCE) {
      clearTimeout(timer);
      timer = null;
    }
  });
  // Release after a long-press keeps the tooltip open; it closes on a new
  // press elsewhere, scroll, the ✕ button, or the GUIDE action.
  root.addEventListener('pointerup', () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  });
  root.addEventListener('pointercancel', () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  });
  document.addEventListener('scroll', hideTooltip, true);
}

// ── Full-screen guide ───────────────────────────────────────────────────────

let helpOverlay = null;

function ensureHelpOverlay() {
  if (helpOverlay) return helpOverlay;
  helpOverlay = document.createElement('div');
  helpOverlay.id = HELP_OVERLAY_ID;
  helpOverlay.className = 'hidden';
  helpOverlay.innerHTML = `
    <div class="mpx-help-panel">
      <div class="mpx-help-head">
        <span class="mpx-help-title">CHAOS MULTIPLEX GUIDE</span>
        <button id="mpx-help-close" class="mpx-btn mpx-icon" type="button" title="Close guide">✕</button>
      </div>
      <p class="mpx-help-sub">Long-press any multiplex control for a quick description, or browse every setting below.</p>
      <div class="mpx-help-sections" id="mpx-help-sections"></div>
    </div>`;
  document.body.appendChild(helpOverlay);
  helpOverlay.querySelector('#mpx-help-close').addEventListener('click', closeMultiplexHelp);
  helpOverlay.addEventListener('pointerdown', (e) => {
    if (e.target === helpOverlay) closeMultiplexHelp();
  });
  // Render sections once.
  const host = helpOverlay.querySelector('#mpx-help-sections');
  for (const section of MULTIPLEX_HELP_SECTIONS) {
    const entries = Object.entries(MULTIPLEX_HELP_DB).filter(([, e]) => e.section === section.id);
    if (!entries.length) continue;
    const block = document.createElement('div');
    block.className = 'mpx-help-section';
    block.innerHTML = `<div class="mpx-help-section-label">${section.label}</div>`;
    for (const [key, entry] of entries) {
      const item = document.createElement('div');
      item.className = 'mpx-help-item';
      item.dataset.mpxHelp = key;
      item.innerHTML = `
        <div class="mpx-help-item-title">${entry.title}</div>
        <div class="mpx-help-item-hint">${entry.hint}</div>
        <div class="mpx-help-item-expl">${entry.explanation}</div>`;
      block.appendChild(item);
    }
    host.appendChild(block);
  }
  return helpOverlay;
}

export function openMultiplexHelp() {
  const overlay = ensureHelpOverlay();
  overlay.classList.remove('hidden');
}

export function closeMultiplexHelp() {
  if (helpOverlay) helpOverlay.classList.add('hidden');
}

/** True when the full-screen guide is currently open. */
export function isMultiplexHelpOpen() {
  return !!(helpOverlay && !helpOverlay.classList.contains('hidden'));
}
