// ============================================================================
// VEPA4 — Chemistry Laws (lawgroups)
// Stateless pairwise/per-particle law functions for the chemistry category.
// ============================================================================

import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_INDEXES as D } from '../../constants.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function nanGuard(v) {
  return Number.isFinite(v) ? v : 0;
}

function applyElectrolysis(view, iBase, jBase, k) {
  const chargeI = view[iBase + S.CHARGE];
  const chargeJ = view[jBase + S.CHARGE];
  if (Math.abs(chargeI - chargeJ) <= 0.5) return null;
  // Batch-24 RRP: decomposition scales with CONDUCTIVITY DNA (real materials
  // need an electrolyte) and the reaction sheds a little heat.
  const conductivity = Math.max(0, Math.min(1, nanGuard(view[iBase + S.DNA_CACHE_START + D.CONDUCTIVITY])));
  const dm = Math.min(0.01 * view[iBase + S.MASS], 0.5) * k * conductivity;
  view[iBase + S.MASS] = Math.max(0.001, nanGuard(view[iBase + S.MASS] - dm));
  view[iBase + S.ENERGY] = clamp(nanGuard(view[iBase + S.ENERGY] + dm * 20), 0, 200);
  view[iBase + S.SIGNAL] = Math.max(0, nanGuard(view[iBase + S.SIGNAL] + dm * 5));
  view[iBase + S.TEMPERATURE] = nanGuard(view[iBase + S.TEMPERATURE] + dm * 0.25);
  return null;
}

function applyPhotolysis(view, iBase, k) {
  if (view[iBase + S.SIGNAL] <= 0.5) return null;
  // Batch-24 RRP: conversion scales with CATALYSIS DNA (light-powered
  // chemistry is catalysed; CATALYSIS range 1-10, default 1.0).
  const catalysis = Math.max(0.1, nanGuard(view[iBase + S.DNA_CACHE_START + D.CATALYSIS]));
  const dm = Math.min(0.01 * view[iBase + S.MASS], 0.5) * k * catalysis;
  view[iBase + S.MASS] = Math.max(0.001, nanGuard(view[iBase + S.MASS] - dm));
  view[iBase + S.ENERGY] = clamp(nanGuard(view[iBase + S.ENERGY] + dm * 15), 0, 200);
  view[iBase + S.SIGNAL] = nanGuard(view[iBase + S.SIGNAL] * 0.9);
  return null;
}

function applyPrecipitation(view, iBase, jBase, k) {
  if (view[iBase + S.ENERGY] <= 80 || view[jBase + S.ENERGY] <= 80) return null;
  view[iBase + S.MASS] = nanGuard(view[iBase + S.MASS] + 0.005 * k);
  view[iBase + S.RADIUS] = Math.max(0.1, nanGuard(view[iBase + S.RADIUS] * 0.998));
  view[iBase + S.ENERGY] = clamp(nanGuard(view[iBase + S.ENERGY] - 0.1 * k), 0, 200);
  // Batch-24 RRP: both partners condense symmetrically (saturation is a
  // pair property, not a one-sided drain).
  view[jBase + S.MASS] = nanGuard(view[jBase + S.MASS] + 0.005 * k);
  view[jBase + S.RADIUS] = Math.max(0.1, nanGuard(view[jBase + S.RADIUS] * 0.998));
  view[jBase + S.ENERGY] = clamp(nanGuard(view[jBase + S.ENERGY] - 0.1 * k), 0, 200);
  return null;
}

function applyNeutralization(view, iBase, jBase, k) {
  const cI = view[iBase + S.CHARGE];
  const cJ = view[jBase + S.CHARGE];
  if (Math.abs(cI) <= 0.1 || Math.abs(cJ) <= 0.1 || Math.sign(cI) === Math.sign(cJ)) return null;
  const step = 0.05 * k;
  view[iBase + S.CHARGE] = nanGuard(cI - Math.sign(cI) * Math.min(step, Math.abs(cI)));
  view[jBase + S.CHARGE] = nanGuard(cJ - Math.sign(cJ) * Math.min(step, Math.abs(cJ)));
  // Batch-24 RRP: heat released is proportional to the product of the charges
  // (annihilation energy scales with the opposing field strength).
  const heat = Math.abs(cI * cJ) * k * 0.04;
  view[iBase + S.TEMPERATURE] = nanGuard(view[iBase + S.TEMPERATURE] + heat);
  view[jBase + S.TEMPERATURE] = nanGuard(view[jBase + S.TEMPERATURE] + heat);
  return null;
}

function applyStoichiometry(view, iBase, jBase, k) {
  const massI = view[iBase + S.MASS];
  const massJ = view[jBase + S.MASS];
  const d = (massI - massJ) * 0.005 * k;
  view[iBase + S.MASS] = Math.max(0.001, nanGuard(massI - d));
  view[jBase + S.MASS] = Math.max(0.001, nanGuard(massJ + d));
  return null;
}

function applyAutocatalysis(view, iBase, jBase, k) {
  if (view[iBase + S.SPECIES_ID] !== view[jBase + S.SPECIES_ID]) return null;
  // REACTION_THRESHOLD DNA (37): mass limit for the phase change — the
  // catalytic reaction only fires once both bodies clear the threshold mass.
  const thrI = nanGuard(view[iBase + S.DNA_CACHE_START + D.REACTION_THRESHOLD]);
  const thrJ = nanGuard(view[jBase + S.DNA_CACHE_START + D.REACTION_THRESHOLD]);
  const threshold = Math.max(0, Math.min(1000, thrI || 0));
  if (view[iBase + S.MASS] < threshold || view[jBase + S.MASS] < (thrJ || threshold)) return null;
  const catI = clamp(nanGuard(view[iBase + S.DNA_CACHE_START + D.CATALYSIS]), 0.1, 2);
  const catJ = clamp(nanGuard(view[jBase + S.DNA_CACHE_START + D.CATALYSIS]), 0.1, 2);
  view[iBase + S.ENERGY] = clamp(nanGuard(view[iBase + S.ENERGY] + 0.1 * k * catI), 0, 200);
  view[jBase + S.ENERGY] = clamp(nanGuard(view[jBase + S.ENERGY] + 0.1 * k * catJ), 0, 200);
  return null;
}
export { applyElectrolysis, applyPhotolysis, applyPrecipitation, applyNeutralization, applyStoichiometry, applyAutocatalysis };
