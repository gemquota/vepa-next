#!/usr/bin/env node
/**
 * VEPA4 — full hierarchical codebase concatenation generator.
 * Walks a snapshot dir, produces a TOC + per-file analysis preface + source.
 * Usage: node .dist/gen-full.mjs <snapshot-dir> <out-file>
 */
import fs from 'node:fs';
import path from 'node:path';

const [snap, outFile] = process.argv.slice(2);
const ROOT = path.resolve(snap);
const OUT = path.resolve(outFile);

const EXCLUDE_DIRS = new Set(['node_modules', '.git', '.dist', '.rsirrp', '.shots', 'docs', 'audit-suite']);
const EXCLUDE_FILES = new Set();
const MD_SUFFIX = '.md'; // docs live in vepa-docs-concat.md

function isBinary(p) {
  const fd = fs.openSync(p, 'r');
  const buf = Buffer.alloc(8192);
  const n = fs.readSync(fd, buf, 0, 8192, 0);
  fs.closeSync(fd);
  return n > 0 && buf.subarray(0, n).includes(0);
}

function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, e.name);
    const rel = path.join(base, e.name).split(path.sep).join('/');
    if (e.isDirectory()) {
      if (!EXCLUDE_DIRS.has(e.name)) out.push(...walk(full, rel));
    } else if (!EXCLUDE_FILES.has(rel) && !rel.endsWith(MD_SUFFIX)) {
      out.push(rel);
    }
  }
  return out;
}

const all = walk(ROOT);
const linesOf = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').split('\n').length;

