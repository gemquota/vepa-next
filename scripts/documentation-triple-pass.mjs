#!/usr/bin/env node
/**
 * Reproducible project hygiene and documentation pipeline.
 *
 * Pass 1 inspects source integrity and publication contracts.
 * Pass 2 regenerates source-derived documentation.
 * Pass 3 validates tests, repository consistency and the production build.
 *
 * Generation is intentionally performed before --check validation so stale
 * committed artifacts are refreshed in the working tree and are visible in
 * the resulting diff. This script never commits, pushes or deploys.
 */
import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = { ...process.env, VITE_BASE: process.env.VITE_BASE || '/vepa-next/' };

function runPass(name, commands) {
  process.stdout.write(`\n=== ${name} ===\n`);
  for (const [label, args] of commands) {
    process.stdout.write(`\n--- ${label} ---\n`);
    const result = spawnSync(npm, args, { stdio: 'inherit', env });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.stderr.write(`\nFAILED: ${label} (exit ${result.status ?? 'unknown'})\n`);
      process.exit(result.status || 1);
    }
  }
}

runPass('PASS 1 / SOURCE AND PUBLICATION HYGIENE', [
  ['syntax-check', ['run', 'syntax-check']],
  ['provenance:check', ['run', 'provenance:check']],
  ['exports:check', ['run', 'exports:check']],
]);

runPass('PASS 2 / REGENERATE SOURCE-DERIVED DOCUMENTATION', [
  ['spec:generate', ['run', 'spec:generate']],
  ['report:ui', ['run', 'report:ui']],
]);

runPass('PASS 3 / TEST, CONSISTENCY AND PRODUCTION BUILD', [
  ['test:all', ['run', 'test:all']],
  ['repository:check', ['run', 'repository:check']],
  ['syntax-check', ['run', 'syntax-check']],
  ['production build', ['run', 'build']],
]);

process.stdout.write('\nTriple pass completed. Review and commit generated-file diffs; no deployment was performed.\n');
