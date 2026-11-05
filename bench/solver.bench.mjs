// ============================================================================
// VEPA4 — Headless Solver Benchmark (Node.js, ESM)
// Generates per-law timing data for the benchmark report SPA.
//
// Usage:
//   node bench/solver.bench.mjs              # full report (scaling + matrix + sweeps + per-law)
//   node bench/solver.bench.mjs --laws       # per-law timing only (default count=5000)
//   node bench/solver.bench.mjs --all        # everything + per-law at each scaling point
//   node bench/solver.bench.mjs --json       # JSON output (no data.js)
//   node bench/solver.bench.mjs --count 10000 --rounds 3
//
// Outputs to public/bench-report/data.js (window.BENCH_DATA = {…})
// ============================================================================

import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Dynamic imports for the solver (Node.js ESM) ──

// We need to import the solver's benchmark-mode exports.
// The solver uses browser globals (SharedArrayBuffer, performance) — we
// polyfill what's needed.
if (typeof globalThis.SharedArrayBuffer === 'undefined') {
  globalThis.SharedArrayBuffer = ArrayBuffer;
}
if (typeof globalThis.performance === 'undefined') {
  globalThis.performance = { now: () => Date.now() };
}

const { solve, enableBenchMode, getLawTimings, getLastTickUs, drainOffspring, resetOffspringRing } = await import('../src/physics/solver.js');
const { createLawState, set, clear, serialize } = await import('../src/state/lawState.js');
const { runtimeConfig } = await import('../src/state/runtimeConfig.js');
const { PARTICLE_STRIDE, LAW_COUNT, LAW_INDEXES, LAW_CATEGORIES, LAW_HELP_DB, WORLD_SIZE, MAX_PARTICLES, DNA_COUNT, DNA_INDEXES, DNA_RANGES, DEFAULT_DNA_STRIDE } = await import('../src/constants.js');
const { SplitMix32 } = await import('../src/core/prng.js');

// ── CLI args ──

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const num = (name, fallback) => {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? Number(args[idx + 1]) : fallback;
};

const LAWS_ONLY = flag('--laws');
const ALL = flag('--all');
const JSON_OUT = flag('--json');
const DEFAULT_COUNT = LAWS_ONLY ? 5000 : (ALL ? 5000 : 5000);
const COUNT = num('--count', DEFAULT_COUNT);
const ROUNDS = num('--rounds', 3);
const BUDGET = num('--budget', 500); // ms per measurement
// The per-law leave-one-out sweep compares every law against the full 128-law
// tick (≈214 ms/tick at 5k particles), so it runs at a lower particle count to
// keep regeneration time sane. Recorded in the report as `perLawCount`.
const PER_LAW_COUNT = num('--perlaw-count', 2000);
// Custom scaling ladder: --scales 500,1000,1500,... (overrides the default).
const SCALES = (() => {
  const idx = args.indexOf('--scales');
  if (idx < 0 || !args[idx + 1]) return null;
  const list = args[idx + 1].split(',').map(Number)
    .filter((n) => Number.isFinite(n) && n > 0 && n <= MAX_PARTICLES)
    .sort((a, b) => a - b);
  return list.length ? list : null;
})();
// FPS floor: each scaling profile stops once it falls below this frame rate
// (default 15 fps) — larger points add no useful real-time data.
const FPS_FLOOR = num('--fps-floor', 15);

// ── Default 10-law set (matches PRIME_DEFAULT) ──

const DEFAULT_LAWS = [
  'GRAV', 'DRAG', 'ENTR', 'WRAP', 'COLL', 'LIFE', 'GLOW', 'REPRO', 'PHENOTYPE', 'GENOTYPE'
];

// ── Particle buffer factory ──