// ── per-file analysis ────────────────────────────────────────────────────────
const reImports = /import\s+(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]\s*;?/g;
const reExportDecl = /export\s+(?:default\s+)?(?:const|let|var|function|class|async\s+function)\s+(\w+)/g;
const reExportList = /export\s*\{([\s\S]*?)\};/g;
const reDecl = /^(?:export\s+)?(?:const|let|var|function|class)\s+(\w+)/gm;
const reDescribe = /describe\(['"]([^'"]+)['"]/g;
const reIt = /\bit\(['"]([^'"]+)['"]/g;

function docblockFirst(src) {
  const m = src.match(/\/\*\*([\s\S]*?)\*\//) || src.match(/\/\*([\s\S]*?)\*\//) || src.match(/^(\/\/[^\n]*\n){1,6}/);
  if (!m) return '';
  return m[1].split('\n').map((l) => l.replace(/^\s*\* ?/, '').replace(/^\s*\/\//, '')).map((l) => l.trim()).filter(Boolean).slice(0, 6).join(' ');
}

function analyzeJs(rel, src) {
  const imports = [];
  let m;
  reImports.lastIndex = 0;
  while ((m = reImports.exec(src)) !== null) {
    const names = (m[1] || '').replace(/[{}*]/g, '').split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean);
    imports.push({ from: m[2], names: names.length ? names : ['*'] });
  }
  const exports = new Set();
  reExportDecl.lastIndex = 0;
  while ((m = reExportDecl.exec(src)) !== null) exports.add(m[1]);
  reExportList.lastIndex = 0;
  while ((m = reExportList.exec(src)) !== null) {
    for (const s of m[1].split(',')) {
      const t = s.trim();
      if (t) exports.add(t.split(/\s+as\s+/).pop());
    }
  }
  const decls = [];
  reDecl.lastIndex = 0;
  while ((m = reDecl.exec(src)) !== null) if (!decls.includes(m[1])) decls.push(m[1]);
  return { imports, exports: [...exports], decls: decls.slice(0, 16), purpose: docblockFirst(src) };
}

function analyzeTest(rel, src) {
  const describes = [];
  let m;
  reDescribe.lastIndex = 0;
  while ((m = reDescribe.exec(src)) !== null) describes.push(m[1]);
  let its = 0;
  reIt.lastIndex = 0;
  while (reIt.exec(src) !== null) its++;
  return { describes, its };
}

// curated notes for the major modules
const NOTES = {
  'src/constants.js': 'Single source of truth for the whole sim: the 100-float particle stride layout (STRIDE_INDEXES), 64 DNA params (DNA_INDEXES/DNA_RANGES/DNA_META), the 128-law bitmask indexes + 8 category bands (LAW_CATEGORIES/LAW_SPECTRUM/LAW_HUE_BY_INDEX), the 4-tier LAW_HELP_DB, LAW_DEPENDENCIES/LAW_SUBGROUPS, and world constants (WORLD_SIZE, MAX_PARTICLES, RHO_REF, ADIABATIC_GAMMA_MINUS_ONE). Everything in src/ imports from here; the bitmask discipline forbids hardcoding law indices.',
  'src/core/prng.js': 'SplitMix32 — the ONLY PRNG used for simulation-critical randomness (convention: never Math.random). next() returns uint32; nextFloat(lo,hi) maps to a range. Deterministic seeds keep tests/bench reproducible.',
  'src/core/eventBus.js': 'Tiny decoupled pub/sub event bus (on/off/emit). UI and orchestrator communicate through it (law:toggled, etc.) so modules stay independent.',
  'src/debug.js': 'On-canvas debug overlay + structured log buffer. Imports package.json#version so the overlay header tracks the release marker (DEBUG v7.0.0).',
  'src/main.js': 'Application orchestrator: builds the particle world + species DNA, wires the physics worker bridge (sendToWorker/onmessage), owns the render/animate loop, law shuffling, spawn distribution, presets, HUD/debug wiring, and the Chaos Multiplex controller (incl. copyShardToWorld on exit).',
  'src/state/lawState.js': '128-bit law state as 4×Uint32Array words (low/high/ext/quad). Helpers: set/clear/toggle/isSet/getActiveCount/getStateVector/serialize/deserialize + unmetDependencies/dependenciesSatisfied (law gating via LAW_DEPENDENCIES).',
  'src/state/worldParams.js': 'WORLD_PARAM_DEFS SSOT (25 params: SPACE/PHYSICS/ENVIRONMENT/BIOLOGY groups with subgroups) + createWorldParams/applyWorldParam/clampWorldParam/spawnCaps. The WORLD panel renders directly from these defs; the solver reads them via runtimeConfig.worldParams.',
  'src/state/runtimeConfig.js': 'Mutable runtime singleton: worldParams (live values), particleCount, worldSize, etc. Shared module instance across main thread modules; the solver reads law state + params through it.',
  'src/state/particleBuffer.js': 'Float32Array factory + stride-safe getters/setters (getX/setVelocity/getDNA/...). createParticleBuffer(maxParticles, stride) zero-fills a SharedArrayBuffer-backed view; isAlive/kill gate lifecycle.',
  'src/state/defaultPresets.js': 'Named law presets (e.g. PRIME_DEFAULT) as law-name arrays; feeds the law set bar and the bench harness DEFAULT_LAWS.',
  'src/state/presetManager.js': 'localStorage-backed save/load/delete of custom law presets + UI helper for the law-set dropdown.',
  'src/dna/dnaBuffer.js': 'Species genome buffer: Uint16Array(64 species × 64 params). getDNAFloat/setDNAFloat pack/unpack normalized floats vs PACK_MAX, loadDefaults seeds from DNA_RANGES, mutateSpecies applies range-clamped mutation with the provided PRNG.',
  'src/dna/expression.js': 'DNA expression helpers: maps the genome onto per-particle cache/colors (hue/sat/lightness from POLARITY/ALPHA/SYMMETRY) used by PHENOTYPE.',
  'src/physics/solver.js': 'The physics tick: spatial-grid build, pairwise law dispatch (100+ force/state functions from laws.js + 8 lawgroups), integration with MAX_FORCE/MAX_VELOCITY clamps, lifecycle (LIFE/REPRO/offspring ring drain), NaN shields, TIME_DILATION neighbour snapshot, WAVE_MEASURED flag writes. Signature: solve(particleView, particleCount, stride, lawState, dnaBuffer, worldSize, dt, prng).',
  'src/physics/laws.js': 'The large per-law implementation module (GRAV/COLL/ACCR/PLANETARY/LIFE/REPRO/ENERGY/HISTORY/SINGULARITY/...), plus shared helpers: hslToRgb, readSpeciesDNAParam/writeSpeciesDNAParam, the 12³ HISTORY field with centre-of-mass scan, worldParams() accessor, setBuffer wiring. Stateless per call — module-level mutable state is limited to the history field + buffer ref.',
  'src/physics/lawgroups/physicsLaws.js': 'Category law file (Physics): TIDE/FRICTION/ELASTICITY/TURBULENCE/CENTRIPETAL/ROTATION as stateless force functions returning {ax,ay,az}; clamped + NaN-guarded.',
  'src/physics/lawgroups/thermoLaws.js': 'Thermodynamics lawgroup: ADIABATIC/COMPRESSION/EXPANSION/EQUILIBRIUM/LATENT_HEAT/RUNAWAY (temperature/density dynamics).',
  'src/physics/lawgroups/biologyLaws.js': 'Biology lawgroup: SYMBIOSIS/PARASITE/HIBERNATION/IMMUNITY (life-cycle interactions).',
  'src/physics/lawgroups/chemistryLaws.js': 'Chemistry lawgroup: ELECTROLYSIS/PHOTOLYSIS/PRECIPITATION/NEUTRALIZATION/STOICHIOMETRY/AUTOCATALYSIS (law-RRP revised: electrolysis scales with CONDUCTIVITY, etc.).',
  'src/physics/lawgroups/emLaws.js': 'Electromagnetism lawgroup: ANTENNA/SHIELDING/POLARIZATION.',
  'src/physics/lawgroups/infoLaws.js': 'Information lawgroup: NAVIGATION/ENCRYPTION (keyed carrier from TUNING_CH1-4, law-RRP).',
  'src/physics/lawgroups/metaLaws.js': 'Metaphysics lawgroup: CONSCIOUSNESS/PERCEPTION/SYNCHRONICITY (predictive self-model, law-RRP).',
  'src/physics/lawgroups/quantumLaws.js': 'Quantum lawgroup: SUPERPOSITION/TUNNELING/DECOHERENCE/WAVE_PARTICLE/UNCERTAINTY/TELEPORT/OBSERVER/PLANCK/COHERENCE/BOSONIC/FERMIONIC/SPIN/SPECTRAL/WAVEFUNCTION/HYPERPLANE/ANTIMATTER (heavily law-RRP revised).',
  'src/physics/spatialGrid.js': '12×12×12 uniform spatial grid: insert + getNeighbors with toroidal wrap; bounds the pair loop to the neighborhood (MAX_INTERACTIONS).',
  'src/physics/synergy.js': 'Law synergy: computeSynergy(lawState, lawIndex) returns [0.0, 2.0] multipliers (e.g. GRAV+PLANETARY ×1.5); createSynergyCache snapshots per-tick.',
  'src/spawn/distribution.js': 'Initial population placement: buildSpawnCentres (clustered/golden-angle), sampleSpawnPosition (shape/bias), initialPopulationTarget + perSpeciesAllocation (split across species).',
  'src/render/renderer.js': 'PixiJS 8 renderer (fallback Canvas2D): world layer, background painting, particle sprite rendering, resize/DPR handling, GPU-eco mode.',
  'src/render/spriteSync.js': 'Syncs PixiJS sprites from the particle buffer each frame: position/color/radius/alpha from stride fields; batch updates for GPU efficiency.',
  'src/worker/physics.worker.js': 'Web Worker entry: owns the SharedArrayBuffer physics loop, speaks the {type,...} message protocol (INIT/CONFIG/TOGGLE_LAW/TICK/GET_STATE/RESTORE/PING) with lawState + dnaBuffer copies.',
  'src/ui/ui.js': 'UI bootstrap: builds the setup drawer tabs (LAWS/WORLD/SPECIES/SETTINGS), HUD, multiplex chaos button, camera, and wires the event bus.',
  'src/ui/worldPanel.js': 'WORLD tab: law grid (icon/list views, category bands, toggles), law-set preset bar, and the accordion world-param sliders rendered from WORLD_PARAM_DEFS.',
  'src/ui/lawPanel.js': 'LAWS tab law toggle grid (8 category sections, multi-state WRAP cycling) with active styling.',
  'src/ui/tooltip.js': 'Law info bar (#law-info-module) above the law grid: icon/name/category + LAW_HELP_DB hint/explanation/system + ON/OFF toggle + close.',
  'src/ui/speciesPanel.js': 'SPECIES tab: species list management (add/remove), per-species color, DNA slider rows from DNA_RANGES with live value binding.',
  'src/ui/dnaPanel.js': 'Species genome editor accordion: groups DNA params (physics/matter/em/biology/communication/genetics) with sliders.',
  'src/ui/dnaAnalytics.js': 'Species breakdown + trait profiles + genetic distance views over the genome buffer.',
  'src/ui/settingsPanel.js': 'SETTINGS tab: camera config, debug controls, law panel mount, misc toggles.',
  'src/ui/intelPanel.js': 'INTEL panel: timeline scrubber, lineage/generation readouts, narrative feed.',
  'src/ui/narrativePanel.js': 'Narrative log panel fed by the narrative engine.',
  'src/ui/presetPanel.js': 'Preset save/load UI for law sets (dropdown + save/delete).',
  'src/ui/hud.js': 'Heads-up display: particle/species/fps/population stats updated per frame via updateHUD().',
  'src/ui/camera.js': 'Shared pan/zoom/rotate camera with pinch/pointer gestures; multiplex shards share one camera object.',
  'src/engines/goalEngine.js': 'Goal engine: tracks a current value toward a target and exposes progress (used by insight/goal HUD).',
  'src/engines/insightEngine.js': 'Insight engine: derives readable observations from sim state for the INTEL panel.',
  'src/engines/lineageTracker.js': 'Lineage tracker: birth/death events, generation counting, species lineage graphs.',
  'src/engines/narrativeEngine.js': 'Narrative engine: turns sim events into story beats (text log lines) for the narrative panel.',
  'src/engines/timelineEngine.js': 'Timeline engine: snapshot/scrub/clear of world state history for the INTEL scrubber.',
  'src/multiplex/multiplex.js': 'Chaos Multiplex controller: shard grid (up to 16), per-shard particles/DNA/laws, variation, auto-iterate cadence, fitness scoring (REPRO/ENERGY/longevity), select/fittest/follow, copyShardToWorld export.',
  'src/multiplex/multiplexUI.js': 'Multiplex UI: setup modal (all launch settings incl. SPAWN SPECIES), bottom controls drawer, metrics bar, iterate/exit wiring, lastConfig retention on reopen.',
  'src/multiplex/multiplexHelp.js': 'MULTIPLEX_HELP_DB (title/hint/explanation tiers) + 500ms long-press tooltip system + full-screen guide overlay.',
  'index.html': 'App shell: drawer structure (LAWS/WORLD/SPECIES/SETTINGS sub-tabs), law-info module host, canvas host, script module wiring.',
  'style.css': 'Neon-noir design system: CSS custom properties, scanlines, .bolt corners, law hues (--law-h), multiplex tooltip/guide styles, law info module sizing.',
  'package.json': 'VEPA4 manifest: ESM, vite/vitest/playwright/pixi deps, scripts, version 7.0.0.',
  'vite.config.js': 'Vite config: base /vepa/vepar/ for Pages (or / when VERCEL=1), COOP/COEP dev headers for SharedArrayBuffer, worker format es.',
  'vitest.config.js': 'Vitest config: node env, tests/**/*.test.js include, 15s timeout.',
  'vercel.json': 'Vercel static build + COOP/COEP headers for SharedArrayBuffer.',
  'vepa4': 'Bash launcher: dev|build|preview|test|syntax|bench (+ optional port); wraps npm scripts; default dev port 5180.',
  'bench/solver.bench.mjs': 'Headless solver benchmark: table/per-law (--laws)/stress (--all)/JSON modes; builds synthetic worlds, medians ms/tick over frozen snapshots.',
  'exports/generate-concat.mjs': 'Regenerates vepa-codebase-concat.mjs: bundles the 20-module headless core into one self-contained file via __define/__import registry.',
  'exports/generate-docs-concat.mjs': 'Regenerates vepa-docs-concat.md: merges all markdown docs + VERSION/package.json metadata with a TOC.',
  'exports/vepa-codebase-concat.mjs': 'Generated artifact — the 20-module headless core concatenation (byte-identical regeneration verified).',
  'exports/README.md': 'Exports directory guide (md — documented in the docs concatenation).',
};

// ── build ────────────────────────────────────────────────────────────────────
const langOf = (rel) => {
  if (rel.endsWith('.html')) return 'html';
  if (rel.endsWith('.css')) return 'css';
  if (rel.endsWith('.json')) return 'json';
  if (rel.endsWith('.sh') || rel === 'vepa4') return 'bash';
  if (rel.endsWith('.mjs') || rel.endsWith('.js')) return 'js';
  if (rel.endsWith('.yml') || rel.endsWith('.yaml')) return 'yaml';
  return 'text';
};

const parts = [];
const binaries = [];
const textFiles = [];

for (const rel of all) {
  const abs = path.join(ROOT, rel);
  if (isBinary(abs)) { binaries.push(rel); continue; }
  textFiles.push(rel);
}

const totalLines = textFiles.reduce((n, r) => n + linesOf(r), 0);

// Hierarchical TOC
const tree = {};
for (const rel of textFiles) {
  const seg = rel.split('/');
  let node = tree;
  for (const s of seg.slice(0, -1)) node = (node[s] ||= {});
  node[seg[seg.length - 1]] = rel;
}

function renderToc(node, depth) {
  const keys = Object.keys(node).sort((a, b) => (typeof node[a] === 'string') - (typeof node[b] === 'string') || a.localeCompare(b));
  let html = '';
  for (const k of keys) {
    if (typeof node[k] === 'string') {
      const rel = node[k];
      const note = (NOTES[rel] || '').split('.')[0] || describeAuto(rel);
      html += `${'  '.repeat(depth)}- \`${rel}\` (${linesOf(rel)} lines) — ${note}\n`;
    } else {
      html += `${'  '.repeat(depth)}**${k}/**\n${renderToc(node[k], depth + 1)}`;
    }
  }
  return html;
}

function describeAuto(rel) {
  if (rel.startsWith('tests/')) return 'test file';
  return 'source/config file';
}

parts.push(`# VEPA4 — Full Hierarchical Codebase Concatenation

**Generated:** ${new Date().toISOString().slice(0, 10)} · **Source snapshot:** \`backup/pre-master-switch-20260811\` (v4 root layout, 7.0.0 draft) · **Files:** ${textFiles.length} text + ${binaries.length} binary assets · **Total lines:** ${totalLines.toLocaleString()}
**Scope:** every non-documentation file of the VEPA4 codebase. Markdown docs were moved to \`exports/vepa-docs-concat.md\` per the docs-consolidation decision; binary assets are listed in the TOC with descriptions (not embedded).

## Table of Contents

${renderToc(tree, 0)}

${binaries.length ? `## Binary Assets (listed, not embedded)\n${binaries.map((b) => `- \`${b}\``).join('\n')}\n` : ''}
`);

for (const rel of textFiles) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const lines = src.split('\n').length;
  const lang = langOf(rel);
  const note = NOTES[rel] || '';
  const a = rel.endsWith('.js') || rel.endsWith('.mjs') ? analyzeJs(rel, src) : null;
  const t = rel.startsWith('tests/') && rel.endsWith('.js') ? analyzeTest(rel, src) : null;

  parts.push(`---

## \`${rel}\` (${lines} lines)

### Analysis
${note ? `**Notes:** ${note}\n` : ''}${a ? `**Purpose:** ${a.purpose || '(none in docblock)'}\n**Imports:** ${a.imports.length ? a.imports.map((i) => `${i.from}${i.names.length ? ` {${i.names.join(', ')}}` : ''}`).join(' · ') : 'none'}\n**Exports:** ${a.exports.length ? a.exports.join(', ') : 'none'}\n**Top-level symbols:** ${a.decls.length ? a.decls.join(', ') : '(none)'}\n` : ''}${t ? `**Tests:** ${t.describes.length ? t.describes.join(' / ') : '(no describe blocks)'} — ${t.its} test cases\n` : ''}${rel.endsWith('.json') ? '**Type:** JSON data/configuration (validated by the toolchain).\n' : ''}${rel === 'vepa4' ? '**Type:** POSIX shell launcher.\n' : ''}

### Source

\`\`\`\`${lang}
${src.replace(/\s+$/, '\n')}
\`\`\`\`
`);
}

fs.writeFileSync(OUT, parts.join('\n'));
console.log('wrote', OUT, `(${(fs.statSync(OUT).size / 1024).toFixed(0)} KB, ${textFiles.length} files + ${binaries.length} assets)`);
