#!/usr/bin/env node
// Validate repository contracts without modifying the worktree.
import { readFileSync, existsSync } from 'node:fs';
import { LAW_INDEXES } from '../src/constants.js';
import { validateLawOntology, LAW_RELATIONSHIPS } from '../src/state/lawOntology.js';
import { validateLawGraph } from '../src/physics/lawGraph.js';
import { validateProvenance } from './validate-provenance.mjs';
import { validateSignoffFile } from './validate-signoff.mjs';

const errors = [];
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const packageJson = readJson('package.json');
const lockJson = readJson('package-lock.json');
const specManifest = readJson('docs/spec/manifest.json');
const implementationManifest = readJson('docs/spec/laws/implementation-status.json');
const ontologyCoverage = readJson('docs/spec/laws/ontology-coverage.json');
const version = readFileSync('VERSION', 'utf8').trim();
const changelogTop = readFileSync('CHANGELOG.md', 'utf8').match(/^## .*→\s*([0-9]+\.[0-9]+\.[0-9]+)/m)?.[1];

function requireEqual(label, actual, expected) {
  if (actual !== expected) errors.push(`${label}: expected ${expected}, got ${actual}`);
}

requireEqual('VERSION/package.json', version, packageJson.version);
requireEqual('VERSION/package-lock.json', version, lockJson.version);
requireEqual('VERSION/changelog', version, changelogTop);
requireEqual('spec manifest version', specManifest.version, version);
requireEqual('spec manifest package', specManifest.project, packageJson.name);
requireEqual('law manifest declared count', implementationManifest.declaredLawCount, Object.keys(LAW_INDEXES).length);
requireEqual('ontology coverage declared count', ontologyCoverage.declaredLawCount, Object.keys(LAW_INDEXES).length);

const expectedIndexes = Array.from({ length: Object.keys(LAW_INDEXES).length }, (_, index) => index);
const actualIndexes = implementationManifest.records.map(record => record.index);
if (JSON.stringify(actualIndexes) !== JSON.stringify(expectedIndexes)) {
  errors.push('law implementation manifest indexes are not continuous and ordered');
}

const ontologyErrors = [...validateLawOntology(), ...validateLawGraph()];
for (const error of validateProvenance()) errors.push(`provenance: ${error}`);
for (const error of validateSignoffFile()) errors.push(`signoff: ${error}`);
for (const error of new Set(ontologyErrors)) errors.push(`ontology: ${error}`);

const declaredNames = new Set(Object.keys(LAW_INDEXES));
const coveredNames = new Set([
  ...ontologyCoverage.lawsWithMetadata,
  ...ontologyCoverage.lawsWithoutMetadata,
]);
if (coveredNames.size !== declaredNames.size || [...declaredNames].some(name => !coveredNames.has(name))) {
  errors.push('ontology coverage does not account for every registered law');
}
if ([...coveredNames].some(name => !declaredNames.has(name))) {
  errors.push('ontology coverage contains an unknown law');
}
if (!existsSync('docs/spec/README.md') || !existsSync('docs/spec/procedure.md')) {
  errors.push('generated specification README/procedure is missing');
}

if (errors.length > 0) {
  console.error('repository:check failed');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`repository:check passed (${declaredNames.size} laws, version ${version}, ${Object.keys(LAW_RELATIONSHIPS).length} ontology records, provenance manifests valid, signoff manifest valid).`);
}