function createParticleBuffer(count) {
  const buf = new Float32Array(count * PARTICLE_STRIDE);
  const rng = new SplitMix32(42);
  for (let i = 0; i < count; i++) {
    const base = i * PARTICLE_STRIDE;
    // Position: spread across the world
    buf[base + 0] = rng.nextFloat(0, WORLD_SIZE);
    buf[base + 1] = rng.nextFloat(0, WORLD_SIZE);
    buf[base + 2] = rng.nextFloat(0, WORLD_SIZE);
    // Velocity: small random
    buf[base + 3] = rng.nextFloat(-1, 1);
    buf[base + 4] = rng.nextFloat(-1, 1);
    buf[base + 5] = rng.nextFloat(-1, 1);
    // Mass: 0.5–3.0
    buf[base + 6] = rng.nextFloat(0.5, 3.0);
    // Species ID
    buf[base + 7] = Math.floor(rng.nextFloat(0, 5));
    // DNA cache: fill with random normalized values
    for (let d = 0; d < 42; d++) {
      buf[base + 8 + d] = rng.nextFloat(0, 1);
    }
    // Energy
    buf[base + 50] = rng.nextFloat(20, 80);
    // AGE
    buf[base + 51] = 0;
    // DEAD
    buf[base + 52] = 0;
    // COLOR
    buf[base + 53] = rng.nextFloat(0.3, 1);
    buf[base + 54] = rng.nextFloat(0.3, 1);
    buf[base + 55] = rng.nextFloat(0.3, 1);
    // RADIUS
    buf[base + 56] = 1.0 + buf[base + 6] * 0.5;
    // SIGNAL
    buf[base + 57] = rng.nextFloat(0, 0.5);
    // TEMPERATURE
    buf[base + 66] = rng.nextFloat(20, 30);
    // CHARGE
    buf[base + 67] = rng.nextFloat(-1, 1);
  }
  return buf;
}

function createDnaBuffer() {
  const buf = new Uint16Array(MAX_PARTICLES * 0 + DNA_COUNT * DNA_COUNT); // 64×64
  // Fill with defaults
  for (let s = 0; s < DNA_COUNT; s++) {
    for (let d = 0; d < DNA_COUNT; d++) {
      const range = DNA_RANGES[d];
      const def = range ? range[2] : 0.5;
      // Pack to uint16 (0–65535)
      buf[s * DNA_COUNT + d] = Math.round((def / (range ? range[1] : 1)) * 65535) || 32768;
    }
  }
  return buf;
}

// ── Law state builder ──

function buildLawState(lawNames) {
  const state = createLawState();
  for (const name of lawNames) {
    const idx = LAW_INDEXES[name];
    if (idx !== undefined) set(state, idx);
  }
  return state;
}

// ── Warm-up + measurement ──

function warmUp(count, lawState, dnaBuffer, rounds = 5) {
  const buf = createParticleBuffer(count);
  const splitmix = new SplitMix32(123);
  const rng = () => splitmix.next();
  for (let r = 0; r < rounds; r++) {
    solve(buf, count, PARTICLE_STRIDE, lawState, dnaBuffer, WORLD_SIZE, 1.0, rng);
    resetOffspringRing();
  }
}

function measure(count, lawState, dnaBuffer, budgetMs = BUDGET) {
  const buf = createParticleBuffer(count);
  const splitmix = new SplitMix32(456);
  const rng = () => splitmix.next();
  enableBenchMode(true);

  // Warm up
  for (let r = 0; r < 3; r++) {
    solve(buf, count, PARTICLE_STRIDE, lawState, dnaBuffer, WORLD_SIZE, 1.0, rng);
    resetOffspringRing();
  }

  // Measure
  const timings = [];
  const lawTimings = new Float64Array(LAW_COUNT);
  const tStart = performance.now();
  let ticks = 0;

  while (performance.now() - tStart < budgetMs) {
    solve(buf, count, PARTICLE_STRIDE, lawState, dnaBuffer, WORLD_SIZE, 1.0, rng);
    resetOffspringRing();
    ticks++;

    // Accumulate law timings
    const lt = getLawTimings();
    for (let l = 0; l < LAW_COUNT; l++) {
      lawTimings[l] += lt[l];
    }
  }

  enableBenchMode(false);
  const totalMs = performance.now() - tStart;
  const msPerTick = totalMs / ticks;

  return {
    count,
    bufferMB: +(count * PARTICLE_STRIDE * 4 / 1048576).toFixed(1),
    msPerTick: +msPerTick.toFixed(3),
    ticksPerSec: +(1000 / msPerTick).toFixed(2),
    usPerParticle: +(msPerTick * 1000 / count).toFixed(2),
    ticks,
    totalMs: +totalMs.toFixed(1),
    lawTimingsUs: Array.from(lawTimings).map(t => +(t / ticks).toFixed(2)), // avg µs/law/tick
  };
}

