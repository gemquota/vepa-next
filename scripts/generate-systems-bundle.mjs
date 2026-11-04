import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const sourceRoot = join(root, 'docs/systems');
const destination = join(sourceRoot, 'complete-atlas.md');

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'past') files.push(...await markdownFiles(path));
    } else if (entry.name.endsWith('.md') && path !== destination) {
      files.push(path);
    }
  }
  return files;
}

function titleFor(path) {
  return relative(sourceRoot, path).replace(/\\/g, '/').replace(/\.md$/, '');
}

function demote(markdown) {
  return markdown.replace(/^#{1,6}(?=\s)/gm, (hashes) => `#${hashes}`);
}

const files = await markdownFiles(sourceRoot);
const groups = new Map();
for (const file of files) {
  const rel = titleFor(file);
  const group = rel.split('/')[0] === 'roadmaps' ? 'Roadmap variants' : rel.split('/')[0] === 'roles' ? 'System roles' : 'Atlas foundations';
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push({ file, rel });
}
const lines = [
  '# VEPA4 Systems Atlas — Complete Concatenated Reference',
  '',
  '> Generated from the current `docs/systems/` source on 2026-09-21. This single document preserves the atlas, role catalog, and all 48 A–D roadmap variants in hierarchical order. The source files remain canonical.',
  '',
  '## Table of contents',
  '',
];
for (const [group, entries] of groups) {
  lines.push(`- [${group}](#${group.toLowerCase().replace(/[^a-z0-9]+/g, '-')})`);
  for (const { rel } of entries) {
    const label = rel.replace(/\//g, ' / ').replace(/-/g, ' ');
    lines.push(`  - [${label}](#${rel.toLowerCase().replace(/[^a-z0-9]+/g, '-')})`);
  }
}
for (const [group, entries] of groups) {
  lines.push('', `## ${group}`, '');
  for (const { file, rel } of entries) {
    const sourceLabel = rel.replace(/\//g, ' / ').replace(/-/g, ' ');
    lines.push(`### ${sourceLabel}`, '', `<a id="${rel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}"></a>`, `<!-- Source: docs/systems/${rel}.md -->`, '');
    lines.push(demote(await readFile(file, 'utf8')).trim(), '');
  }
}
await writeFile(destination, `${lines.join('\n').trim()}\n`, 'utf8');
console.log(`Generated ${relative(root, destination)} from ${files.length} Markdown files.`);
