import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { compareBackends } from '../bench/backend-compare.mjs';
import { createSpatialGrid, insertParticle, queryNeighborsOrAll } from '../sim-foundation/src/sim/spatial-grid.js';

function gridAcceptance(count, worldSize = 120, radius = 18) {
  let seed = 0x12345678;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const points = Array.from({ length: count }, () => [random() * worldSize, random() * worldSize, random() * worldSize]);
  if (count >= 2) { points[0] = [0.1, 60, 60]; points[1] = [worldSize - 0.1, 60, 60]; }
  const dim = Math.max(3, Math.floor(worldSize / radius));
  const grid = createSpatialGrid({ worldSize, dim });
  const buildStart = performance.now();
  points.forEach((point, index) => insertParticle(grid, index, ...point));
  const output = new Int32Array(count);
  const gridPairs = new Set();
  let candidateChecks = 0;
  const gridStart = performance.now();
  for (let i = 0; i < count; i++) {
    const result = queryNeighborsOrAll(grid, ...points[i], output, count);
    if (!result.complete) throw new Error('Spatial grid returned incomplete candidates');
    for (let k = 0; k < result.count; k++) {
      const j = output[k];
      if (j <= i) continue;
      candidateChecks++;
      const dx0 = Math.abs(points[i][0] - points[j][0]);
      const dy0 = Math.abs(points[i][1] - points[j][1]);
      const dz0 = Math.abs(points[i][2] - points[j][2]);
      const dx = Math.min(dx0, worldSize - dx0);
      const dy = Math.min(dy0, worldSize - dy0);
      const dz = Math.min(dz0, worldSize - dz0);
      if (dx * dx + dy * dy + dz * dz <= radius * radius) gridPairs.add(i + ':' + j);
    }
  }
  const gridMs = performance.now() - gridStart;
  const bruteStart = performance.now();
  const exactPairs = new Set();
  for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
    const dx0 = Math.abs(points[i][0] - points[j][0]);
    const dy0 = Math.abs(points[i][1] - points[j][1]);
    const dz0 = Math.abs(points[i][2] - points[j][2]);
    const dx = Math.min(dx0, worldSize - dx0);
    const dy = Math.min(dy0, worldSize - dy0);
    const dz = Math.min(dz0, worldSize - dz0);
    if (dx * dx + dy * dy + dz * dz <= radius * radius) exactPairs.add(i + ':' + j);
  }
  const bruteMs = performance.now() - bruteStart;
  let missingPairs = 0, extraPairs = 0;
  for (const pair of exactPairs) if (!gridPairs.has(pair)) missingPairs++;
  for (const pair of gridPairs) if (!exactPairs.has(pair)) extraPairs++;
  return {
    count, worldSize, radius, dim, cellSize: worldSize / dim,
    exactPairs: exactPairs.size, gridPairs: gridPairs.size,
    candidateChecks, missingPairs, extraPairs,
    gridMs: Number(gridMs.toFixed(3)), bruteMs: Number(bruteMs.toFixed(3)),
    buildMs: Number((gridStart - buildStart).toFixed(3)),
  };
}

const counts = [32, 128, 512, 1024, 2048];
const runs = counts.map(count => compareBackends({ count, seed: 0x12345678, theta: 0.7 }));
const gridRuns = [128, 512, 2048].map(count => gridAcceptance(count));
const record = {
  schema: 'vepa.backend-acceptance',
  version: 1,
  commit: process.env.GITHUB_SHA || null,
  runtime: process.version,
  fixtureSeed: '0x12345678',
  envelope: { rmsRelative: 0.1, maxAbsolute: 1.0 },
  reference: 'exact-direct-gravity',
  policy: {
    exactCpu: 'reference implementation; no approximate backend may silently replace it',
    barnesHut: 'supported only for population/fixture bands that pass the measured envelope',
    fmm: 'experimental while any measured fixture exceeds the declared envelope',
    webgpu: 'gravity pre-pass only; require actual-device parity and device-loss fallback evidence',
  },
  runs,
  spatialGrid: { policy: 'candidate generation only; exact distance filtering remains authoritative', runs: gridRuns },
};
const allFinite = runs.every(run =>
  run.candidates.octree.assessment.finite && run.candidates.fmm.assessment.finite);
if (!allFinite) throw new Error('Backend acceptance fixture produced non-finite error metrics');
if (gridRuns.some(run => run.missingPairs !== 0 || run.extraPairs !== 0 || run.gridPairs !== run.exactPairs)) {
  throw new Error('Spatial grid neighbor parity failed: ' + JSON.stringify(gridRuns));
}
const canonical = JSON.stringify(record);
record.recordSha256 = createHash('sha256').update(canonical).digest('hex');
const output = resolve(process.cwd(), '.artifacts/backend-acceptance.json');
await mkdir(resolve(process.cwd(), '.artifacts'), { recursive: true });
await writeFile(output, JSON.stringify(record, null, 2) + '\n');
process.stdout.write(JSON.stringify(record, null, 2) + '\n');