function measureTickUs(count, lawState, dnaBuffer, ticks = 5, warmup = 3) {
  const buf = createParticleBuffer(count);
  const splitmix = new SplitMix32(789);
  const rng = () => splitmix.next();
  enableBenchMode(true);

  // Warm up
  for (let r = 0; r < warmup; r++) {
    solve(buf, count, PARTICLE_STRIDE, lawState, dnaBuffer, WORLD_SIZE, 1.0, rng);
    resetOffspringRing();
  }

  // Average over several measured ticks to damp JIT/deopt noise and the
  // single-tick variance that made some alone-runs (GRAV/DRAG) look 2-4×
  // slower than the 10-law set.
  let tickSum = 0;
  const lawSum = new Float64Array(LAW_COUNT);
  for (let t = 0; t < ticks; t++) {
    solve(buf, count, PARTICLE_STRIDE, lawState, dnaBuffer, WORLD_SIZE, 1.0, rng);
    tickSum += getLastTickUs();
    const lt = getLawTimings();
    for (let l = 0; l < LAW_COUNT; l++) lawSum[l] += lt[l];
    resetOffspringRing();
  }

  enableBenchMode(false);
  return {
    tickUs: +(tickSum / ticks).toFixed(2),
    lawUs: Array.from(lawSum).map(t => +(t / ticks).toFixed(2)),
  };
}

// Run the same solver entry point in a real worker_threads worker. This is
// deliberately separate from the browser worker bridge: it measures the
// worker's solver time and the request/response wall time without pretending
// that a main-thread tick is non-blocking.
function measureWorker(count, lawState, ticks = Math.max(3, ROUNDS)) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const worker = new Worker(new URL('./worker-bench-worker.mjs', import.meta.url), { type: 'module' });
    const finish = (error, value) => {
      worker.terminate();
      if (error) reject(error); else resolve(value);
    };
    worker.once('message', (value) => {
      const roundTripUs = (performance.now() - started) * 1000 / ticks;
      finish(null, {
        count,
        ticks,
        solverUs: value.solverUs,
        roundTripUs: +roundTripUs.toFixed(2),
        mainBlockedUs: 0,
        workerOverheadUs: +Math.max(0, roundTripUs - value.solverUs).toFixed(2),
        msPerTick: +(value.solverUs / 1000).toFixed(3),
        ticksPerSec: +(1000000 / value.solverUs).toFixed(2),
      });
    });
    worker.once('error', (error) => finish(error));
    worker.postMessage({ count, lawState: serialize(lawState), ticks });
  });
}

async function workerScalingSweep(counts, lawState) {
  const results = [];
  for (const count of counts) {
    process.stderr.write(`  Worker scaling N=${count.toLocaleString()}...`);
    const result = await measureWorker(count, lawState);
    results.push(result);
    process.stderr.write(` ${result.msPerTick.toFixed(1)} ms/tick solver, ${result.roundTripUs.toFixed(0)} µs round-trip\n`);
    if (result.msPerTick > 1000 / FPS_FLOOR) break;
  }
  return results;
}

// ── Scaling sweep ──

function scalingSweep(counts, lawNames) {
  return scalingSweepState(counts, buildLawState(lawNames));
}

function scalingSweepState(counts, lawState) {
  const dnaBuffer = createDnaBuffer();
  const results = [];
  for (const count of counts) {
    process.stderr.write(`  Scaling N=${count.toLocaleString()}...`);
    const r = measure(count, lawState, dnaBuffer);
    results.push(r);
    process.stderr.write(` ${r.msPerTick.toFixed(1)} ms/tick\n`);
    if (r.msPerTick > 1000 / FPS_FLOOR) break;
  }
  return results;
}

// ── Per-law sweep (baseline = ALL 128 laws) ──

function all128State() {
  const st = buildLawState([]);
  for (let i = 0; i < LAW_COUNT; i++) set(st, i);
  return st;
}

function lawNameOf(index) {
  return Object.entries(LAW_INDEXES).find(([, v]) => v === index)?.[0] || `LAW_${index}`;
}

