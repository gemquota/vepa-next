#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const plan = JSON.parse(await readFile(new URL('../exports/publication-plan.json', import.meta.url), 'utf8'));
const errors = [];
if (plan.status !== 'configured-not-published') errors.push('publication status must remain explicit');
if (!plan.repository || !plan.sourceRepository) errors.push('source and destination repositories are required');
if (!Array.isArray(plan.canonicalArtifacts) || plan.canonicalArtifacts.length < 2) errors.push('at least two canonical handoff artifacts are required');
for (const artifact of plan.canonicalArtifacts || []) {
  if (!artifact.path || !artifact.producer || !artifact.useCase) errors.push(`incomplete artifact record: ${artifact.path || '<unnamed>'}`);
}
if (!plan.publication?.requiredEnvironment?.includes('VEPA_EXPORTS_TOKEN')) errors.push('publication must require an explicit token');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`export publication contract valid: ${plan.repository} (${plan.status})`);
