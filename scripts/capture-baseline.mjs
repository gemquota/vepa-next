import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const run = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const hash = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
const status = run('status', '--porcelain');
const record = {
  schema: 'vepa.baseline-run',
  version: 1,
  capturedAt: new Date().toISOString(),
  revision: run('rev-parse', 'HEAD'),
  branch: run('branch', '--show-current'),
  clean: status.length === 0,
  dirtyPaths: status ? status.split('\n').map(line => line.slice(3)) : [],
  product: JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version,
  simFoundation: JSON.parse(await readFile(resolve(root, 'sim-foundation/package.json'), 'utf8')).version,
  sha256: {
    'package-lock.json': await hash('package-lock.json'),
    'sim-foundation/package.json': await hash('sim-foundation/package.json'),
  },
};
if (!record.clean) throw new Error('Baseline capture requires a clean checkout; dirty paths: ' + record.dirtyPaths.join(', '));
const output = resolve(root, '.artifacts/baseline-run.json');
await mkdir(resolve(root, '.artifacts'), { recursive: true });
await writeFile(output, JSON.stringify(record, null, 2) + '\n');
process.stdout.write(JSON.stringify(record, null, 2) + '\n');