function perLawSweep(count) {
  const dnaBuffer = createDnaBuffer();
  const results = [];

  // Baseline: the full 128-law tick — the reference every law is measured
  // against. The leave-one-out runs below share this code path, so a single
  // warm-up tick is enough for them.
  const all128 = all128State();
  process.stderr.write(`  ALL 128 laws (baseline)...`);
  const allResult = measureTickUs(count, all128, dnaBuffer, 2, 3);
  process.stderr.write(` ${allResult.tickUs} µs\n`);
  results.push({ law: 'ALL_128', tickUs: allResult.tickUs, lawUs: allResult.lawUs });

  // Per law: (a) alone (full tick, only this law) and (b) leave-one-out
  // (all 128 minus this law). The ablation triple is recorded explicitly:
  //   soloUs       — full tick with ONLY this law enabled
  //   withoutUs    — full 128-law tick with this law REMOVED
  //   marginalUs   — ALL_128 − withoutUs (the law's marginal cost)
  //   pctMarginal  — marginalUs / ALL_128 × 100
  // Rows overlap (laws interact — removing several at once saves less than the
  // sum of individual removals), so they intentionally do not sum to 100%.
  for (let i = 0; i < LAW_COUNT; i++) {
    const name = lawNameOf(i);

    const aloneState = buildLawState([]);
    set(aloneState, i);
    const alone = measureTickUs(count, aloneState, dnaBuffer, 1, 2);

    const minusState = all128State();
    clear(minusState, i);
    const minus = measureTickUs(count, minusState, dnaBuffer, 2, 1);

    const marginalUs = Math.max(0, allResult.tickUs - minus.tickUs);
    process.stderr.write(`  Law ${name}... alone ${alone.tickUs.toFixed(0)} µs, without ${minus.tickUs.toFixed(0)} µs, Δ ${marginalUs.toFixed(1)} µs\n`);
    results.push({
      law: name,
      tickUs: alone.tickUs,               // legacy alias of soloUs
      soloUs: +alone.tickUs.toFixed(2),   // full tick with ONLY this law (standalone)
      withoutUs: +minus.tickUs.toFixed(2),// 128-law tick minus this law
      marginalUs: +marginalUs.toFixed(2), // ALL_128 − withoutUs
      pctMarginal: +((marginalUs / allResult.tickUs) * 100).toFixed(2),
      lawUs: alone.lawUs,
    });
  }

  // Zero laws (freeze)
  const noState = buildLawState([]);
  process.stderr.write(`  Zero laws (freeze)...`);
  const noResult = measureTickUs(count, noState, dnaBuffer, 1, 2);
  process.stderr.write(` ${noResult.tickUs} µs\n`);
  results.push({ law: 'ZERO_LAWS', tickUs: noResult.tickUs, lawUs: noResult.lawUs });

  return results;
}

// ── MAX_INTERACTIONS × NEIGHBOR_BUF matrix + knob sweeps (default 10-law set) ──

const MATRIX_NBUF = [128, 256, 512, 1024, 2048, 4096];
const MATRIX_MAXINT = [50, 100, 250, 500, 1000, 2000];

function matrixSweep(count) {
  const dnaBuffer = createDnaBuffer();
  const base = buildLawState(DEFAULT_LAWS);
  const rows = [];
  for (const neighbors of MATRIX_NBUF) {
    const cells = [];
    for (const interactions of MATRIX_MAXINT) {
      const st = buildLawState(DEFAULT_LAWS);
      setWorldKnobs({ NEIGHBOR_BUF: neighbors, MAX_INTERACTIONS: interactions });
      const r = measure(count, st, dnaBuffer, 120);
      cells.push({ interactions, msPerTick: r.msPerTick });
    }
    rows.push({ neighbors, cells });
  }
  setWorldKnobs({}); // restore defaults
  return rows;
}

const SWEEP_RANGES = {
  gridDim: [6, 8, 10, 12, 16, 24, 32, 48, 64],
  cellCap: [10, 25, 50, 100, 200, 500],
  maxInteractions: [25, 50, 100, 250, 500, 1000, 2000, 4000],
  neighborBuf: [24, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384],
};

function sweepKnob(count, knob, values) {
  const dnaBuffer = createDnaBuffer();
  const results = [];
  for (const value of values) {
    setWorldKnobs({ [knob]: value });
    const st = buildLawState(DEFAULT_LAWS);
    const mins = [], maxs = [], mids = [];
    for (let r = 0; r < 3; r++) {
      const res = measure(count, st, dnaBuffer, 120);
      mins.push(res.msPerTick); maxs.push(res.msPerTick); mids.push(res.msPerTick);
    }
    results.push({
      value,
      msPerTick: +((mids[0] + mids[1] + mids[2]) / 3).toFixed(3),
      minMs: +Math.min(...mins).toFixed(3),
      maxMs: +Math.max(...maxs).toFixed(3),
    });
    process.stderr.write(`  ${knob}=${value} → ${results[results.length - 1].msPerTick} ms/tick\n`);
  }
  setWorldKnobs({});
  return results;
}

