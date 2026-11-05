// ============================================================================
// VEPA v3 — Law Synergy Computation
// When multiple laws are active simultaneously, they modify each other's
// effects through multiplier synergies. Returns a multiplier in [0.0, 2.0].
// ============================================================================

import { LAW_INDEXES, LAW_COUNT } from '../constants.js';
import { isSet } from '../state/lawState.js';

/**
 * Compute the synergy multiplier for a given law based on which
 * other laws are currently active.
 *
 * @param {{ lowFlags: Uint32Array, highFlags: Uint32Array, extFlags: Uint32Array }} lawState
 * @param {number} lawIndex - The law to compute synergy for
 * @returns {number} Multiplier in [0.0, 2.0]
 */
export function computeSynergy(lawState, lawIndex) {
  let mult = 1.0;

  // ── Physics synergies ──

  // GRAV + PLANETARY → gravitational strength ×1.5
  if (lawIndex === LAW_INDEXES.GRAV && isSet(lawState, LAW_INDEXES.PLANETARY)) {
    mult *= 1.5;
  }
  if (lawIndex === LAW_INDEXES.PLANETARY && isSet(lawState, LAW_INDEXES.GRAV)) {
    mult *= 1.5;
  }

  // COLL + ACCR → accretion bonus ×1.2
  if (lawIndex === LAW_INDEXES.ACCR && isSet(lawState, LAW_INDEXES.COLL)) {
    mult *= 1.2;
  }

  // ── Biology synergies ──

  // LIFE + REPRO + ENERGY → biological efficiency ×1.3
  // (only fires when all three are active)
  if (
    lawIndex === LAW_INDEXES.LIFE ||
    lawIndex === LAW_INDEXES.REPRO ||
    lawIndex === LAW_INDEXES.ENERGY
  ) {
    if (
      isSet(lawState, LAW_INDEXES.LIFE) &&
      isSet(lawState, LAW_INDEXES.REPRO) &&
      isSet(lawState, LAW_INDEXES.ENERGY)
    ) {
      mult *= 1.3;
    }
  }

  // GLOW + SIGNAL → signal propagation ×1.5
  if (lawIndex === LAW_INDEXES.GLOW && isSet(lawState, LAW_INDEXES.TRACK)) {
    mult *= 1.5;
  }
  if (lawIndex === LAW_INDEXES.TRACK && isSet(lawState, LAW_INDEXES.GLOW)) {
    mult *= 1.5;
  }

  // ── Chemistry synergies ──

  // CATALYSIS + SOLVATION + ACIDITY → chemical reaction rate ×2.0
  if (
    lawIndex === LAW_INDEXES.CATALYSIS_LAW ||
    lawIndex === LAW_INDEXES.SOLVATION ||
    lawIndex === LAW_INDEXES.ACIDITY
  ) {
    if (
      isSet(lawState, LAW_INDEXES.CATALYSIS_LAW) &&
      isSet(lawState, LAW_INDEXES.SOLVATION) &&
      isSet(lawState, LAW_INDEXES.ACIDITY)
    ) {
      mult *= 2.0;
    }
  }

  // ── Thermodynamics synergies ──

  // HEAT + COLD → cancel each other (×0.5 each)
  if (lawIndex === LAW_INDEXES.HEAT && isSet(lawState, LAW_INDEXES.COLD)) {
    mult *= 0.5;
  }
  if (lawIndex === LAW_INDEXES.COLD && isSet(lawState, LAW_INDEXES.HEAT)) {
    mult *= 0.5;
  }

  // ── Metaphysics synergies ──

  // CHAOS + ORDER → cancel each other (×0.3 each)
  if (lawIndex === LAW_INDEXES.CHAOS && isSet(lawState, LAW_INDEXES.ORDER)) {
    mult *= 0.3;
  }
  if (lawIndex === LAW_INDEXES.ORDER && isSet(lawState, LAW_INDEXES.CHAOS)) {
    mult *= 0.3;
  }

  // FATE + WILL → metaphysical power ×1.8
  if (lawIndex === LAW_INDEXES.FATE && isSet(lawState, LAW_INDEXES.WILL)) {
    mult *= 1.8;
  }
  if (lawIndex === LAW_INDEXES.WILL && isSet(lawState, LAW_INDEXES.FATE)) {
    mult *= 1.8;
  }

  // ── Metaphysics: MIND hivemind synergies (batch-10) ──

  // MIND + ENERGY → hive-mind energy drain (boost ×0.5)
  if (lawIndex === LAW_INDEXES.MIND && isSet(lawState, LAW_INDEXES.ENERGY)) {
    mult *= 0.5;
  }

  // MIND + COMMS → amplified hivemind communication (×1.5)
  if (lawIndex === LAW_INDEXES.MIND && isSet(lawState, LAW_INDEXES.COMMS)) {
    mult *= 1.5;
  }

  // MIND + TELEPATHY → global thought sharing (×2.0)
  if (lawIndex === LAW_INDEXES.MIND && isSet(lawState, LAW_INDEXES.TELEPATHY)) {
    mult *= 2.0;
  }

  // MIND + POLYMER → polymerized hivemind overhead (×0.5)
  if (lawIndex === LAW_INDEXES.MIND && isSet(lawState, LAW_INDEXES.POLYMER)) {
    mult *= 0.5;
  }

  // ── Electromagnetism synergies ──

  // CHARGE_LAW + MAGNETISM → unified electromagnetic force ×1.5
  if (
    (lawIndex === LAW_INDEXES.CHARGE_LAW || lawIndex === LAW_INDEXES.MAGNETISM) &&
    isSet(lawState, LAW_INDEXES.CHARGE_LAW) && isSet(lawState, LAW_INDEXES.MAGNETISM)
  ) {
    mult *= 1.5;
  }

  // SUPERCONDUCTIVITY + COLD → true superconducting state ×1.8
  if (
    (lawIndex === LAW_INDEXES.SUPERCONDUCTIVITY || lawIndex === LAW_INDEXES.COLD) &&
    isSet(lawState, LAW_INDEXES.SUPERCONDUCTIVITY) && isSet(lawState, LAW_INDEXES.COLD)
  ) {
    mult *= 1.8;
  }

  // SUPERCONDUCTIVITY + RESISTANCE → lossless flow cancels Ohmic damping ×0.2
  if (
    (lawIndex === LAW_INDEXES.SUPERCONDUCTIVITY || lawIndex === LAW_INDEXES.RESISTANCE) &&
    isSet(lawState, LAW_INDEXES.SUPERCONDUCTIVITY) && isSet(lawState, LAW_INDEXES.RESISTANCE)
  ) {
    mult *= 0.2;
  }

  // DISCHARGE + IONIZATION → sparks strip charge harder ×1.5
  if (
    (lawIndex === LAW_INDEXES.DISCHARGE || lawIndex === LAW_INDEXES.IONIZATION) &&
    isSet(lawState, LAW_INDEXES.DISCHARGE) && isSet(lawState, LAW_INDEXES.IONIZATION)
  ) {
    mult *= 1.5;
  }

  // PLASMA + HEAT → hotter gas ionizes more ×1.5
  if (
    (lawIndex === LAW_INDEXES.PLASMA || lawIndex === LAW_INDEXES.HEAT) &&
    isSet(lawState, LAW_INDEXES.PLASMA) && isSet(lawState, LAW_INDEXES.HEAT)
  ) {
    mult *= 1.5;
  }

  // CURRENT + RESISTANCE → ohmic heating ×1.4
  if (
    (lawIndex === LAW_INDEXES.CURRENT || lawIndex === LAW_INDEXES.RESISTANCE) &&
    isSet(lawState, LAW_INDEXES.CURRENT) && isSet(lawState, LAW_INDEXES.RESISTANCE)
  ) {
    mult *= 1.4;
  }

  // ── Information synergies ──

  // MEMORY + FEEDBACK → amplified memory loop ×1.6
  if (
    (lawIndex === LAW_INDEXES.MEMORY || lawIndex === LAW_INDEXES.FEEDBACK) &&
    isSet(lawState, LAW_INDEXES.MEMORY) && isSet(lawState, LAW_INDEXES.FEEDBACK)
  ) {
    mult *= 1.6;
  }

  // SIGNAL_BOOST + PROTOCOL → relayed synchronization ×1.5
  if (
    (lawIndex === LAW_INDEXES.SIGNAL_BOOST || lawIndex === LAW_INDEXES.PROTOCOL) &&
    isSet(lawState, LAW_INDEXES.SIGNAL_BOOST) && isSet(lawState, LAW_INDEXES.PROTOCOL)
  ) {
    mult *= 1.5;
  }

  // LANGUAGE + CODE → words spread genes ×1.5
  if (
    (lawIndex === LAW_INDEXES.LANGUAGE || lawIndex === LAW_INDEXES.CODE) &&
    isSet(lawState, LAW_INDEXES.LANGUAGE) && isSet(lawState, LAW_INDEXES.CODE)
  ) {
    mult *= 1.5;
  }

  // CULTURE + GENOTYPE → soft heredity ×1.4
  if (
    (lawIndex === LAW_INDEXES.CULTURE || lawIndex === LAW_INDEXES.GENOTYPE) &&
    isSet(lawState, LAW_INDEXES.CULTURE) && isSet(lawState, LAW_INDEXES.GENOTYPE)
  ) {
    mult *= 1.4;
  }

  // PREDICT + TRACK → interception ×1.5
  if (
    (lawIndex === LAW_INDEXES.PREDICT || lawIndex === LAW_INDEXES.TRACK) &&
    isSet(lawState, LAW_INDEXES.PREDICT) && isSet(lawState, LAW_INDEXES.TRACK)
  ) {
    mult *= 1.5;
  }

  // STIGMERGY + LEARN → learned trail following ×1.3
  if (
    (lawIndex === LAW_INDEXES.STIGMERGY || lawIndex === LAW_INDEXES.LEARN) &&
    isSet(lawState, LAW_INDEXES.STIGMERGY) && isSet(lawState, LAW_INDEXES.LEARN)
  ) {
    mult *= 1.3;
  }

  // LEARN + SYMBOL → species schooling ×1.4
  if (
    (lawIndex === LAW_INDEXES.LEARN || lawIndex === LAW_INDEXES.SYMBOL) &&
    isSet(lawState, LAW_INDEXES.LEARN) && isSet(lawState, LAW_INDEXES.SYMBOL)
  ) {
    mult *= 1.4;
  }

  // ── New law type synergies ──

  // SINGULARITY + ACCR → mass concentrates until collapse ×1.5
  if (
    (lawIndex === LAW_INDEXES.SINGULARITY || lawIndex === LAW_INDEXES.ACCR) &&
    isSet(lawState, LAW_INDEXES.SINGULARITY) && isSet(lawState, LAW_INDEXES.ACCR)
  ) {
    mult *= 1.5;
  }

  // SINGULARITY + GRAV → the hole bends space itself ×1.4
  if (
    (lawIndex === LAW_INDEXES.SINGULARITY || lawIndex === LAW_INDEXES.GRAV) &&
    isSet(lawState, LAW_INDEXES.SINGULARITY) && isSet(lawState, LAW_INDEXES.GRAV)
  ) {
    mult *= 1.4;
  }

  // ENTANGLEMENT + TELEPATHY → minds linked across any distance ×1.6
  if (
    (lawIndex === LAW_INDEXES.ENTANGLEMENT || lawIndex === LAW_INDEXES.TELEPATHY) &&
    isSet(lawState, LAW_INDEXES.ENTANGLEMENT) && isSet(lawState, LAW_INDEXES.TELEPATHY)
  ) {
    mult *= 1.6;
  }

  // ENTANGLEMENT + COMMS → correlated pairs coordinate through the comms channel ×1.5
  if (
    (lawIndex === LAW_INDEXES.ENTANGLEMENT || lawIndex === LAW_INDEXES.COMMS) &&
    isSet(lawState, LAW_INDEXES.ENTANGLEMENT) && isSet(lawState, LAW_INDEXES.COMMS)
  ) {
    mult *= 1.5;
  }

  // HISTORY + MEMORY → collective memory deepens the field ×1.6
  if (
    (lawIndex === LAW_INDEXES.HISTORY || lawIndex === LAW_INDEXES.MEMORY) &&
    isSet(lawState, LAW_INDEXES.HISTORY) && isSet(lawState, LAW_INDEXES.MEMORY)
  ) {
    mult *= 1.6;
  }

  // HISTORY + PATTERN → remembered geometry aligns drift ×1.5
  if (
    (lawIndex === LAW_INDEXES.HISTORY || lawIndex === LAW_INDEXES.PATTERN) &&
    isSet(lawState, LAW_INDEXES.HISTORY) && isSet(lawState, LAW_INDEXES.PATTERN)
  ) {
    mult *= 1.5;
  }

  // Clamp to [0.0, 2.0]
  if (mult < 0.0) mult = 0.0;
  if (mult > 2.0) mult = 2.0;

  return mult;
}

/**
 * Precompute every law's synergy multiplier for a fixed law state.
 *
 * The law state never changes mid-tick, so synergy values are constant for
 * the whole solve. Computing them once (128 entries) instead of per particle
 * or per neighbor pair removes tens of thousands of branch chains per tick
 * from the solver hot loop. Uses a plain array (not Float32Array) so the
 * float64 results are bit-identical to repeated computeSynergy calls.
 *
 * @param {object} lawState - Active-law bitmask state
 * @returns {number[]} 128-element synergy multiplier table
 */
export function createSynergyCache(lawState) {
  const cache = new Array(LAW_COUNT);
  for (let i = 0; i < LAW_COUNT; i++) cache[i] = computeSynergy(lawState, i);
  return cache;
}
