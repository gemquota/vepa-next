import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compareBackends } from '../bench/backend-compare.mjs';

const counts = [32, 128, 512, 1024, 2048];
const runs = counts.map(count => compareBackends({ count, seed: 0x12345678, theta: 0.7 }));
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
};
const allFinite = runs.every(run =>
  run.candidates.octree.assessment.finite && run.candidates.fmm.assessment.finite);
if (!allFinite) throw new Error('Backend acceptance fixture produced non-finite error metrics');
const canonical = JSON.stringify(record);
record.recordSha256 = createHash('sha256').update(canonical).digest('hex');
const output = resolve(process.cwd(), '.artifacts/backend-acceptance.json');
await mkdir(resolve(process.cwd(), '.artifacts'), { recursive: true });
await writeFile(output, JSON.stringify(record, null, 2) + '\n');
process.stdout.write(JSON.stringify(record, null, 2) + '\n');