// Write performance knobs into runtimeConfig.worldParams (solver reads live).
// Accepts either the SPA sweep keys (gridDim/cellCap/maxInteractions/neighborBuf)
// or the runtime UPPER_SNAKE keys; AUTO_TUNE stays at its default (on) unless
// explicitly set.
const KNOB_KEY_MAP = {
  gridDim: 'GRID_DIM', cellCap: 'CELL_CAP',
  maxInteractions: 'MAX_INTERACTIONS', neighborBuf: 'NEIGHBOR_BUF',
  GRID_DIM: 'GRID_DIM', CELL_CAP: 'CELL_CAP',
  MAX_INTERACTIONS: 'MAX_INTERACTIONS', NEIGHBOR_BUF: 'NEIGHBOR_BUF',
};
function setWorldKnobs(knobs) {
  const wp = runtimeConfig.worldParams || (runtimeConfig.worldParams = {});
  // Apply the knobs this call is varying…
  for (const [key, runtimeKey] of Object.entries(KNOB_KEY_MAP)) {
    if (knobs[key] !== undefined) wp[runtimeKey] = knobs[key];
  }
  // …and drop every other knob back to its default so each measurement is
  // isolated (worldParams is per-process in the bench, so this is safe).
  const set = new Set(Object.values(KNOB_KEY_MAP));
  for (const key of Object.keys(knobs)) set.delete(KNOB_KEY_MAP[key]);
  for (const runtimeKey of set) delete wp[runtimeKey];
}

// ── Main ──

