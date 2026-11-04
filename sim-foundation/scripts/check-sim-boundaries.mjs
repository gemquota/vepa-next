import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('src');
const violations = [];

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch (error) {
    violations.push(`Cannot read source directory ${dir}: ${error.message}`);
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) {
      const source = await readFile(full, 'utf8');
      const rel = path.relative(process.cwd(), full).split(path.sep).join('/');
      const layer = rel.split('/')[1];
      if (['core', 'sim', 'state'].includes(layer)) {
        if (/\bMath\s*\.\s*random\s*\(/.test(source)) violations.push(`${rel}: ambient Math.random() is forbidden in deterministic layers`);
        if (/\bDate\s*\.\s*now\s*\(/.test(source) || /\bnew\s+Date\s*\(/.test(source)) violations.push(`${rel}: wall-clock reads are forbidden in deterministic layers`);
        if (/\b(document|window)\b/.test(source)) violations.push(`${rel}: DOM/window dependency is forbidden in deterministic layers`);
      }
      const importPattern = /(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g;
      for (const match of source.matchAll(importPattern)) {
        const spec = match[1];
        if (!spec.startsWith('.')) continue;
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
        const forbidden = layer === 'core'
          ? /^(src\/(sim|state|ui|render|persistence)\/|src\/(sim|state|ui|render|persistence)\.js$)/
          : layer === 'sim'
            ? /^(src\/(state|ui|render|persistence)\/|src\/(state|ui|render|persistence)\.js$)/
            : layer === 'state'
              ? /^(src\/(sim|ui|render)\/|src\/(sim|ui|render)\.js$)/
              : null;
        if (forbidden?.test(target)) violations.push(`${rel}: import boundary violation -> ${spec}`);
      }
    }
  }
}

await walk(root);
if (violations.length) {
  console.error('SIM boundary check failed:');
  for (const item of violations) console.error(' - ' + item);
  process.exitCode = 1;
} else {
  console.log('SIM boundary check passed: deterministic layers have no ambient random/clock/DOM access and obey declared import direction.');
}
