#!/usr/bin/env node
// Validate repository-local provenance manifests without modifying the worktree.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const manifests = [
  'docs/audit/provenance.json',
  'exports/provenance.json',
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listFiles(root, extension = null) {
  if (!existsSync(root)) return [];
  const stat = statSync(root);
  if (stat.isFile()) return !extension || root.endsWith(extension) ? [root] : [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const child = `${root}/${entry.name}`;
    files.push(...listFiles(child, extension));
  }
  return files;
}

function pathCovered(file, records) {
  return records.some((record) => file === record.path || file.startsWith(`${record.path}/`));
}

function validateManifest(path) {
  const errors = [];
  if (!existsSync(path)) return [`${path}: manifest is missing`];
  let manifest;
  try {
    manifest = readJson(path);
  } catch (error) {
    return [`${path}: invalid JSON (${error.message})`];
  }

  for (const key of ['schema', 'generatedBy', 'authority', 'records']) {
    if (!(key in manifest)) errors.push(`${path}: missing top-level field ${key}`);
  }
  if (!Array.isArray(manifest.records) || manifest.records.length === 0) {
    errors.push(`${path}: records must be a non-empty array`);
    return errors;
  }

  const paths = new Set();
  for (const record of manifest.records) {
    for (const key of ['path', 'role', 'status', 'consumer', 'retention']) {
      if (!record[key]) errors.push(`${path}: record missing ${key}`);
    }
    if (record.path) {
      if (paths.has(record.path)) errors.push(`${path}: duplicate record path ${record.path}`);
      paths.add(record.path);
      if (!existsSync(record.path)) errors.push(`${path}: referenced path is missing: ${record.path}`);
    }
    if (record.status === 'current-authority') {
      errors.push(`${path}: derived record cannot be current-authority: ${record.path}`);
    }
  }

  // Directory-level records are accepted, but every contained artifact must be
  // covered by at least one record. This turns a coarse inventory into a
  // machine-checkable ownership boundary without duplicating 398 audit files in
  // a hand-maintained JSON manifest.
  const coverageRoots = path === 'docs/audit/provenance.json'
    ? ['docs/audit/laws/a3']
    : ['exports'];
  for (const root of coverageRoots) {
    for (const file of listFiles(root, path === 'docs/audit/provenance.json' ? '.md' : null)) {
      if (!pathCovered(file, manifest.records)) {
        errors.push(`${path}: artifact is not covered by any record: ${file}`);
      }
    }
  }
  return errors;
}

export function validateProvenance() {
  return manifests.flatMap(validateManifest);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = validateProvenance();
  if (errors.length > 0) {
    console.error('provenance:check failed');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`provenance:check passed (${manifests.length} manifests).`);
  }
}
