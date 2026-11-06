#!/usr/bin/env node
/**
 * Repeated, fixed-seed backend benchmark matrix.
 *
 * This runner intentionally reports the scope of backend-compare.mjs:
 * gravity-kernel only. It does not fabricate law-mask, full-solver, allocation,
 * GPU-hardware or compatibility evidence that the underlying fixture cannot
 * measure.
 */
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { compareBackends } from './backend-compare.mjs';

const COUNTS = [32, 128, 512, 1024, 2048];
const SEEDS = [0x13579bdf, 0x2468ace0, 0x9e3779b9];
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
};

function summarize(values) {
  return {
    samples: values.length,
    medianMs: +percentile(values, 0.5).toFixed(3),
    p95Ms: +percentile(values, 0.95).toFixed(3),
    minMs: +Math.min(...values).toFixed(3),
    maxMs: +Math.max(...values).toFixed(3),
  };
}

export function runReleaseMatrix({ counts = COUNTS, seeds = SEEDS } = {}) {
  const rows = [];
  for (const count of counts) {
    const samples = { exact: [], octree: [], fmm: [] };
    const errors = { octree: [], fmm: [] };
    for (const seed of seeds) {
      const result = compareBackends({ count, seed });
      samples.exact.push(result.reference.milliseconds);
      for (const name of ['octree', 'fmm']) {
        samples[name].push(result.candidates[name].milliseconds);
        errors[name].push(result.candidates[name].error);
      }
    }
    rows.push({
      count,
      seedCount: seeds.length,
      timings: Object.fromEntries(Object.entries(samples).map(([name, values]) => [name, summarize(values)])),
      error: Object.fromEntries(Object.entries(errors).map(([name, values]) => [name, {
        maxRmsRelative: +Math.max(...values.map((item) => item.rmsRelative)).toFixed(8),
        maxAbsolute: +Math.max(...values.map((item) => item.maxAbsolute)).toFixed(8),
      }])),
    });
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: process.env.NUMBER_OF_PROCESSORS ?? 'not-reported',
      memoryBytes: process.memoryUsage().heapTotal,
    },
    scope: {
      measured: 'fixed-seed direct, Barnes-Hut and FMM gravity-kernel timing and force-error envelopes',
      notMeasured: [
        'full product solver and law-mask combinations',
        'per-tick allocation and garbage-collection attribution',
        'WebGPU hardware timing or device-loss behavior',
        'browser/mobile performance',
        'save compatibility and UI interaction',
      ],
    },
    matrix: { counts, seeds },
    rows,
  };
}

if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  const outputArg = process.argv.indexOf('--out');
  const report = runReleaseMatrix();
  const json = JSON.stringify(report, null, 2);
  if (outputArg >= 0 && process.argv[outputArg + 1]) {
    await writeFile(process.argv[outputArg + 1], json + '\n', 'utf8');
  }
  process.stdout.write(json + '\n');
}