async function main() {
  console.error(`VEPA4 Solver Benchmark`);
  console.error(`  Particles: ${COUNT.toLocaleString()} | Rounds: ${ROUNDS} | Budget: ${BUDGET}ms`);
  console.error();

  const lawState = buildLawState(DEFAULT_LAWS);
  const dnaBuffer = createDnaBuffer();

  // Scaling — default 10-law set AND the full 128-law config
  let scalingData, scalingAllData, workerScalingData, workerScalingAllData;
  if (!LAWS_ONLY) {
    console.error('─ Scaling sweep (default 10 laws) ─');
    // Start at the requested 1k scale and stop each profile once it falls
    // below the FPS floor (default 15 fps; --fps-floor to override); larger
    // points add no useful real-time data.
    const counts = SCALES || [1000, 2500, 5000, 10000, 25000, 50000, 100000].filter(c => c <= MAX_PARTICLES);
    scalingData = scalingSweep(counts, DEFAULT_LAWS);
    console.error();

    console.error('─ Scaling sweep (worker, default 10 laws) ─');
    workerScalingData = await workerScalingSweep(counts, lawState);
    console.error();

    console.error('─ Scaling sweep (all 128 laws) ─');
    const all128 = all128State();
    scalingAllData = scalingSweepState(counts, all128);
    console.error();

    console.error('─ Scaling sweep (worker, all 128 laws) ─');
    workerScalingAllData = await workerScalingSweep(counts, all128);
    console.error();
  }

  // Per-law timing vs the ALL-128 baseline (at the lower per-law count)
  console.error(`─ Per-law timing (vs ALL 128 laws, N=${PER_LAW_COUNT.toLocaleString()}) ─`);
  const perLawData = perLawSweep(PER_LAW_COUNT);
  console.error();

  // Per-law at each scaling point (if --all)
  let scalingPerLaw = null;
  if (ALL) {
    console.error('─ Per-law at scaling points (vs ALL 128, N=1000/5000/10000/50000) ─');
    const counts = [1000, 5000, 10000, 50000].filter(c => c <= MAX_PARTICLES);
    scalingPerLaw = {};
    for (const count of counts) {
      process.stderr.write(`  N=${count.toLocaleString()}:\n`);
      scalingPerLaw[count] = perLawSweep(count);
    }
    console.error();
  }

  // Matrix + knob sweeps (default 10-law set, report count)
  let matrixData, gridDimData, cellCapData, maxIntData, nbufData;
  if (!LAWS_ONLY) {
    console.error('─ MAX_INTERACTIONS × NEIGHBOR_BUF matrix ─');
    matrixData = matrixSweep(COUNT);
    console.error();
    console.error('─ Knob sweeps ─');
    gridDimData = sweepKnob(COUNT, 'gridDim', SWEEP_RANGES.gridDim);
    console.error();
    cellCapData = sweepKnob(COUNT, 'cellCap', SWEEP_RANGES.cellCap);
    console.error();
    maxIntData = sweepKnob(COUNT, 'maxInteractions', SWEEP_RANGES.maxInteractions);
    console.error();
    nbufData = sweepKnob(COUNT, 'neighborBuf', SWEEP_RANGES.neighborBuf);
    console.error();
  }

  // Build category map
  const categories = {};
  for (const [cat, info] of Object.entries(LAW_CATEGORIES)) {
    for (const idx of info.laws) {
      const name = Object.entries(LAW_INDEXES).find(([k, v]) => v === idx)?.[0] || `LAW_${idx}`;
      categories[name] = { category: cat, color: info.color, index: idx };
    }
  }

  // Build the output
  const output = {
    generatedAt: new Date().toISOString(),
    regeneratedBy: 'node bench/solver.bench.mjs',
    solver: {
      particleStride: PARTICLE_STRIDE,
      lawCount: LAW_COUNT,
      worldSize: WORLD_SIZE,
      defaultLawCount: DEFAULT_LAWS.length,
      defaultLaws: DEFAULT_LAWS,
      workerMode: 'SharedArrayBuffer / deterministic request-response',
    },
    reportParams: { count: COUNT, perLawCount: PER_LAW_COUNT, rounds: ROUNDS, budget: BUDGET },
    baseline: {
      GRID_DIM: 12,
      CELL_CAP: 100,
      MAX_INTERACTIONS: 500,
      NEIGHBOR_BUF: 2000,
    },
    categories,
    perLaw: perLawData.map(r => {
      const allTick = perLawData.find(d => d.law === 'ALL_128')?.tickUs || 1;
      return {
        law: r.law,
        tickUs: r.tickUs,
        // Explicit ablation triple (see perLawSweep): solo / without / Δ.
        soloUs: r.soloUs ?? null,
        withoutUs: r.withoutUs ?? (r.law !== 'ALL_128' && r.law !== 'ZERO_LAWS' && r.marginalUs != null ? +(allTick - r.marginalUs).toFixed(2) : null),
        // % of the full 128-law tick attributable to this law — computed from
        // the leave-one-out marginal cost (ALL_128 − 128-without-law), not the
        // standalone tick, so it stays within [0, 100] and rows sum to ≤100%.
        marginalUs: r.marginalUs ?? null,
        pctMarginal: r.pctMarginal ?? (r.marginalUs != null ? +((r.marginalUs / allTick) * 100).toFixed(2) : null),
        pctOfTotal: r.marginalUs !== undefined && r.law !== 'ZERO_LAWS' && r.law !== 'ALL_DEFAULT' && r.law !== 'ALL_128'
          ? +(r.marginalUs / allTick * 100).toFixed(2)
          : null,
        lawUs: r.lawUs,
      };
    }),
  };

  if (scalingData) output.scaling = scalingData;
  if (scalingAllData) output.scalingAll = scalingAllData;
  if (workerScalingData) output.workerScaling = workerScalingData;
  if (workerScalingAllData) output.workerScalingAll = workerScalingAllData;
  if (scalingPerLaw) output.scalingPerLaw = scalingPerLaw;
  if (matrixData) output.matrix = matrixData;
  if (gridDimData) output.gridDim = gridDimData;
  if (cellCapData) output.cellCap = cellCapData;
  if (maxIntData) output.maxInteractions = maxIntData;
  if (nbufData) output.neighborBuf = nbufData;

  if (JSON_OUT) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    const outPath = resolve(ROOT, 'public/bench-report/data.js');
    const content = `// AUTO-GENERATED by \`node bench/solver.bench.mjs\` — do not edit by hand.\nwindow.BENCH_DATA = ${JSON.stringify(output, null, 2)};\n`;
    writeFileSync(outPath, content, 'utf8');
    console.error(`\n✓ Written to ${outPath}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
