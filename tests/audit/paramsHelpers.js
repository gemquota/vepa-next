/**
 * Shared helpers for the parameter audit suite (params_batch_XX.test.js).
 */
import {
  PARTICLE_STRIDE, MAX_PARTICLES, STRIDE_INDEXES as S, DNA_RANGES,
} from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set as lawSet, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults } from '../../src/dna/dnaBuffer.js';
import { runtimeConfig } from '../../src/state/runtimeConfig.js';
import { createWorldParams } from '../../src/state/worldParams.js';

export const WORLD = 2000;
export const DT = 0.25;

// Deterministic LCG so jitter/entropy tests are reproducible.
export function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const rng = () => 0.5;

/** Build a single-species world; setup(view, dna, base) mutates particle 0. */
export function makeWorld(count, setup) {
  const buf = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  const view = buf.view;
  const dna = createDNABuffer();
  loadDefaults(dna, DNA_RANGES);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = WORLD * 0.5;
    view[b + S.POS_Y] = WORLD * 0.5;
    view[b + S.POS_Z] = WORLD * 0.5;
    view[b + S.VEL_X] = 0; view[b + S.VEL_Y] = 0; view[b + S.VEL_Z] = 0;
    view[b + S.MASS] = 1.5;
    view[b + S.SPECIES_ID] = 0;
    view[b + S.DEAD] = 0;
    view[b + S.AGE] = 0;
    view[b + S.ENERGY] = 100;
    view[b + S.SIGNAL] = 0;
    view[b + S.HUNGER] = 0;
    view[b + S.TEMPERATURE] = 0.5;
    view[b + S.CHARGE] = 0;
    view[b + S.ALPHA] = 0.8;
    view[b + S.RADIUS] = 0.6;
    if (setup) setup(view, dna, b);
  }
  return { view, dna, buf };
}

/** Run `fn` with one world param set, then restore the previous value. */
export function withWorldParam(key, value, fn) {
  const prev = runtimeConfig.worldParams[key];
  runtimeConfig.worldParams = { ...runtimeConfig.worldParams, [key]: value };
  try {
    return fn();
  } finally {
    runtimeConfig.worldParams = { ...runtimeConfig.worldParams, [key]: prev };
  }
}

/** Reset world params to the neutral defaults. */
export function resetWorldParams() {
  runtimeConfig.worldParams = createWorldParams();
}

/** Fresh law state with the given law indices enabled. */
export function lawsWith(...indices) {
  const laws = createLawState();
  for (const i of indices) lawSet(laws, i);
  return laws;
}

export { PARTICLE_STRIDE, S, DNA_RANGES, lawSet, isSet };
