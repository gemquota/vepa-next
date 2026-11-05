#!/usr/bin/env node
// VEPA4 backend comparison benchmark.
// This is a gravity-kernel comparison fixture, not a claim of full solver parity.

import { performance } from 'node:perf_hooks';
import { PARTICLE_STRIDE, WORLD_SIZE, STRIDE_INDEXES } from '../src/constants.js';
import { createOctree, buildOctree, octreeGravity } from '../src/physics/octree.js';
import { fmmGravity } from '../src/physics/fmm.js';

const S = STRIDE_INDEXES;
const DEFAULT_COUNT = 128;
const DEFAULT_SEED = 0x9e3779b9;
const G = 1;
const SOFTENING = 0.5;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 0x45d9f3b) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 0x45d9f3b) >>> 0;
    state = (state ^ (state >>> 16)) >>> 0;
    return state / 0x100000000;
  };
}

export function createFixture(count = DEFAULT_COUNT, seed = DEFAULT_SEED) {
  const view = new Float32Array(count * PARTICLE_STRIDE);
  const random = rng(seed);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = random() * WORLD_SIZE;
    view[b + S.POS_Y] = random() * WORLD_SIZE;
    view[b + S.POS_Z] = random() * WORLD_SIZE;
    view[b + S.MASS] = 0.5 + random() * 2.5;
    view[b + S.DEAD] = 0;
  }
  return view;
}

function exactGravity(view, count, outFx, outFy, outFz) {
  for (let i = 0; i < count; i++) {
    const ib = i * PARTICLE_STRIDE;
    const ix = view[ib + S.POS_X], iy = view[ib + S.POS_Y], iz = view[ib + S.POS_Z];
    let fx = 0, fy = 0, fz = 0;
    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      const jb = j * PARTICLE_STRIDE;
      let dx = ix - view[jb + S.POS_X];
      let dy = iy - view[jb + S.POS_Y];
      let dz = iz - view[jb + S.POS_Z];
      dx -= Math.round(dx / WORLD_SIZE) * WORLD_SIZE;
      dy -= Math.round(dy / WORLD_SIZE) * WORLD_SIZE;
      dz -= Math.round(dz / WORLD_SIZE) * WORLD_SIZE;
      const d2 = dx * dx + dy * dy + dz * dz + SOFTENING;
      const inv = 1 / Math.sqrt(d2);
      const force = view[jb + S.MASS] * inv * inv * inv;
      fx -= force * dx;
      fy -= force * dy;
      fz -= force * dz;
    }
    outFx[i] = fx; outFy[i] = fy; outFz[i] = fz;
  }
}

export function errorStats(reference, candidate) {
  let sumSq = 0, refSq = 0, maxAbs = 0;
  for (let i = 0; i < reference.length; i++) {
    const delta = candidate[i] - reference[i];
    sumSq += delta * delta;
    refSq += reference[i] * reference[i];
    maxAbs = Math.max(maxAbs, Math.abs(delta));
  }
  return {
    rmsAbsolute: Math.sqrt(sumSq / reference.length),
    rmsRelative: Math.sqrt(sumSq / Math.max(refSq, Number.EPSILON)),
    maxAbsolute: maxAbs,
  };
}

/**
 * Classify an approximate backend against an explicit acceptance envelope.
 * These defaults are reporting policy, not a claim that the backend is
 * scientifically equivalent to the reference solver.
 */
export function classifyError(error, envelope = { rmsRelative: 0.1, maxAbsolute: 1.0 }) {
  const finite = Object.values(error).every(Number.isFinite);
  const withinTolerance = finite &&
    error.rmsRelative <= envelope.rmsRelative &&
    error.maxAbsolute <= envelope.maxAbsolute;
  return { finite, withinTolerance, envelope };
}

export function errorEnvelope(reference, candidate, envelope) {
  const error = errorStats(reference, candidate);
  return { error, assessment: classifyError(error, envelope) };
}

function timed(fn) {
  const start = performance.now();
  fn();
  return +(performance.now() - start).toFixed(3);
}

export function compareBackends({ count = DEFAULT_COUNT, seed = DEFAULT_SEED, theta = 0.7 } = {}) {
  const view = createFixture(count, seed);
  const exactX = new Float64Array(count), exactY = new Float64Array(count), exactZ = new Float64Array(count);
  const treeX = new Float64Array(count), treeY = new Float64Array(count), treeZ = new Float64Array(count);
  const fmmX = new Float64Array(count), fmmY = new Float64Array(count), fmmZ = new Float64Array(count);

  const exactMs = timed(() => exactGravity(view, count, exactX, exactY, exactZ));
  const tree = createOctree(count * 2);
  const octreeMs = timed(() => {
    buildOctree(tree, view, PARTICLE_STRIDE, count, WORLD_SIZE);
    for (let i = 0; i < count; i++) {
      const b = i * PARTICLE_STRIDE;
      const force = { ax: 0, ay: 0, az: 0 };
      octreeGravity(tree, view[b + S.POS_X], view[b + S.POS_Y], view[b + S.POS_Z], G, theta, force, i);
      treeX[i] = force.ax; treeY[i] = force.ay; treeZ[i] = force.az;
    }
  });
  const fmmMs = timed(() => fmmGravity(view, PARTICLE_STRIDE, count, WORLD_SIZE, G, fmmX, fmmY, fmmZ));

  const exactVector = new Float64Array(count * 3);
  const octreeVector = new Float64Array(count * 3);
  const fmmVector = new Float64Array(count * 3);
  for (let i = 0; i < count; i++) {
    exactVector[i * 3] = exactX[i]; exactVector[i * 3 + 1] = exactY[i]; exactVector[i * 3 + 2] = exactZ[i];
    octreeVector[i * 3] = treeX[i]; octreeVector[i * 3 + 1] = treeY[i]; octreeVector[i * 3 + 2] = treeZ[i];
    fmmVector[i * 3] = fmmX[i]; fmmVector[i * 3 + 1] = fmmY[i]; fmmVector[i * 3 + 2] = fmmZ[i];
  }

  return {
    fixture: { count, seed, worldSize: WORLD_SIZE, softening: SOFTENING, theta },
    reference: { backend: 'exact-direct-gravity', milliseconds: exactMs },
    candidates: {
      octree: {
        backend: 'barnes-hut-octree', milliseconds: octreeMs,
        ...errorEnvelope(exactVector, octreeVector, { rmsRelative: 0.1, maxAbsolute: 1.0 }),
      },
      fmm: {
        backend: 'fmm-cell-evaluator', milliseconds: fmmMs,
        ...errorEnvelope(exactVector, fmmVector, { rmsRelative: 0.1, maxAbsolute: 1.0 }),
      },
    },
    interpretation: 'Gravity-kernel fixture only; DNA modifiers, collision, lifecycle, GPU device execution, and full solver scheduling are outside this comparison.',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const countArg = process.argv.indexOf('--count');
  const count = countArg >= 0 ? Number(process.argv[countArg + 1]) : DEFAULT_COUNT;
  console.log(JSON.stringify(compareBackends({ count }), null, 2));
}
