#!/usr/bin/env node
// Read-only audit-corpus inventory. It never edits, deletes, or relocates files.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)));
const CORPUS = join(ROOT, 'docs', 'audit', 'laws', 'a3');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(path);
  }
  return files;
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function inspectAuditCorpus(root = CORPUS) {
  const files = walk(root);
  const hashes = new Map();
  const groups = new Map();
  let bytes = 0;
  const families = {};

  for (const file of files) {
    const rel = relative(ROOT, file).split('\\').join('/');
    const hash = hashFile(file);
    const size = statSync(file).size;
    bytes += size;
    if (!groups.has(hash)) groups.set(hash, []);
    groups.get(hash).push(rel);
    const family = rel.includes('/stage-1/') ? 'stage-1'
      : rel.includes('/stage-2/') ? 'stage-2'
        : rel.includes('/stage-3/') ? 'stage-3'
          : 'rollups';
    families[family] = (families[family] || 0) + 1;
    hashes.set(rel, { sha256: hash, bytes: size, family });
  }

  const exactDuplicateGroups = [...groups.values()].filter(group => group.length > 1);
  return {
    corpusRoot: relative(ROOT, root).split('\\').join('/'),
    generatedAt: 'runtime',
    fileCount: files.length,
    bytes,
    families,
    exactDuplicateGroupCount: exactDuplicateGroups.length,
    exactDuplicateFileCount: exactDuplicateGroups.reduce((sum, group) => sum + group.length, 0),
    exactDuplicateGroups,
    files: [...hashes.entries()].map(([path, info]) => ({ path, ...info })),
    ownership: {
      stageReports: 'historical audit evidence; retain until producer and review scope are confirmed',
      rollups: 'derived summaries; compare against stage reports before any consolidation',
      deletionPolicy: 'no deletion or relocation authorized by this report',
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = inspectAuditCorpus();
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Audit corpus: ${report.corpusRoot}`);
    console.log(`Files: ${report.fileCount}; bytes: ${report.bytes}`);
    console.log(`Families: ${JSON.stringify(report.families)}`);
    console.log(`Exact duplicate groups: ${report.exactDuplicateGroupCount}`);
    console.log('No files were modified.');
  }
}
