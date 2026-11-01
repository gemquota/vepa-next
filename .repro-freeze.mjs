import { createMultiplex, startMultiplex, stepMultiplex, iterateMultiplex, getFitnessReport } from './src/multiplex/multiplex.js';
import { createParticleBuffer } from './src/state/particleBuffer.js';
import { createDNABuffer, loadDefaults } from './src/dna/dnaBuffer.js';
import { createLawState, set as lawSet } from './src/state/lawState.js';
import { DNA_RANGES, LAW_INDEXES, PARTICLE_STRIDE, STRIDE_INDEXES, WORLD_SIZE } from './src/constants.js';
import { SplitMix32 } from './src/core/prng.js';

const S = STRIDE_INDEXES;
const buf = createParticleBuffer(2500, PARTICLE_STRIDE);
const dna = createDNABuffer(); loadDefaults(dna, DNA_RANGES);
const laws = createLawState();
for (const n of ['GRAV','DRAG','ENTR','WRAP','COLL','LIFE','GLOW','REPRO','PHENOTYPE','GENOTYPE']) lawSet(laws, LAW_INDEXES[n]);
const rng = new SplitMix32(1234);
const count = 500;
for (let i = 0; i < count; i++) {
  const b = i * PARTICLE_STRIDE;
  buf.view[b+S.POS_X] = rng.nextFloat(0, WORLD_SIZE); buf.view[b+S.POS_Y] = rng.nextFloat(0, WORLD_SIZE); buf.view[b+S.POS_Z] = rng.nextFloat(0, WORLD_SIZE);
  buf.view[b+S.VEL_X] = rng.nextFloat(-1,1); buf.view[b+S.VEL_Y] = rng.nextFloat(-1,1); buf.view[b+S.VEL_Z] = rng.nextFloat(-1,1);
  buf.view[b+S.MASS]=1; buf.view[b+S.SPECIES_ID]=i%5; buf.view[b+S.ENERGY]=50; buf.view[b+S.DEAD]=0; buf.view[b+S.RADIUS]=0.6; buf.view[b+S.ALPHA]=0.8; buf.view[b+S.TEMPERATURE]=0.5;
}

const mx = createMultiplex(null);
startMultiplex(mx, { view: buf.view, count, dna, laws, speciesCount: 5 }, {
  cols: 2, rows: 2,
  autoIterate: true, autoIterateInterval: 50,
  selectAfterIterate: 'follow',
  keepSelected: true,
  variation: 0.5,
}, null);

const t0 = performance.now();
for (let t = 0; t < 20000; t++) {
  stepMultiplex(mx, 0.25, 1, WORLD_SIZE);
  if (t % 5000 === 0) {
    const mem = process.memoryUsage().heapUsed / 1048576;
    console.log(`tick ${t}: iter ${mx.iteration} shards ${mx.shards.length} counts ${mx.shards.map(s=>s.count).join(',')} heap ${mem.toFixed(0)}MB`);
  }
}
console.log('completed', (performance.now()-t0).toFixed(0), 'ms');
