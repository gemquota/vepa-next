// ============================================================================
// VEPA v3 — Law Force Computation
// Per-law force functions for the physics engine. Each function reads from
// the particle buffer and returns force contributions as {ax, ay, az}.
//
// Convention:
//   p1Ptr = subject particle base offset (index * stride)
//   p2Ptr = neighbor particle base offset (index * stride)
//   stride = PARTICLE_STRIDE (100)
//   DNA values accessed via: buffer[p1Ptr + DNA_CACHE_START + DNA_INDEX]
// ============================================================================

import { PARTICLE_STRIDE, STRIDE_INDEXES, DNA_INDEXES, DNA_RANGES, DNA_COUNT, LAW_INDEXES } from '../constants.js';
import { isSet } from '../state/lawState.js';
import { runtimeConfig } from '../state/runtimeConfig.js';
import { getDNAFloat } from '../dna/dnaBuffer.js';

/** Live world-param state (WORLD panel sliders). */
function worldParams() {
  return runtimeConfig.worldParams || {};
}

const S = STRIDE_INDEXES;
const D = DNA_INDEXES;
const DNA_BASE = S.DNA_CACHE_START;

// Polymer chain bond slots (batch 06): the documented "max 6 bonds per
// particle". Not contiguous in the stride (2 legacy slots + 4 appended), so
// iterate this list rather than a numeric range.
const BOND_SLOTS = [
  S.BOND_PARTNER_1, S.BOND_PARTNER_2, S.BOND_PARTNER_3,
  S.BOND_PARTNER_4, S.BOND_PARTNER_5, S.BOND_PARTNER_6,
];

/**
 * Read a species genome param (DNA buffer, 64×64 Uint16) as a float.
 * Genetics params 42-47 live only in the species genome, not the stride cache.
 */
function readSpeciesDNAParam(buf, sp, idx) {
  if (!buf) return 0;
  const raw = buf[sp * 64 + idx];
  if (idx < DNA_RANGES.length) {
    const { min, max } = DNA_RANGES[idx];
    return min + (raw / 65535) * (max - min);
  }
  return raw / 65535;
}

/** Write a float back into the species genome (quantized to uint16). */
function writeSpeciesDNAParam(buf, sp, idx, value) {
  if (!buf) return;
  const r = DNA_RANGES[idx] || { min: -1, max: 1 };
  const clamped = Math.max(r.min, Math.min(r.max, value));
  const normalized = (clamped - r.min) / (r.max - r.min);
  buf[sp * 64 + idx] = Math.round(normalized * 65535);
}

/** HSL → RGB (0-1 channels) — used by PHENOTYPE gene expression. */
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [r + m, g + m, b + m];
}

let buffer_global = null;

// HISTORY law — coarse spatial memory field (12^3 cells), reset per buffer
const HISTORY_DIM = 12;
const HISTORY_DECAY = 0.97;
let historyField = null;
let historyLast = null;
let historyTick = 0;
let historyBufferRef = null;

// SINGULARITY law — collapse threshold (mass units)
const SINGULARITY_MASS = 20;

/**
 * Set the shared particle buffer reference.
 */
export function setBuffer(buffer) {
  buffer_global = buffer;
  if (buffer !== historyBufferRef) {
    historyBufferRef = buffer;
    historyField = new Float32Array(HISTORY_DIM * HISTORY_DIM * HISTORY_DIM);
    historyLast = new Uint32Array(HISTORY_DIM * HISTORY_DIM * HISTORY_DIM);
    historyTick = 0;
  }
}

function readDNA(ptr, dnaIndex) {
  return buffer_global[ptr + DNA_BASE + dnaIndex];
}

function clamp(val, lo, hi) {
  if (val < lo) return lo;
  if (val > hi) return hi;
  return val;
}

function nanGuard(val) {
  return (val !== val) ? 0 : val;
}

// ============================================================================
// 1. GRAVITY
// ============================================================================
export function applyGravity(p1Ptr, p2Ptr, dx, dy, dz, dist, G, out) {
  const buf = buffer_global;
  const SOFTENING = 0.5;
  const m1 = readDNA(p1Ptr, D.HIDDEN_MASS) + buf[p1Ptr + S.MASS];
  const m2 = readDNA(p2Ptr, D.HIDDEN_MASS) + buf[p2Ptr + S.MASS];
  const dist2 = dist * dist + SOFTENING;
  let force = G * m1 * m2 / dist2;

  // FORCE DNA (0): pairwise gravity modifier — like signs multiply the pull
  // (both negative invert it into repulsion), opposite signs cancel each
  // other out leaving a gravitationally neutral pair. ±100 range → ±2 cap.
  const forceA = readDNA(p1Ptr, D.FORCE) || 0;
  const forceB = readDNA(p2Ptr, D.FORCE) || 0;
  if (forceA !== 0 || forceB !== 0) {
    const combined = forceA + forceB;
    if (Math.abs(combined) > 0.001) {
      const fScale = Math.max(-2, Math.min(2, combined / 25));
      force *= 1 + Math.abs(fScale) * 0.5;
      if (combined < 0) force = -force;
    } else {
      force = 0; // opposite signs cancel each other out
    }
  }

  // TIDAL DNA (15): differential structural forces — close encounters pull
  // harder (stronger with higher |TIDAL|).
  const tidal = readDNA(p1Ptr, D.TIDAL);
  if (Number.isFinite(tidal) && tidal !== 0) {
    force *= 1 + tidal * 0.5 * Math.max(0, 1 - dist / 100);
  }

  const invDist = 1.0 / (dist + 0.001);
  const fx = nanGuard(dx * invDist * force);
  const fy = nanGuard(dy * invDist * force);
  const fz = nanGuard(dz * invDist * force);
  // Allocation-free fast path: write into the caller's scratch object.
  if (out) { out.ax = fx; out.ay = fy; out.az = fz; return out; }
  return { ax: fx, ay: fy, az: fz };
}

// ============================================================================
// 2. DRAG
// ============================================================================
export function applyDrag(vx, vy, vz, friction) {
  const damp = 1.0 - clamp(friction, 0, 1);
  return {
    ax: nanGuard(vx * damp - vx),
    ay: nanGuard(vy * damp - vy),
    az: nanGuard(vz * damp - vz),
  };
}

// ============================================================================
// 4. COLLISION
// ============================================================================
export function applyCollision(p1Ptr, p2Ptr, stride, dx, dy, dz, dist) {
  const buf = buffer_global;
  const m1 = buf[p1Ptr + S.MASS];
  const m2 = buf[p2Ptr + S.MASS];
  const r1 = buf[p1Ptr + S.RADIUS];
  const r2 = buf[p2Ptr + S.RADIUS];
  const overlap = (r1 + r2) - dist;

  if (overlap <= 0) return { ax: 0, ay: 0, az: 0 };

  const elasticity = readDNA(p1Ptr, D.ELASTICITY);
  const invDist = 1.0 / Math.max(dist, 0.01);
  const nx = dx * invDist;
  const ny = dy * invDist;
  const nz = dz * invDist;

  const dvx = buf[p1Ptr + S.VEL_X] - buf[p2Ptr + S.VEL_X];
  const dvy = buf[p1Ptr + S.VEL_Y] - buf[p2Ptr + S.VEL_Y];
  const dvz = buf[p1Ptr + S.VEL_Z] - buf[p2Ptr + S.VEL_Z];
  const relVelN = dvx * nx + dvy * ny + dvz * nz;

  if (relVelN > 0) return { ax: 0, ay: 0, az: 0 };

  const totalMass = m1 + m2;
  const impulse = -(1 + elasticity) * relVelN / totalMass;

  return {
    ax: nanGuard(impulse * m2 * nx),
    ay: nanGuard(impulse * m2 * ny),
    az: nanGuard(impulse * m2 * nz),
  };
}

// ============================================================================
// 5. ACCRETION
// ============================================================================
export function applyAccretion(p1Ptr, p2Ptr, stride, fusion, fusionMomentum) {
  const buf = buffer_global;
  const dx = buf[p2Ptr + S.POS_X] - buf[p1Ptr + S.POS_X];
  const dy = buf[p2Ptr + S.POS_Y] - buf[p1Ptr + S.POS_Y];
  const dz = buf[p2Ptr + S.POS_Z] - buf[p1Ptr + S.POS_Z];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const r1 = buf[p1Ptr + S.RADIUS];
  const r2 = buf[p2Ptr + S.RADIUS];
  const m2 = buf[p2Ptr + S.MASS];

  if (dist < (r1 + r2) * fusion * 0.5) {
    const dvx = buf[p2Ptr + S.VEL_X] - buf[p1Ptr + S.VEL_X];
    const dvy = buf[p2Ptr + S.VEL_Y] - buf[p1Ptr + S.VEL_Y];
    const dvz = buf[p2Ptr + S.VEL_Z] - buf[p1Ptr + S.VEL_Z];
    const relSpeed = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);

    if (relSpeed < fusionMomentum * 2.0) {
      const m1 = buf[p1Ptr + S.MASS];
      const gain = m2 * 0.3;
      // Gene Fusion: blend DNA from consumed particle into survivor
      const dnaBlend = Math.min(1.0, gain / (m1 + 0.001));
      for (let t = 0; t < 42; t++) {
        const pv = buf[p1Ptr + S.DNA_CACHE_START + t] || 0;
        const ov = buf[p2Ptr + S.DNA_CACHE_START + t] || 0;
        buf[p1Ptr + S.DNA_CACHE_START + t] = pv + (ov - pv) * dnaBlend * 0.5;
      }
      // Color blending
      const ratio = gain / (m1 + gain + 0.001);
      buf[p1Ptr + S.COLOR_R] += (buf[p2Ptr + S.COLOR_R] - buf[p1Ptr + S.COLOR_R]) * ratio;
      buf[p1Ptr + S.COLOR_G] += (buf[p2Ptr + S.COLOR_G] - buf[p1Ptr + S.COLOR_G]) * ratio;
      buf[p1Ptr + S.COLOR_B] += (buf[p2Ptr + S.COLOR_B] - buf[p1Ptr + S.COLOR_B]) * ratio;

      buf[p1Ptr + S.MASS] += gain;
      buf[p2Ptr + S.MASS] = m2 - gain;
      if (buf[p2Ptr + S.MASS] <= 0.1) buf[p2Ptr + S.DEAD] = 1.0;
    }
  }
  return { ax: 0, ay: 0, az: 0 };
}

// ============================================================================
// 6. TRACKING (Attraction toward same-species neighbors)
// ============================================================================
export function applyTracking(p1Ptr, p2Ptr, stride, dx, dy, dz, dist) {
  const buf = buffer_global;
  const s1 = buf[p1Ptr + S.SPECIES_ID];
  const s2 = buf[p2Ptr + S.SPECIES_ID];
  if (s1 !== s2) return { ax: 0, ay: 0, az: 0 };

  const strength = 0.1;
  const invDist = 1.0 / Math.max(dist, 0.01);
  return {
    ax: nanGuard(dx * invDist * strength),
    ay: nanGuard(dy * invDist * strength),
    az: nanGuard(dz * invDist * strength),
  };
}

// ============================================================================
// 6b. PREDATION (Mass-difference based pursuit/flee + gene absorption on contact)
// ============================================================================
export function applyPredation(p1Ptr, p2Ptr, stride, dx, dy, dz, dist, prng) {
  const buf = buffer_global;
  // A predator never hunts its own kind (matches TRACK's documented
  // ecosystem behavior — predation is strictly cross-species).
  if (buf[p1Ptr + S.SPECIES_ID] === buf[p2Ptr + S.SPECIES_ID]) {
    return { ax: 0, ay: 0, az: 0 };
  }
  const mass1 = buf[p1Ptr + S.MASS];
  const mass2 = buf[p2Ptr + S.MASS];
  const massDiff = mass1 - mass2;
  if (Math.abs(massDiff) < 0.5) return { ax: 0, ay: 0, az: 0 };

  const r1 = buf[p1Ptr + S.RADIUS];
  const r2 = buf[p2Ptr + S.RADIUS];
  const invDist = 1.0 / Math.max(dist, 0.01);

  if (massDiff > 0.5) {
    // p1 is predator: pursue p2
    const predBias = readDNA(p1Ptr, D.PREDATION_BIAS) || 0;
    const strength = predBias * 0.1 * mass2 * invDist;
    const force = {
      ax: nanGuard(dx * invDist * strength),
      ay: nanGuard(dy * invDist * strength),
      az: nanGuard(dz * invDist * strength),
    };
    // Gene absorption on contact
    if (dist < r1 + r2 && predBias > 0.1) {
      const absorpRate = 0.05;
      const roll = (prng && typeof prng === 'function') ? prng : Math.random;
      for (let t = 0; t < 5; t++) {
        const trait = Math.floor(roll() * 42);
        const preyVal = buf[p2Ptr + S.DNA_CACHE_START + trait] || 0;
        const predVal = buf[p1Ptr + S.DNA_CACHE_START + trait] || 0;
        buf[p1Ptr + S.DNA_CACHE_START + trait] = predVal + (preyVal - predVal) * absorpRate;
      }
      // Mass transfer
      const transfer = Math.min(0.5, mass2 * 0.1);
      buf[p1Ptr + S.MASS] += transfer * 0.5;
      buf[p2Ptr + S.MASS] -= transfer;
    }
    return force;
  } else {
    // p1 is prey: flee from p2
    const jitter = readDNA(p1Ptr, D.JITTER) || 0.1;
    const strength = jitter * 0.2 * invDist;
    return {
      ax: nanGuard(-dx * invDist * strength),
      ay: nanGuard(-dy * invDist * strength),
      az: nanGuard(-dz * invDist * strength),
    };
  }
}

// ============================================================================
// 7. SOLVATION
// ============================================================================
export function applySolvation(p1Ptr, p2Ptr, stride, dx, dy, dz, dist, synergy) {
  const buf = buffer_global;
  const charge1 = buf[p1Ptr + S.CHARGE];
  const charge2 = buf[p2Ptr + S.CHARGE];
  if (charge1 === 0 || charge2 === 0) return { ax: 0, ay: 0, az: 0 };

  const strength = 0.05 * Math.abs(charge1 * charge2) * (synergy || 1);
  const invDist = 1.0 / Math.max(dist, 0.01);
  // Real-world solvation (batch-05 confirmation): the solvent pulls
  // opposite-charge ions together and pushes like charges apart — the same
  // Coulomb rule that dissolves salt crystals and keeps ions dispersed.
  const sign = charge1 * charge2 < 0 ? 1 : -1;
  return {
    ax: nanGuard(dx * invDist * strength * sign),
    ay: nanGuard(dy * invDist * strength * sign),
    az: nanGuard(dz * invDist * strength * sign),
  };
}

// ============================================================================
// 8. POLYMERIZATION
// ============================================================================
export function applyPolymerization(p1Ptr, p2Ptr, stride, dx, dy, dz, dist) {
  const buf = buffer_global;
  if (dist > 30) return { ax: 0, ay: 0, az: 0 };

  const bondCount = buf[p1Ptr + S.BOND_COUNT];
  if (bondCount >= 6) return { ax: 0, ay: 0, az: 0 };

  if (dist < 15) {
    const partnerSlot = S.BOND_PARTNER_1 + Math.floor(bondCount);
    if (partnerSlot <= S.BOND_PARTNER_2) {
      buf[p1Ptr + partnerSlot] = p2Ptr / stride;
      buf[p1Ptr + S.BOND_COUNT] = bondCount + 1;
    }
  }

  return { ax: 0, ay: 0, az: 0 };
}

// ============================================================================
// 9. ACIDITY
// ============================================================================
export function applyAcidity(p1Ptr, p2Ptr, stride, dt) {
  const buf = buffer_global;
  const charge1 = buf[p1Ptr + S.CHARGE];
  const charge2 = buf[p2Ptr + S.CHARGE];
  const conductivity = readDNA(p1Ptr, D.CONDUCTIVITY);

  if (Math.abs(charge1 - charge2) < 0.1) return { ax: 0, ay: 0, az: 0 };

  const transfer = (charge1 - charge2) * conductivity * dt * 0.1;
  buf[p1Ptr + S.CHARGE] -= transfer;
  buf[p2Ptr + S.CHARGE] += transfer;

  return { ax: 0, ay: 0, az: 0 };
}

// ============================================================================
// 10. OXIDATION
// ============================================================================
export function applyOxidation(p1Ptr, p2Ptr, stride, dt) {
  const buf = buffer_global;
  const charge1 = buf[p1Ptr + S.CHARGE];
  const charge2 = buf[p2Ptr + S.CHARGE];
  const conductivity = readDNA(p1Ptr, D.CONDUCTIVITY);
  const heatOutput = readDNA(p1Ptr, D.HEAT_OUTPUT);

  if (Math.abs(charge1 - charge2) < 0.1) return { ax: 0, ay: 0, az: 0 };

  const transfer = (charge1 - charge2) * conductivity * dt * 0.1;
  buf[p1Ptr + S.CHARGE] -= transfer;
  buf[p2Ptr + S.CHARGE] += transfer;

  const energyRelease = Math.abs(transfer) * heatOutput * 100.0;
  buf[p1Ptr + S.ENERGY] += energyRelease * 0.5;
  buf[p2Ptr + S.ENERGY] += energyRelease * 0.5;
  buf[p1Ptr + S.TEMPERATURE] += energyRelease * 0.01;
  buf[p2Ptr + S.TEMPERATURE] += energyRelease * 0.01;

  return { ax: 0, ay: 0, az: 0 };
}

// ============================================================================
// 11. HEAT
// ============================================================================
export function applyHeat(p1Ptr, stride, dt) {
  const buf = buffer_global;
  const temp = buf[p1Ptr + S.TEMPERATURE];
  const energyEfficiency = readDNA(p1Ptr, D.ENERGY_EFFICIENCY);

  if (temp < 0.01) return { ax: 0, ay: 0, az: 0 };

  const thermalScale = Math.sqrt(temp) * energyEfficiency * dt;
  const t = performance.now();
  const r1 = Math.sin(t * 12.9898 + p1Ptr * 78.233) * 43758.5453;
  const r2 = Math.sin(t * 78.233 + p1Ptr * 12.9898) * 43758.5453;
  const r3 = Math.sin(t * 43.111 + p1Ptr * 34.567) * 43758.5453;
  const n1 = (r1 - Math.floor(r1)) * 2.0 - 1.0;
  const n2 = (r2 - Math.floor(r2)) * 2.0 - 1.0;
  const n3 = (r3 - Math.floor(r3)) * 2.0 - 1.0;

  buf[p1Ptr + S.VEL_X] += n1 * thermalScale;
  buf[p1Ptr + S.VEL_Y] += n2 * thermalScale;
  buf[p1Ptr + S.VEL_Z] += n3 * thermalScale;
  buf[p1Ptr + S.TEMPERATURE] *= 0.99;

  return { ax: 0, ay: 0, az: 0 };
}

// ============================================================================
// 12. COLD
// ============================================================================
export function applyCold(p1Ptr, stride) {
  const buf = buffer_global;
  const temp = buf[p1Ptr + S.TEMPERATURE];

  if (temp >= 0.5) return { ax: 0, ay: 0, az: 0 };

  const coldFactor = 1.0 - (0.5 - temp);
  const damping = clamp(coldFactor, 0.1, 1.0);

  buf[p1Ptr + S.VEL_X] *= damping;
  buf[p1Ptr + S.VEL_Y] *= damping;
  buf[p1Ptr + S.VEL_Z] *= damping;

  for (let offset = S.VEL_X; offset <= S.VEL_Z; offset++) {
    if (buf[p1Ptr + offset] !== buf[p1Ptr + offset]) buf[p1Ptr + offset] = 0;
  }

  return { ax: 0, ay: 0, az: 0 };
}

// ============================================================================
// 13. GENOTYPE (Radiation field / DNA mutation)
// ============================================================================
export function applyGenotype(p1Ptr, stride, dt) {
  const buf = buffer_global;
  const mutationRate = readDNA(p1Ptr, D.MUTATION);
  const temperature = buf[p1Ptr + S.TEMPERATURE];

  if (mutationRate < 0.01) return { ax: 0, ay: 0, az: 0 };

  const mutProb = mutationRate * (1.0 + temperature) * dt * 0.01;
  if (mutProb < 0.001) return { ax: 0, ay: 0, az: 0 };

  const numMutations = Math.floor(mutProb * 3) + 1;
  const dnaStart = DNA_BASE;

  for (let m = 0; m < numMutations; m++) {
    const hashVal = Math.sin(p1Ptr * 127.1 + m * 311.7 + performance.now() * 0.001) * 43758.5453;
    const dnaIdx = Math.abs(Math.floor(hashVal)) % 42;
    const perturbHash = Math.sin(p1Ptr * 269.5 + dnaIdx * 183.3) * 43758.5453;
    const perturb = ((perturbHash - Math.floor(perturbHash)) * 2.0 - 1.0) * mutationRate * 0.05;
    buf[p1Ptr + dnaStart + dnaIdx] += perturb;
  }

  return { ax: 0, ay: 0, az: 0 };
}

// ============================================================================
// 14. PLANETARY (Atmospheric gravity — confirmed batch-02 semantics)
// ============================================================================
// A constant downward force toward the ground plane (z ≈ 0), simulating
// particles that are much smaller than the world and fall through a planet's
// atmosphere. Force is scaled by mass so the resulting acceleration is
// mass-independent — every particle falls at the same rate. Combined with
// GRAV the pull is ×1.5. With WRAP off the soft-wall clamp turns z = 0 into
// the ground; with WRAP on the planet world still falls toward the band.
export function applyPlanetary(lawState, view, base, px, py, pz, worldSize, synergy) {
  if (!isSet(lawState, LAW_INDEXES.PLANETARY)) return null; // LAW_INDEXES.PLANETARY = 6

  const mass = view[base + S.MASS] || 1.0;
  const strength = 0.02 * synergy;
  return {
    ax: 0,
    ay: 0,
    az: -strength * mass,
  };
}

// ============================================================================
// 15. LIFE CYCLE
// ============================================================================
export function applyLifeCycle(lawState, view, base, dnaParams, dt, prng, synergy, dnaBuffer) {
  if (!isSet(lawState, LAW_INDEXES.LIFE)) return; // LAW_INDEXES.LIFE = 7

  // AGE is advanced by the solver core each tick (frame count), not here.
  const age = view[base + S.AGE];

  let energy = view[base + S.ENERGY];
  const decayRate = 0.01 * (1 - dnaParams[34] * synergy) * (worldParams().DECAY_RATE ?? 1); // ENERGY_EFFICIENCY=34
  energy -= decayRate * dt;
  // Photosynthesis — LIGHT_LEVEL feeds a slow energy subsidy to life.
  energy += 0.02 * (worldParams().LIGHT_LEVEL ?? 0.5) * dt;
  // When the metabolic budget hits 0 the organism dies (confirmed batch-02
  // semantics). This is the LIFE metabolic path only — charge/electromagnetic
  // dynamics live in their own fields and laws and do not trigger it.
  if (energy <= 0) {
    view[base + S.ENERGY] = 0;
    view[base + S.DEAD] = 1.0;
    return;
  }
  view[base + S.ENERGY] = energy;

  let hunger = view[base + S.HUNGER] + dt * 0.02;
  if (hunger > 100) {
    view[base + S.DEAD] = 1.0;
    return;
  }
  view[base + S.HUNGER] = hunger;

  // === BIOLOGICAL VARIANCE ===
  const ageNorm = Math.min(1.0, age / 5000);
  const birthRate = Math.abs(dnaParams[10] || 0.5); // BIRTH_RATE=10
  const mutRate = Math.abs(dnaParams[12] || 0.5); // MUTATION=12

  // Age-based color drift (biological fading)
  view[base + S.COLOR_R] += (Math.sin(age * 0.001) * 2.0 * mutRate);
  view[base + S.COLOR_G] += (Math.cos(age * 0.0007) * 2.0 * mutRate);
  view[base + S.COLOR_B] += (Math.sin(age * 0.0013 + 1.0) * 2.0 * mutRate);

  // Mass fluctuation from metabolism — accretion-style mass gain/loss only
  // while the ACCR law governs it (LIFE alone must not grow/shrink mass).
  if (isSet(lawState, LAW_INDEXES.ACCR)) {
    const mass = view[base + S.MASS] || 1.0;
    const massFluctuation = (energy - 50) * 0.0001 * birthRate;
    view[base + S.MASS] += massFluctuation * dt;
  }

  // Bio-rhythm energy pulse
  const bioPulse = Math.sin(age * 0.01 * birthRate) * 0.5 * mutRate;
  view[base + S.ENERGY] += bioPulse * dt * 0.1;

  // Clamp values
  view[base + S.COLOR_R] = Math.max(0, Math.min(255, view[base + S.COLOR_R] || 0));
  view[base + S.COLOR_G] = Math.max(0, Math.min(255, view[base + S.COLOR_G] || 0));
  view[base + S.COLOR_B] = Math.max(0, Math.min(255, view[base + S.COLOR_B] || 0));
  view[base + S.MASS] = Math.max(0.1, Math.min(50, view[base + S.MASS] || 1));
  // === END BIOLOGICAL VARIANCE ===

  // Senescence (LAW_INDEXES.SENESCENCE = 12)
  if (isSet(lawState, LAW_INDEXES.SENESCENCE)) {
    // TELOMERE_LENGTH (60, genome-only) — longer telomeres resist aging death.
    const telomere = dnaBuffer ? readSpeciesDNAParam(dnaBuffer, view[base + S.SPECIES_ID] || 0, 60) : 0.5;
    const deathRate = dnaParams[11] * 0.001 * (1.0 + ageNorm * 0.5) * (1 - telomere * 0.5);
    if (age > 500 && prng() < deathRate * dt) {
      view[base + S.DEAD] = 1.0;
      return;
    }
  }

  // Radiation damage lives in the standalone RADIATION law (applyRadiationDamage)
  // — applying it here as well would double-drain every irradiated organism.
}

// ============================================================================
// 16. SIGNAL DECAY
// ============================================================================
export function applySignalDecay(lawState, view, base, dnaParams, dt) {
  if (!isSet(lawState, LAW_INDEXES.COMMS)) return; // COMMS=52
  // v4 — communication DNA, gated by the COMMS law: oscillator emission + decay.
  const decay = dnaParams[20]; // SIGNAL_DECAY=20 (0.1–0.99)
  const pulseRate = dnaParams[14]; // PULSE_RATE=14 (0–1)
  const strength = dnaParams[19]; // SIGNAL_STRENGTH=19 (0–1)
  const memDecay = dnaParams[40]; // MEMORY_DECAY=40 (0.9–1.0)
  let signal = view[base + S.SIGNAL] || 0;
  signal *= Math.pow(Math.max(0.1, decay), dt);
  const phase = Math.sin((view[base + S.AGE] || 0) * 0.01 * (0.1 + pulseRate));
  if (phase > 0) {
    signal += phase * pulseRate * strength * dt * 0.05 * runtimeConfig.signalScale;
  }
  if (signal > 1) signal = 1;
  if (signal < 0) signal = 0;
  view[base + S.SIGNAL] = signal;
  // Memory trace decays toward zero each tick
  const mem = view[base + S.MEMORY] || 0;
  view[base + S.MEMORY] = mem * Math.pow(memDecay || 0.99, dt);
}

// ============================================================================
// 60. SIGNAL EXCHANGE — channel-filtered pairwise communication
// ============================================================================

/** Channel compatibility: normalized dot product of receiver × sender tuning (TUNING_CH1-4). */
function channelMatch(receiverDna, senderDna) {
  let dot = 0, rMag = 0, sMag = 0;
  for (let c = 0; c < 4; c++) {
    const r = receiverDna[22 + c] || 0;
    const s = senderDna[22 + c] || 0;
    dot += r * s;
    rMag += r * r;
    sMag += s * s;
  }
  if (rMag < 1e-6 || sMag < 1e-6) return 1.0; // untuned channels are open
  return Math.max(0, dot / Math.sqrt(rMag * sMag));
}

/**
 * Pairwise signal propagation. A particle's SIGNAL field radiates toward
 * neighbors within NEIGHBORHOOD_RADIUS; the receiver's SIGNAL_RESP converts
 * delivered signal into attraction force + energy, filtered by TUNING_CH*.
 * @returns {{ax:number,ay:number,az:number}|null} response force (or null)
 */
/** ENCRYPTION key (v4.6.29) — folded from the TUNING_CH1-4 channels. */
export function cipherKey(view, base) {
  const d = S.DNA_CACHE_START;
  const sum = (view[base + d + D.TUNING_CH1] || 0)
    + (view[base + d + D.TUNING_CH2] || 0)
    + (view[base + d + D.TUNING_CH3] || 0)
    + (view[base + d + D.TUNING_CH4] || 0);
  return Math.floor(Math.max(0, Math.min(1, sum / 4)) * 7);
}

export function applySignalExchange(lawState, view, iBase, jBase, dx, dy, dz, dist, dnaI, dnaJ, dt) {
  if (!isSet(lawState, LAW_INDEXES.COMMS)) return null; // COMMS=52
  const sI = view[iBase + S.SIGNAL] || 0;
  const sJ = view[jBase + S.SIGNAL] || 0;
  if (sI < 0.01 && sJ < 0.01) return null;

  // ENCRYPTION gate (v4.6.29): keyed cipher — only matching keys decode the
  // channel; mismatched keys absorb the transmission as noise.
  if (isSet(lawState, LAW_INDEXES.ENCRYPTION)) {
    if (cipherKey(view, iBase) !== cipherKey(view, jBase)) {
      view[iBase + S.SIGNAL] = Math.max(0, sI - 0.01);
      view[jBase + S.SIGNAL] = Math.max(0, sJ - 0.01);
      return null;
    }
  }

  const nRadius = ((dnaI[18] || 120) + (dnaJ[18] || 120)) * 0.5; // NEIGHBORHOOD_RADIUS
  if (dist > nRadius) return null;

  const respI = dnaI[13] || 0;   // SIGNAL_RESP
  const respJ = dnaJ[13] || 0;
  const strI = dnaI[19] || 0;    // SIGNAL_STRENGTH
  const strJ = dnaJ[19] || 0;
  const propI = dnaI[21] || 0.5; // PROPAGATION_SPEED
  const propJ = dnaJ[21] || 0.5;
  const chI = channelMatch(dnaI, dnaJ); // i receives j
  const chJ = channelMatch(dnaJ, dnaI); // j receives i

  const invDist = 1.0 / Math.max(dist, 0.01);
  const scale = runtimeConfig.signalScale;
  let ax = 0, ay = 0, az = 0;

  // j → i: the receiver gains signal + memory + homing force, the sender
  // pays the emission cost (confirmed batch-14: signalling is no longer a
  // free energy source).
  if (sJ > 0.01 && respI > 0.01) {
    const delivered = sJ * strJ * propI * chI * dt * scale;
    view[iBase + S.SIGNAL] = Math.min(1, (view[iBase + S.SIGNAL] || 0) + delivered);
    view[iBase + S.MEMORY] = (view[iBase + S.MEMORY] || 0) + delivered;
    const eJ = view[jBase + S.ENERGY];
    if (Number.isFinite(eJ)) view[jBase + S.ENERGY] = Math.max(0, eJ - delivered * 0.5);
    const forceMag = respI * delivered * 0.05;
    ax += dx * invDist * forceMag;
    ay += dy * invDist * forceMag;
    az += dz * invDist * forceMag;
  }

  // i → j: symmetric — i pays when j receives.
  if (sI > 0.01 && respJ > 0.01) {
    const delivered = sI * strI * propJ * chJ * dt * scale;
    view[jBase + S.SIGNAL] = Math.min(1, (view[jBase + S.SIGNAL] || 0) + delivered);
    view[jBase + S.MEMORY] = (view[jBase + S.MEMORY] || 0) + delivered;
    const eI = view[iBase + S.ENERGY];
    if (Number.isFinite(eI)) view[iBase + S.ENERGY] = Math.max(0, eI - delivered * 0.5);
    const forceMag = respJ * delivered * 0.05;
    ax -= dx * invDist * forceMag;
    ay -= dy * invDist * forceMag;
    az -= dz * invDist * forceMag;
  }

  if (ax === 0 && ay === 0 && az === 0) return null;
  return { ax: nanGuard(ax), ay: nanGuard(ay), az: nanGuard(az) };
}


// ============================================================================
// 17. AFFINITY
// ============================================================================
export function applyAffinity(lawState, view, iBase, jBase, dx, dy, dz, distSq, synergy, out) {
  if (!isSet(lawState, LAW_INDEXES.AFFINITY)) return null; // AFFINITY=9
  if (distSq < 1) return null;

  const speciesI = view[iBase + S.SPECIES_ID];
  const speciesJ = view[jBase + S.SPECIES_ID];
  const affinityI = view[iBase + S.DNA_CACHE_START + 41]; // SPECIES_AFFINITY=41
  const invDist = 1 / Math.sqrt(distSq);

  let fx = 0, fy = 0, fz = 0;
  if (speciesI === speciesJ) {
    // Same-species cohesion: SPECIES_AFFINITY BOOSTS the attraction — the
    // pull grows with positive affinity and is inert at 0. Xenophobic
    // species (affinity < 0) get no same-species pull at all.
    const strength = 0.1 * Math.max(0, affinityI) * synergy * (worldParams().SPECIES_INTERACTION ?? 1);
    fx = dx * invDist * strength;
    fy = dy * invDist * strength;
    fz = dz * invDist * strength;
  } else if (affinityI < 0) {
    const strength = 0.05 * Math.abs(affinityI) * synergy * (worldParams().SPECIES_INTERACTION ?? 1);
    fx = -dx * invDist * strength;
    fy = -dy * invDist * strength;
    fz = -dz * invDist * strength;
  } else {
    return null;
  }

  // Allocation-free fast path: write into the caller's scratch object.
  if (out) { out.ax = fx; out.ay = fy; out.az = fz; return out; }
  return { ax: fx, ay: fy, az: fz };
}

// ============================================================================
// 18. REPRODUCTION
// ============================================================================
export function applyReproduction(lawState, view, base, dnaParams, prng, synergy, dnaBuffer, dt) {
  if (!isSet(lawState, LAW_INDEXES.REPRO)) return null; // REPRO=10

  const energy = view[base + S.ENERGY];
  const age = view[base + S.AGE];
  const birthRate = dnaParams[10]; // BIRTH_RATE=10

  // Reproductive drive is its own energy channel (REPRO_DRIVE stride field):
  // it accumulates from BIRTH_RATE over time and gates reproduction — a
  // particle cannot spawn from raw metabolic energy alone. Spawning consumes
  // the drive and half the parent's life energy.
  let drive = view[base + S.REPRO_DRIVE] || 0;
  drive += birthRate * 0.1 * (dt || 1) * synergy;
  if (drive > 100) drive = 100;
  view[base + S.REPRO_DRIVE] = drive;

  if (drive < 60 || age < 100) return null;
  if (prng() > birthRate * synergy * 0.01) return null;

  view[base + S.REPRO_DRIVE] = 0; // spawning consumes the drive
  view[base + S.ENERGY] = energy * 0.5;

  const px = view[base + S.POS_X];
  const py = view[base + S.POS_Y];
  const pz = view[base + S.POS_Z];
  const speciesId = view[base + S.SPECIES_ID];

  // Genetics params (indices 42-47) come from the species DNA buffer,
  // NOT from the per-particle stride cache (which only holds 0-41).
  const dominance = readSpeciesDNAParam(dnaBuffer, speciesId, 42);
  const crossoverRate = readSpeciesDNAParam(dnaBuffer, speciesId, 43);
  const epigeneticDrift = readSpeciesDNAParam(dnaBuffer, speciesId, 44);
  const heterozygosity = readSpeciesDNAParam(dnaBuffer, speciesId, 45);
  const geneFlow = readSpeciesDNAParam(dnaBuffer, speciesId, 46);
  const repressor = readSpeciesDNAParam(dnaBuffer, speciesId, 47);
  // Genetics & regulatory params (48-63, genome-only).
  const alleleCount = readSpeciesDNAParam(dnaBuffer, speciesId, 48);
  const epigeneticRate = readSpeciesDNAParam(dnaBuffer, speciesId, 49);
  const hgtRate = readSpeciesDNAParam(dnaBuffer, speciesId, 50);
  const repairEfficiency = readSpeciesDNAParam(dnaBuffer, speciesId, 51);
  const transposonRate = readSpeciesDNAParam(dnaBuffer, speciesId, 56);
  const geneSilencing = readSpeciesDNAParam(dnaBuffer, speciesId, 57);
  const recombinationBias = readSpeciesDNAParam(dnaBuffer, speciesId, 58);
  const ploidyLevel = readSpeciesDNAParam(dnaBuffer, speciesId, 61);

  const mutationRate = dnaParams[12] * 0.1; // MUTATION=12
  const offspringDna = new Array(DNA_COUNT);

  // --- Genetics: Crossover ---
  // Check BOND_PARTNER_1 for a potential second parent
  const partnerIdx = view[base + S.BOND_PARTNER_1];
  let hasTwoParents = false;
  const partnerDna = new Array(DNA_COUNT);

  // SEX_CHANCE DNA (35): multi-parent reproduction probability — boosts the
  // crossover/second-parent chance above the species CROSSOVER_RATE baseline.
  const sexChance = Math.abs(dnaParams[35] || 0);
  if (partnerIdx >= 0 && prng() < crossoverRate * (1 + sexChance * 0.5)) {
    const partnerBase = partnerIdx * PARTICLE_STRIDE;
    const partnerSpecies = view[partnerBase + S.SPECIES_ID];
    if (partnerSpecies === speciesId) {
      hasTwoParents = true;
      // Read first 42 DNA values from partner's stride cache
      for (let d = 0; d < 42; d++) {
        partnerDna[d] = view[partnerBase + S.DNA_CACHE_START + d];
      }
      // Fill genetics params (42-63) from species DNA buffer
      for (let d = 42; d < DNA_COUNT; d++) {
        partnerDna[d] = readSpeciesDNAParam(dnaBuffer, speciesId, d);
      }
    }
  }

  // --- Build offspring DNA with crossover, dominance, mutation ---
  for (let d = 0; d < DNA_COUNT; d++) {
    let parentA, parentB;

    if (d < 42) {
      // Core traits: use dnaParams (from stride cache)
      parentA = dnaParams[d] || 0;
      parentB = hasTwoParents ? (partnerDna[d] || 0) : parentA;
    } else {
      // Genetics params (42-63): read from species DNA buffer
      parentA = readSpeciesDNAParam(dnaBuffer, speciesId, d);
      parentB = hasTwoParents ? readSpeciesDNAParam(dnaBuffer, speciesId, d) : parentA;
    }

    let val;
    // PLOIDY_LEVEL (default 2) raises recombination; stays neutral at default.
    if (hasTwoParents && prng() < 0.5 + (ploidyLevel - 2) * 0.05) {
      // Sexual reproduction with dominance; ALLELE_COUNT (default 2) widens
      // the blend window; RECOMBINATION_BIAS skews which parent dominates.
      if (prng() < 0.3 + (alleleCount - 2) * 0.05) {
        // Crossover: blend both parents
        val = (parentA + parentB) * 0.5;
      } else if (prng() < Math.max(0, Math.min(1, dominance + recombinationBias * 0.3))) {
        // Dominant: favor higher magnitude
        val = Math.abs(parentA) > Math.abs(parentB) ? parentA : parentB;
      } else {
        // Recessive: favor lower magnitude
        val = Math.abs(parentA) < Math.abs(parentB) ? parentA : parentB;
      }
    } else {
      // Asexual: clone parent
      val = parentA;
    }

    // Apply mutation (scaled by repressor, REPAIR_EFFICIENCY, GENE_SILENCING;
    // TRANSPOSON_RATE amplifies the leap — a mobile-element burst).
    const effectiveMutation = mutationRate * (1 - repressor * 0.5)
      * (1 - repairEfficiency * 0.5)
      * (1 - geneSilencing * 0.3)
      * (1 + transposonRate * 4)
      * (worldParams().MUTATION_RATE ?? 1);
    val += (prng() - 0.5) * effectiveMutation * 10;

    // Apply epigenetic drift (non-heritable noise; EPIGENETIC_RATE scales it)
    val += (prng() - 0.5) * epigeneticDrift * 5 * (1 + epigeneticRate * 3);

    // Gene flow: horizontal transfer from other species (GENE_FLOW + HGT_RATE)
    if (prng() < geneFlow * 0.01 + hgtRate * 0.02) {
      const otherSpecies = Math.floor(prng() * 5) % 64;
      if (otherSpecies !== speciesId) {
        const foreignGene = readSpeciesDNAParam(dnaBuffer, otherSpecies, d);
        val += (foreignGene - val) * 0.1;
      }
    }

    offspringDna[d] = Math.max(-100, Math.min(100, val));
  }

  // Offspring colour = the parents' intermediate colour. Two parents blend
  // 50/50; a single parent clones its own colour, with slight mutation.
  let colorR = view[base + S.COLOR_R];
  let colorG = view[base + S.COLOR_G];
  let colorB = view[base + S.COLOR_B];
  if (hasTwoParents) {
    const partnerBase = partnerIdx * PARTICLE_STRIDE;
    colorR = (colorR + view[partnerBase + S.COLOR_R]) * 0.5;
    colorG = (colorG + view[partnerBase + S.COLOR_G]) * 0.5;
    colorB = (colorB + view[partnerBase + S.COLOR_B]) * 0.5;
  }
  const colorMut = Math.abs(mutationRate) * 12;
  colorR = Math.max(0, Math.min(255, colorR + (prng() - 0.5) * colorMut));
  colorG = Math.max(0, Math.min(255, colorG + (prng() - 0.5) * colorMut));
  colorB = Math.max(0, Math.min(255, colorB + (prng() - 0.5) * colorMut));

  return {
    parentId: Math.floor(base / PARTICLE_STRIDE),
    x: px + (prng() - 0.5) * 20,
    y: py + (prng() - 0.5) * 20,
    z: pz + (prng() - 0.5) * 20,
    vx: 0, vy: 0, vz: 0,
    speciesId,
    mass: view[base + S.MASS] * 0.8,
    energy: 60,
    dna: offspringDna,
    colorR, colorG, colorB,
  };
}

// ============================================================================
// 19. CHEMISTRY MODIFIER
// ============================================================================
// 19. CHEMISTRY MODIFIER
// ============================================================================
export function applyChemistry(lawState, view, iBase, jBase, distSq, synergy) {
  let multiplier = 1.0;

  if (isSet(lawState, LAW_INDEXES.CATALYSIS_LAW)) { // CATALYSIS_LAW=17
    const catI = view[iBase + S.DNA_CACHE_START + 38]; // CATALYSIS=38
    multiplier *= 1.0 + catI * 0.5 * synergy;
  }

  if (isSet(lawState, LAW_INDEXES.SOLVATION)) multiplier *= 1.2; // SOLVATION=18

  if (isSet(lawState, LAW_INDEXES.ACIDITY)) { // ACIDITY=19
    const chargeI = view[iBase + S.CHARGE];
    const chargeJ = view[jBase + S.CHARGE];
    const polarity = Math.abs(chargeI - chargeJ);
    multiplier *= 1.0 + polarity * 0.3;
  }

  if (isSet(lawState, LAW_INDEXES.CRYSTALLIZATION) && distSq < 100) { // CRYSTALLIZATION=24
    multiplier *= 1.5;
  }

  return multiplier;
}

// ============================================================================
// 20. POLYMER (bond formation)
// ============================================================================
export function applyPolymer(lawState, view, iBase, jBase, dx, dy, dz, dist, synergy, stride) {
  if (!isSet(lawState, LAW_INDEXES.POLYMER)) return { ax: 0, ay: 0, az: 0 };
  if (dist > 25) return { ax: 0, ay: 0, az: 0 };

  // Batch-06 confirmation ("match documentation"): up to 6 bonds per particle
  // (BOND_PARTNER_1..6), tracked mutually — when i chains to j, j chains back
  // to i, so A-B-C topology is stable on both ends.
  const iIdx = Math.round(iBase / stride);
  const jIdx = Math.round(jBase / stride);
  const bondCount = view[iBase + S.BOND_COUNT];
  const jBondCount = view[jBase + S.BOND_COUNT];

  let alreadyBonded = false;
  for (const slot of BOND_SLOTS) {
    if (view[iBase + slot] === jIdx || view[jBase + slot] === iIdx) {
      alreadyBonded = true;
      break;
    }
  }
  // Batch-10: chain bias — polymers prefer extending chains: free/tip
  // particles (0-1 bonds) bond eagerly, well-connected particles (3+) are
  // avoided, so POLYMER grows linear chains instead of cross-linked webs.
  const chainBias = jBondCount <= 1 ? 1.0 : (jBondCount >= 3 ? 0.25 : 0.5);
  if (!alreadyBonded && bondCount < 6 && jBondCount < 6 && dist < 10 * synergy * chainBias) {
    for (const slot of BOND_SLOTS) {
      if (view[iBase + slot] < 0) {
        view[iBase + slot] = jIdx;
        view[iBase + S.BOND_COUNT] = bondCount + 1;
        break;
      }
    }
    for (const slot of BOND_SLOTS) {
      if (view[jBase + slot] < 0) {
        view[jBase + slot] = iIdx;
        view[jBase + S.BOND_COUNT] = jBondCount + 1;
        break;
      }
    }
  }
  // Spring force to maintain polymer chain
  if (dist < 0.1) return { ax: 0, ay: 0, az: 0 };
  const stiffness = 0.02 * synergy;
  const restLen = 4.0;
  const displacement = dist - restLen;
  const forceMag = stiffness * displacement;
  const invDist = 1.0 / dist;
  return {
    ax: dx * invDist * forceMag,
    ay: dy * invDist * forceMag,
    az: dz * invDist * forceMag,
  };
}

// ============================================================================
// 21. HEAT TRANSFER
// ============================================================================
export function applyHeatTransfer(lawState, view, iBase, jBase, dist, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.HEAT) && !isSet(lawState, LAW_INDEXES.COLD)) return; // HEAT=25, COLD=26

  const tempI = view[iBase + S.TEMPERATURE];
  const tempJ = view[jBase + S.TEMPERATURE];
  const diff = tempI - tempJ;

  if (isSet(lawState, LAW_INDEXES.HEAT)) {
    const rate = 0.01 * dt * synergy / (worldParams().HEAT_CAPACITY ?? 1);
    view[iBase + S.TEMPERATURE] -= diff * rate;
    view[jBase + S.TEMPERATURE] += diff * rate;
  }

  if (isSet(lawState, LAW_INDEXES.COLD) && tempJ > tempI) {
    const rate = 0.015 * dt * synergy / (worldParams().HEAT_CAPACITY ?? 1);
    const tDec2 = -diff * rate;
    const tInc2 = -diff * rate;
    view[jBase + S.TEMPERATURE] -= (tDec2 !== tDec2) ? 0 : tDec2;
    view[iBase + S.TEMPERATURE] += (tInc2 !== tInc2) ? 0 : tInc2;
  }
}

// ============================================================================
// 21b. THERMAL JITTER (HEAT) — hot particles get kinetic-theory random kicks
// ============================================================================
export function applyThermalJitter(lawState, view, base, dt, synergy, prng) {
  if (!isSet(lawState, LAW_INDEXES.HEAT)) return; // HEAT=25
  const temp = view[base + S.TEMPERATURE];
  if (!Number.isFinite(temp) || temp <= 0.5) return;
  const kick = temp * 0.01 * dt * synergy;
  view[base + S.VEL_X] += (prng() - 0.5) * 2 * kick;
  view[base + S.VEL_Y] += (prng() - 0.5) * 2 * kick;
  view[base + S.VEL_Z] += (prng() - 0.5) * 2 * kick;
}

// ============================================================================
// 21c. COLD DAMPING — cold particles (< 0.5 TEMP) are slowed toward stillness
// ============================================================================
export function applyColdDamping(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.COLD)) return; // COLD=26
  const temp = view[base + S.TEMPERATURE];
  if (!Number.isFinite(temp) || temp >= 0.5) return;
  const damp = Math.max(0, 1 - (0.5 - temp) * 0.1 * dt * synergy);
  view[base + S.VEL_X] *= damp;
  view[base + S.VEL_Y] *= damp;
  view[base + S.VEL_Z] *= damp;
}

// ============================================================================
// 22. CONVECTION
// ============================================================================
export function applyConvection(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.CONVECTION)) return; // CONVECTION=27

  const temp = view[base + S.TEMPERATURE];
  const buoyancy = (temp - 0.5) * 0.001 * dt * synergy;
  if (Number.isFinite(buoyancy)) {
    view[base + S.VEL_Y] += buoyancy;
  }
}

// ============================================================================
// 23. TIME DILATION
// ============================================================================
export function applyTimeDilation(lawState, view, base, synergy, neighborList, neighborCount, worldSize) {
  if (!isSet(lawState, LAW_INDEXES.TIME_DILATION)) return 1.0; // TIME_DILATION=30
  // Weak-field gravitational time dilation (v4.6.29): localDt = sqrt(1 - 2*Phi*k),
  // Phi = softened potential summed over the local neighbourhood (grid snapshot).
  // Self is excluded and distances are wrapped across the torus, so clocks run
  // slower beside massive bodies and at full speed in empty space.
  let potential = 0;
  if (neighborList && neighborCount > 0 && worldSize > 0) {
    const px = view[base + S.POS_X];
    const py = view[base + S.POS_Y];
    const pz = view[base + S.POS_Z];
    const half = worldSize * 0.5;
    for (let n = 0; n < neighborCount; n++) {
      const jBase = neighborList[n] * PARTICLE_STRIDE;
      if (jBase === base) continue; // no self-potential
      const dx = wrapDelta((view[jBase + S.POS_X] || 0) - px, worldSize, half);
      const dy = wrapDelta((view[jBase + S.POS_Y] || 0) - py, worldSize, half);
      const dz = wrapDelta((view[jBase + S.POS_Z] || 0) - pz, worldSize, half);
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.5;
      potential += (view[jBase + S.MASS] || 0) / r;
    }
  }
  const phi = potential * 0.001 * synergy;
  const localDt = Math.sqrt(Math.max(0, 1 - 2 * phi));
  return Math.max(0.3, Number.isFinite(localDt) ? localDt : 1.0);
}

/** Signed shortest distance across a toroidal world (worldSize > 0). */
function wrapDelta(d, worldSize, half) {
  let w = d % worldSize;
  if (w > half) w -= worldSize;
  else if (w < -half) w += worldSize;
  return w;
}

// ============================================================================
// 24. DIMENSIONALITY
// ============================================================================
export function applyDimensionality(lawState, view, base, prng, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.DIMENSIONALITY)) return 0; // DIMENSIONALITY=31
  // Batch-08 confirmation ("make it stronger"): 0.1 -> 0.3 Z-drift amplitude.
  const force = (prng() - 0.5) * 0.3 * synergy * dt;
  view[base + S.VEL_Z] += force;
  return force;
}

// ============================================================================
// 25. CHAOS
// ============================================================================
export function applyChaos(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.CHAOS)) return; // CHAOS=32
  // Deterministic Lorenz system per particle (v4.6.29): every particle
  // integrates the same nonlinear map (sigma=10, rho=28, beta=8/3), so
  // nearly-identical states diverge exponentially (butterfly effect) and
  // the same seed reproduces the same run. No PRNG draws.
  let x = view[base + S.CHAOS_STATE_X] || 0;
  let y = view[base + S.CHAOS_STATE_Y] || 0;
  let z = view[base + S.CHAOS_STATE_Z] || 0;
  if (x === 0 && y === 0 && z === 0) {
    // Deterministic seed from the particle index — sibling particles start
    // nearly-identical and visibly diverge.
    const seed = base / PARTICLE_STRIDE;
    x = 0.1 + (seed % 7) * 0.013;
    y = 0.1 + (seed % 13) * 0.007;
    z = 20 + (seed % 5) * 0.31;
  }
  const step = 0.02 * (dt || 1);
  const dx = 10 * (y - x);
  const dy = x * (28 - z) - y;
  const dz = x * y - (8 / 3) * z;
  const nx = x + dx * step;
  const ny = y + dy * step;
  const nz = z + dz * step;
  view[base + S.CHAOS_STATE_X] = nanGuard(nx);
  view[base + S.CHAOS_STATE_Y] = nanGuard(ny);
  view[base + S.CHAOS_STATE_Z] = nanGuard(nz);

  // Kick from the map output (centred on the attractor core, x ≈ 14).
  const kick = ((nx - 14) / 28) * 0.5 * synergy * (dt || 1);
  view[base + S.VEL_X] += kick;
  view[base + S.VEL_Y] += kick;
  view[base + S.VEL_Z] += kick * 0.5;
  // Thermal stir from z — deterministic, feeds HEAT / PHASE_RADIATION.
  const tempStir = ((nz - 20) / 40) * 0.02 * synergy * (dt || 1);
  const temp = (view[base + S.TEMPERATURE] || 0) + tempStir;
  view[base + S.TEMPERATURE] = Number.isFinite(temp) ? Math.max(0, Math.min(1, temp)) : view[base + S.TEMPERATURE];
}

// ============================================================================
// 26. ORDER
// ============================================================================
export function applyOrder(lawState, view, iBase, jBase, distSq, synergy) {
  if (!isSet(lawState, LAW_INDEXES.ORDER)) return null; // ORDER=33
  // Batch-09 confirmation ("strongly"): alignment 0.005 -> 0.04, range
  // ~100 -> ~200 units, so coherent flow actually emerges.
  if (distSq > 40000) return null;

  const strength = 0.04 * synergy;
  return {
    ax: view[jBase + S.VEL_X] * strength,
    ay: view[jBase + S.VEL_Y] * strength,
    az: view[jBase + S.VEL_Z] * strength,
  };
}

// ============================================================================
// 27. FATE
// ============================================================================
// Fate (batch-09 redesign — user: "boring and similar to existing laws"):
// the old pairwise same-species attraction duplicated AFFINITY. Now every
// species has a drifting "destiny" point (golden-angle phase per species,
// slowly wandering on a clock) that its members are gently pulled toward —
// species migrate and segregate toward their own fate.
let _fateTime = 0;
export function advanceFateClock(dt) { _fateTime += dt; }
export function getFateTime() { return _fateTime; }

export function applyFate(lawState, view, base, px, py, pz, worldSize, synergy) {
  if (!isSet(lawState, LAW_INDEXES.FATE)) return null; // FATE=34
  const species = view[base + S.SPECIES_ID] || 0;
  const phase = species * 2.39996323; // golden-angle offset, unique per species
  const t = getFateTime() * 0.0004;
  const span = worldSize * 0.32;
  let dx = worldSize * 0.5 + span * Math.sin(t + phase) - px;
  let dy = worldSize * 0.5 + span * Math.cos(t * 0.8 + phase * 1.3) - py;
  let dz = worldSize * 0.5 + span * Math.sin(t * 0.6 + phase * 1.7) - pz;
  // Shortest toroidal path to the destiny point
  if (dx > worldSize * 0.5) dx -= worldSize; else if (dx < -worldSize * 0.5) dx += worldSize;
  if (dy > worldSize * 0.5) dy -= worldSize; else if (dy < -worldSize * 0.5) dy += worldSize;
  if (dz > worldSize * 0.5) dz -= worldSize; else if (dz < -worldSize * 0.5) dz += worldSize;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 1) return { ax: 0, ay: 0, az: 0 };
  const strength = 0.02 * synergy;
  return {
    ax: (dx / dist) * strength,
    ay: (dy / dist) * strength,
    az: (dz / dist) * strength,
  };
}

// ============================================================================
// 28. WILL (Self-propulsion)
// ============================================================================
export function applyWill(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.WILL)) return; // WILL=35

  const vx = view[base + S.VEL_X];
  const vy = view[base + S.VEL_Y];
  const vz = view[base + S.VEL_Z];
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (speed < 0.01) return;

  const boost = 0.01 * dt * synergy;
  const boostX = (vx / speed) * boost;
  const boostY = (vy / speed) * boost;
  const boostZ = (vz / speed) * boost;
  if (Number.isFinite(boostX)) view[base + S.VEL_X] += boostX;
  if (Number.isFinite(boostY)) view[base + S.VEL_Y] += boostY;
  if (Number.isFinite(boostZ)) view[base + S.VEL_Z] += boostZ;
}

// ============================================================================
// 29. SOUL
// ============================================================================
export function applySoul(lawState, view, iBase, jBase, distSq, synergy) {
  if (!isSet(lawState, LAW_INDEXES.SOUL_LAW)) return; // SOUL_LAW=36
  if (distSq > 10000) return;

  const speciesI = view[iBase + S.SPECIES_ID];
  const speciesJ = view[jBase + S.SPECIES_ID];
  if (speciesI !== speciesJ) return;

  const soulJ = view[jBase + S.SOUL];
  const soulI = view[iBase + S.SOUL];
  const transfer = soulJ * 0.001 * synergy;
  if (Number.isFinite(transfer) && transfer > 0) {
    // Batch-10 (agent decision): soul is a conserved shared field — the giver
    // loses what the receiver gains, and both are capped to [0, 1] so
    // TIME_DILATION's 70% max slowdown stays the ceiling.
    view[iBase + S.SOUL] = Math.min(1, soulI + transfer);
    view[jBase + S.SOUL] = Math.max(0, soulJ - transfer);
  }
}

// Soul dissipates slowly when it is not being replenished (batch-10 decision).
export function applySoulDecay(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.SOUL_LAW)) return; // SOUL_LAW=36
  const soul = view[base + S.SOUL];
  if (!Number.isFinite(soul) || soul <= 0) return;
  view[base + S.SOUL] = Math.max(0, soul * (1 - 0.002 * dt * synergy));
}

// ============================================================================
// 30. MIND (Collective hivemind)
// ============================================================================
export function applyMind(lawState, view, iBase, jBase, distSq, synergy) {
  if (!isSet(lawState, LAW_INDEXES.MIND)) return null; // MIND=37
  if (distSq > 40000) return null;

  const speciesI = view[iBase + S.SPECIES_ID];
  const speciesJ = view[jBase + S.SPECIES_ID];
  if (speciesI !== speciesJ) return null;

  const strength = 0.01 * synergy;
  const invDist = 1 / Math.sqrt(distSq);
  return { ax: 0, ay: 0, az: 0, signalBoost: strength * invDist };
}


// ============================================================================
// 31. VOID — Vacuum pressure / cosmological constant
// ============================================================================
export function applyVoid(lawState, view, base, px, py, pz, worldSize, synergy) {
  if (!isSet(lawState, LAW_INDEXES.VOID)) return null;
  const cx = worldSize * 0.5;
  const cy = worldSize * 0.5;
  const cz = worldSize * 0.5;
  const dx = px - cx;
  const dy = py - cy;
  const dz = pz - cz;
  const distSq = dx * dx + dy * dy + dz * dz;
  if (distSq < 1) return null;
  // Batch-10 ("yes"): strengthened and dark-energy scaled — the push grows
  // with distance from the centre, opposing gravitational clustering harder
  // at the edges.
  const dist = Math.sqrt(distSq);
  const norm = dist / (worldSize * 0.5);
  const strength = 0.004 * synergy * (0.3 + norm);
  const invDist = 1 / dist;
  return {
    ax: dx * invDist * strength,
    ay: dy * invDist * strength,
    az: dz * invDist * strength,
  };
}

// ============================================================================
// 31b. BUOYANCY — thermal lift along the vertical axis (replaced WRAP at bit 3)
// ============================================================================
// Archimedes-style: particles hotter than ambient rise, cooler sink. Lift is
// proportional to the temperature delta and coupled through HEAT_OUTPUT DNA.
// TEMPERATURE (stride 66) is heated by RESISTANCE, fusion and stellar output.
export function applyBuoyancy(lawState, view, base) {
  if (!isSet(lawState, LAW_INDEXES.BUOYANCY)) return null;
  const heatOutput = view[base + S.DNA_CACHE_START + DNA_INDEXES.HEAT_OUTPUT] || 0;
  const temp = view[base + S.TEMPERATURE] || 0;
  const ambient = 0.5; // mid-scale ambient temperature
  const delta = temp - ambient;
  if (Math.abs(delta) < 0.01) return null;
  const k = 0.02 * (0.5 + heatOutput);
  return { ax: 0, ay: 0, az: -delta * k }; // negative z = up
}

// ============================================================================
// 32. BOND — Spring-like molecular bonding
// ============================================================================
// Clear a bilateral bond between i and j if one exists.
function breakBondPair(view, iBase, jBase, stride) {
  const jIdx = jBase / stride;
  const iIdx = iBase / stride;
  for (const slot of BOND_SLOTS) {
    if (view[iBase + slot] === jIdx) {
      view[iBase + slot] = -1;
      view[iBase + S.BOND_COUNT] = Math.max(0, view[iBase + S.BOND_COUNT] - 1);
      break;
    }
  }
  for (const slot of BOND_SLOTS) {
    if (view[jBase + slot] === iIdx) {
      view[jBase + slot] = -1;
      view[jBase + S.BOND_COUNT] = Math.max(0, view[jBase + S.BOND_COUNT] - 1);
      break;
    }
  }
}

export function applyBond(lawState, view, iBase, jBase, stride, dx, dy, dz, dist, synergy, nCount) {
  if (!isSet(lawState, LAW_INDEXES.BOND)) return null;
  // Batch-10: molecular bonds prefer dense neighbourhoods — places with more
  // neighbours to bond to — instead of chain ends (that is POLYMER's job).
  const densityBoost = Math.min(2.0, 1 + (nCount || 0) * 0.05);
  if (dist < 0.1) return null;
  const stiffness = view[iBase + S.DNA_CACHE_START + 8]; // STIFFNESS
  if (!Number.isFinite(stiffness) || stiffness < 0.01) return null;
  // Edge-to-edge rest length: particles touch at their radii
  const r1 = view[iBase + S.RADIUS];
  const r2 = view[jBase + S.RADIUS];
  if (!Number.isFinite(r1) || !Number.isFinite(r2)) return null;
  const restLength = (r1 + r2) * 1.1; // slight buffer to avoid overlap
  // Molecular bonds are short-range: they form within ~2x the rest length
  // (extended by local density) and break when stretched beyond that, instead
  // of holding forever.
  const bondRange = restLength * 2 * densityBoost;
  if (dist > bondRange) {
    breakBondPair(view, iBase, jBase, stride);
    return null;
  }
  // Spring force: F = -k * (dist - restLength); denser neighbourhoods bond harder
  const displacement = dist - restLength;
  const forceMag = stiffness * displacement * 0.05 * synergy * densityBoost;
  const invDist = 1.0 / Math.max(dist, 0.01);
  const fx = dx * invDist * forceMag;
  const fy = dy * invDist * forceMag;
  const fz = dz * invDist * forceMag;
  if (!Number.isFinite(fx)) return null;
  // Register bond bilaterally across all 6 shared slots (consistent with POLYMER)
  const jIdx = jBase / stride;
  const iIdx = iBase / stride;
  for (const slot of BOND_SLOTS) {
    if (view[iBase + slot] === jIdx || view[jBase + slot] === iIdx) {
      return { ax: fx, ay: fy, az: fz };
    }
  }
  if (view[iBase + S.BOND_COUNT] < 6 && view[jBase + S.BOND_COUNT] < 6) {
    for (const slot of BOND_SLOTS) {
      if (view[iBase + slot] < 0) {
        view[iBase + slot] = jIdx;
        view[iBase + S.BOND_COUNT] += 1;
        break;
      }
    }
    for (const slot of BOND_SLOTS) {
      if (view[jBase + slot] < 0) {
        view[jBase + slot] = iIdx;
        view[jBase + S.BOND_COUNT] += 1;
        break;
      }
    }
  }
  return { ax: fx, ay: fy, az: fz };
}

// ============================================================================
// 33. REDUCTION — Charge neutralization
// ============================================================================
export function applyReduction(b1Ptr, b2Ptr, stride, synergy) {
  const buf = buffer_global;
  const charge1 = buf[b1Ptr + S.CHARGE];
  const charge2 = buf[b2Ptr + S.CHARGE];
  if (!Number.isFinite(charge1) || !Number.isFinite(charge2)) return;
  // Real-life reduction: opposite charges attract and cancel out when they
  // interact; same-sign charges repel, so nothing gets neutralized.
  if (charge1 * charge2 >= 0) return;
  const rate = 0.05 * synergy;
  const d1 = charge1 * rate;
  const d2 = charge2 * rate;
  buf[b1Ptr + S.CHARGE] = Math.abs(charge1) <= Math.abs(d1) ? 0 : charge1 - d1;
  buf[b2Ptr + S.CHARGE] = Math.abs(charge2) <= Math.abs(d2) ? 0 : charge2 - d2;
}

// ============================================================================
// 34. ALLOY — Cross-species fusion
// ============================================================================
export function applyAlloy(lawState, view, iBase, jBase, stride, dist, synergy) {
  if (!isSet(lawState, LAW_INDEXES.ALLOY)) return;
  const speciesI = view[iBase + S.SPECIES_ID];
  const speciesJ = view[jBase + S.SPECIES_ID];
  if (speciesI === speciesJ) return;
  const r1 = view[iBase + S.RADIUS];
  const r2 = view[jBase + S.RADIUS];
  if (dist > (r1 + r2) * 0.5) return;
  // Real-life alloying: the two materials dissolve into one homogeneous
  // composite — full mass merge, DNA averaged (hybrid composition), colour
  // blended. The survivor keeps its species slot but behaves as the mix.
  const m1 = view[iBase + S.MASS];
  const m2 = view[jBase + S.MASS];
  const total = m1 + m2;
  const w2 = total > 0 ? m2 / total : 0.5;
  view[iBase + S.MASS] = total;
  view[jBase + S.DEAD] = 1.0;
  for (let d = 0; d < 42; d++) {
    const a = view[iBase + S.DNA_CACHE_START + d];
    const b = view[jBase + S.DNA_CACHE_START + d];
    if (Number.isFinite(a) && Number.isFinite(b)) {
      view[iBase + S.DNA_CACHE_START + d] = a + (b - a) * w2;
    }
  }
  view[iBase + S.COLOR_R] = (view[iBase + S.COLOR_R] + view[jBase + S.COLOR_R]) * 0.5;
  view[iBase + S.COLOR_G] = (view[iBase + S.COLOR_G] + view[jBase + S.COLOR_G]) * 0.5;
  view[iBase + S.COLOR_B] = (view[iBase + S.COLOR_B] + view[jBase + S.COLOR_B]) * 0.5;
}

// ============================================================================
// 35. MELT — High temp particles lose mass
// ============================================================================
export function applyMelt(lawState, view, base, dt, synergy, dnaBuffer) {
  if (!isSet(lawState, LAW_INDEXES.MELT)) return;
  const temp = view[base + S.TEMPERATURE];
  if (!Number.isFinite(temp)) return;
  const stiffness = view[base + S.DNA_CACHE_START + D.STIFFNESS];
  if (!Number.isFinite(stiffness)) return;
  const speciesId = view[base + S.SPECIES_ID];
  const range = DNA_RANGES[D.STIFFNESS] || { min: 0.1, max: 5, default: 1 };
  const baseline = dnaBuffer && dnaBuffer.length
    ? getDNAFloat(dnaBuffer, speciesId, D.STIFFNESS, range.min, range.max)
    : (stiffness > 0 ? stiffness : range.default);
  if (temp >= 0.7) {
    // Melt (per HELP_DB): heat softens the particle — effective stiffness
    // decays toward a 20% floor while hot. Real melting loses rigidity, not
    // mass, and it is reversible below the melt point.
    const floor = baseline * 0.2;
    const rate = (temp - 0.7) * 0.02 * dt * synergy;
    view[base + S.DNA_CACHE_START + D.STIFFNESS] = Math.max(floor, stiffness - rate);
  } else if (stiffness < baseline - 1e-6) {
    // Re-solidify: stiffness recovers toward the species baseline.
    view[base + S.DNA_CACHE_START + D.STIFFNESS] = Math.min(baseline, stiffness + 0.005 * dt * synergy);
  }
}

// ============================================================================
// 36. BOIL — Very hot particles eject mass as energetic vapor
// ============================================================================
export function applyBoil(lawState, view, base, dt, synergy, prng) {
  if (!isSet(lawState, LAW_INDEXES.BOIL)) return;
  const temp = view[base + S.TEMPERATURE];
  if (!Number.isFinite(temp) || temp < 0.9) return;
  const mass = view[base + S.MASS];
  const boilRate = (temp - 0.9) * 0.02 * dt * synergy;
  const ejectMass = mass * boilRate;
  if (ejectMass > 0.01) {
    // Boil: vaporizing mass is energetic — the ejected fraction becomes
    // kinetic energy and costs latent heat (ENERGY), with a mass floor so
    // particles never boil away completely.
    view[base + S.MASS] = Math.max(0.02, mass - ejectMass);
    const rnd = prng || Math.random;
    view[base + S.VEL_X] += (rnd() - 0.5) * ejectMass * 10;
    view[base + S.VEL_Y] += (rnd() - 0.5) * ejectMass * 10;
    view[base + S.VEL_Z] += (rnd() - 0.5) * ejectMass * 5;
    view[base + S.ENERGY] = Math.max(0, (view[base + S.ENERGY] || 0) - ejectMass * 20);
    view[base + S.TEMPERATURE] -= boilRate * 0.3;
  }
}

// ============================================================================
// 37. CONDENSE — Cool particles gain mass
// ============================================================================
export function applyCondense(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.CONDENSE)) return;
  const temp = view[base + S.TEMPERATURE];
  if (!Number.isFinite(temp) || temp > 0.3) return;
  const mass = view[base + S.MASS];
  const condenseRate = (0.3 - temp) * 0.005 * dt * synergy;
  view[base + S.MASS] = mass + condenseRate;
  // Real-life condensation releases latent heat — the particle warms as it
  // gains vapor mass (clamped so it can't cross into boiling).
  view[base + S.TEMPERATURE] = Math.min(0.9, temp + condenseRate * 2);
}

// ============================================================================
// 38. DEPOSIT — Gas directly solidifies on cold particles
// ============================================================================
export function applyDeposit(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.DEPOSIT)) return;
  const temp = view[base + S.TEMPERATURE];
  if (!Number.isFinite(temp) || temp > 0.2) return;
  const mass = view[base + S.MASS];
  const depositRate = (0.2 - temp) * 0.01 * dt * synergy;
  view[base + S.MASS] = mass + depositRate * 3;
  view[base + S.RADIUS] = view[base + S.RADIUS] + depositRate * 0.5;
  // Real-life deposition (frost) is exothermic — it skips the liquid phase,
  // builds solid mass fast, and releases latent heat as it forms.
  view[base + S.TEMPERATURE] = Math.min(0.9, temp + depositRate * 2);
}

// ============================================================================
// 39. EXOTHERMIC — Energy amplification for all reactions
// ============================================================================
export function applyExothermic(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.EXOTHERMIC)) return;
  const energy = view[base + S.ENERGY];
  const temp = view[base + S.TEMPERATURE];
  if (!Number.isFinite(energy) || !Number.isFinite(temp)) return;
  // Real-life exothermic reactions release heat while the reaction runs —
  // a bounded steady release (the old ENERGY ×= 1.1 was an unbounded
  // exponential). Capped at the ENERGY ceiling and below boiling.
  view[base + S.ENERGY] = Math.min(200, energy + 0.05 * synergy * dt);
  view[base + S.TEMPERATURE] = Math.min(0.9, temp + 0.01 * synergy * dt);
}

// ============================================================================
// 40. TELEPATHY — Instant signal sharing within species
// ============================================================================
export function applyTelepathy(lawState, view, iBase, jBase, distSq, synergy, dt) {
  if (!isSet(lawState, LAW_INDEXES.TELEPATHY)) return null;
  const speciesI = view[iBase + S.SPECIES_ID];
  const speciesJ = view[jBase + S.SPECIES_ID];
  if (speciesI !== speciesJ) return null;
  const signalJ = view[jBase + S.SIGNAL];
  if (!Number.isFinite(signalJ)) return null;
  const transfer = signalJ * 0.05 * synergy;
  if (transfer > 0.001) {
    view[iBase + S.SIGNAL] += transfer;
    // The receiver pays a slight energy cost for the shared channel.
    const energy = view[iBase + S.ENERGY];
    if (Number.isFinite(energy)) {
      view[iBase + S.ENERGY] = Math.max(0, energy - 0.02 * synergy * (dt || 1));
    }
  }
  return null;
}

// ============================================================================
// 41. CLAIRVOYANCE — Predictive steering toward future positions
// ============================================================================
export function applyClairvoyance(lawState, view, iBase, jBase, dx, dy, dz, dist, synergy, dt) {
  if (!isSet(lawState, LAW_INDEXES.CLAIRVOYANCE)) return null;
  if (dist < 1) return null;
  // Predict where neighbor will be based on its velocity
  const vx_j = view[jBase + S.VEL_X];
  const vy_j = view[jBase + S.VEL_Y];
  const vz_j = view[jBase + S.VEL_Z];
  const predDx = (dx + vx_j * 3) - dx;
  const predDy = (dy + vy_j * 3) - dy;
  const predDz = (dz + vz_j * 3) - dz;
  const strength = 0.02 * synergy;
  const invDist = 1.0 / dist;
  // Sensing the future costs a little energy (confirmed batch-13).
  const energy = view[iBase + S.ENERGY];
  if (Number.isFinite(energy)) {
    view[iBase + S.ENERGY] = Math.max(0, energy - 0.02 * synergy * (dt || 1));
  }
  return {
    ax: predDx * invDist * strength,
    ay: predDy * invDist * strength,
    az: predDz * invDist * strength,
  };
}

// ============================================================================
// 42. PRECOGNITION — Collision anticipation and avoidance
// ============================================================================
export function applyPrecognition(lawState, view, iBase, jBase, dx, dy, dz, dist, synergy, dt) {
  if (!isSet(lawState, LAW_INDEXES.PRECOGNITION)) return null;
  if (dist < 1 || dist > 50) return null;
  // Check if on collision course
  const vx_i = view[iBase + S.VEL_X];
  const vy_i = view[iBase + S.VEL_Y];
  const vz_i = view[iBase + S.VEL_Z];
  const relVx = view[jBase + S.VEL_X] - vx_i;
  const relVy = view[jBase + S.VEL_Y] - vy_i;
  const relVz = view[jBase + S.VEL_Z] - vz_i;
  const dot = dx * relVx + dy * relVy + dz * relVz;
  if (dot > 0) return null; // Moving apart
  const strength = 0.05 * synergy;
  const invDist = 1.0 / dist;
  // Anticipating the collision costs a little energy (confirmed batch-13).
  const energy = view[iBase + S.ENERGY];
  if (Number.isFinite(energy)) {
    view[iBase + S.ENERGY] = Math.max(0, energy - 0.02 * synergy * (dt || 1));
  }
  // Avoid by steering perpendicular to approach
  return {
    ax: -(dy * invDist) * strength,
    ay: (dx * invDist) * strength,
    az: 0,
  };
}

// ============================================================================
// 43. ASTRAL — Soul persists as ghost after death
// ============================================================================
export function applyAstral(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.ASTRAL)) return;
  if (view[base + S.DEAD] < 0.5) return; // Only affects dead/soul particles
  const soul = view[base + S.SOUL];
  if (!Number.isFinite(soul) || soul < 0.01) return;
  // Ghost persists, gradually fading
  view[base + S.ALPHA] = soul * 0.5;
  view[base + S.MASS] = soul * 0.1;
  // Ghost forces nearby living particles
  view[base + S.SOUL] *= 0.999;
  if (view[base + S.SOUL] < 0.001) {
    view[base + S.DEAD] = 1.0; // Fully dead, remove
  }
}

/**
 * ASTRAL ghost influence on one living neighbour (called from the solver's
 * soul pass over the spatial grid): the ghost exerts a soft soul-pull on the
 * living, and same-species kin receive a sliver of its soul before it fades
 * away (soul is conserved, matching SOUL_LAW's transfer semantics).
 */
export function applyAstralInfluence(lawState, view, ghostBase, livingBase, dx, dy, dz, dist, synergy, dt) {
  if (!isSet(lawState, LAW_INDEXES.ASTRAL)) return;
  const soul = view[ghostBase + S.SOUL];
  if (!Number.isFinite(soul) || soul < 0.01) return;
  const invDist = 1.0 / Math.max(dist, 0.01);
  const step = (dt || 1);
  // Soft soul-pull: the living drift gently toward the ghost (dx points
  // ghost → living, so negate it).
  const pull = soul * 0.02 * synergy * step;
  view[livingBase + S.VEL_X] -= dx * invDist * pull;
  view[livingBase + S.VEL_Y] -= dy * invDist * pull;
  view[livingBase + S.VEL_Z] -= dz * invDist * pull;
  // Same-species blessing: a conserved sliver of soul passes to living kin.
  if (view[ghostBase + S.SPECIES_ID] === view[livingBase + S.SPECIES_ID]) {
    const gift = soul * 0.002 * synergy * step;
    view[ghostBase + S.SOUL] = Math.max(0, soul - gift);
    view[livingBase + S.SOUL] = Math.min(1, (view[livingBase + S.SOUL] || 0) + gift);
  }
}


// ============================================================================
// 44. GLOW — Signal emission produces visual brightness
// ============================================================================
export function applyGlowEffect(lawState, view, base, dnaParams, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.GLOW)) return;

  // GLOW emits signal pulses only (confirmed batch-04 correction): an
  // oscillator raises the particle's SIGNAL — its transmission strength —
  // when the phase is positive. With COMMS active the pulse propagates to
  // neighbours. GLOW does NOT convert signal into life energy: signal
  // (SIGNAL) and metabolism (ENERGY) are separate channels.
  const pulseRate = dnaParams[14] || 0.2;   // PULSE_RATE
  const strength = dnaParams[19] || 0.5;    // SIGNAL_STRENGTH
  const age = view[base + S.AGE] || 0;
  const signal = view[base + S.SIGNAL] || 0;

  const phase = Math.sin(age * 0.01 * (0.1 + pulseRate));
  if (phase > 0) {
    view[base + S.SIGNAL] = Math.max(0, signal + phase * pulseRate * strength * dt * 0.05 * synergy);
  }
}

// ============================================================================
// 45. ENERGY — Energy conduction between adjacent particles
// ============================================================================
// The ENERGY law balances every energy reservoir pairwise toward equilibrium:
// LIFE energy (ENERGY), ELECTRIC_ENERGY and STORED_ENERGY each conduct
// independently between neighbouring particles. SIGNAL (transmission
// strength) and REPRO_DRIVE (drive meter) are not energy reservoirs and are
// intentionally left untouched. Confirmed batch-04 interpretation of "what
// energy": all of them.
const ENERGY_CHANNELS = [S.ENERGY, S.ELECTRIC_ENERGY, S.STORED_ENERGY];

export function applyEnergyTransfer(lawState, view, iBase, jBase, distSq, synergy) {
  if (!isSet(lawState, LAW_INDEXES.ENERGY)) return null;
  if (distSq > 40000) return null;
  const rate = 0.005 * synergy * (worldParams().ENERGY_TRANSFER ?? 1);
  for (const ch of ENERGY_CHANNELS) {
    const energyI = view[iBase + ch];
    const energyJ = view[jBase + ch];
    if (!Number.isFinite(energyI) || !Number.isFinite(energyJ)) continue;
    const diff = energyJ - energyI;
    if (Math.abs(diff) < 0.1) continue;
    const transfer = diff * rate;
    view[iBase + ch] += transfer;
    view[jBase + ch] -= transfer;
  }
  return null;
}

// ============================================================================
// 46. RADIATION — Ambient radiation damages low-armor particles
// ============================================================================
export function applyRadiationDamage(lawState, view, base, dt, synergy, prng) {
  if (!isSet(lawState, LAW_INDEXES.RADIATION)) return;

  const armor = view[base + S.ARMOR];
  const energy = view[base + S.ENERGY];
  if (!Number.isFinite(armor) || !Number.isFinite(energy)) return;

  // The RADIATION_LEVEL slider scales the damage (confirmed batch-04 spec).
  const level = Number.isFinite(worldParams().RADIATION_LEVEL) ? worldParams().RADIATION_LEVEL : 1;

  // Exposure builds very slowly but keeps increasing over time (cap 100).
  // The accumulated dose both worsens the damage and ramps mutation chance.
  let exposure = view[base + S.RADIATION_EXPOSURE] || 0;
  exposure += level * dt * 0.01;
  if (exposure > 100) exposure = 100;
  view[base + S.RADIATION_EXPOSURE] = exposure;

  // Energy damage: ARMOR shields; exposure slowly compounds the dose.
  const damage = (1 - armor) * 0.02 * level * (1 + exposure * 0.02) * dt * synergy;
  if (damage > 0.001) {
    const newEnergy = energy - damage;
    if (newEnergy <= 0) {
      // Radiation depletion kills — consistent with the batch-02 LIFE death.
      view[base + S.ENERGY] = 0;
      view[base + S.DEAD] = 1.0;
    } else {
      view[base + S.ENERGY] = newEnergy;
    }
  }

  // Mutation ramp: the accumulated dose slowly increases the chance of DNA
  // damage — more and more over time as exposure climbs.
  const mutationRate = view[base + S.DNA_CACHE_START + 12] || 0.5;
  const mutProb = exposure * 0.001 * dt * synergy;
  if (prng && mutProb > 0 && prng() < mutProb) {
    const hashVal = Math.sin(base * 173.3 + performance.now() * 0.001) * 43758.5453;
    const dnaIdx = Math.abs(Math.floor(hashVal)) % 42;
    const perturb = (prng() - 0.5) * mutationRate * 0.05;
    const val = view[base + S.DNA_CACHE_START + dnaIdx];
    if (Number.isFinite(val)) view[base + S.DNA_CACHE_START + dnaIdx] = val + perturb;
  }
}

// ============================================================================
// 47. TRACK — Predation tracking
// ============================================================================
export function applyTrackingBehavior(lawState, view, iBase, jBase, dx, dy, dz, dist, synergy) {
  if (!isSet(lawState, LAW_INDEXES.TRACK)) return null;
  if (dist < 1) return null;
  const massI = view[iBase + S.MASS];
  const massJ = view[jBase + S.MASS];
  if (!Number.isFinite(massI) || !Number.isFinite(massJ)) return null;
  const predationBias = view[iBase + S.DNA_CACHE_START + 36];
  if (!Number.isFinite(predationBias) || predationBias < 0.1) return null;
  // Predation is cross-species: a predator never hunts its own kind.
  if (view[iBase + S.SPECIES_ID] === view[jBase + S.SPECIES_ID]) return null;
  if (massJ < massI * 0.8) {
    const strength = predationBias * 0.05 * synergy;
    const invDist = 1.0 / dist;
    return {
      ax: dx * invDist * strength,
      ay: dy * invDist * strength,
      az: dz * invDist * strength,
    };
  }
  return null;
}

// ============================================================================
// 48. GENOTYPE — DNA mutation from environmental stress
// ============================================================================
export function applyGenotypeMutation(lawState, view, base, dt, synergy, prng, dnaBuffer) {
  if (!isSet(lawState, LAW_INDEXES.GENOTYPE)) return;
  const mutationRate = view[base + S.DNA_CACHE_START + 12];
  const temperature = view[base + S.TEMPERATURE];
  if (!Number.isFinite(mutationRate) || !Number.isFinite(temperature)) return;
  if (mutationRate < 0.01) return;

  const speciesId = view[base + S.SPECIES_ID] || 0;
  // Genetics params (42-47) come from the species genome (DNA buffer).
  const crossoverRate = readSpeciesDNAParam(dnaBuffer, speciesId, 43);
  const epigeneticDrift = readSpeciesDNAParam(dnaBuffer, speciesId, 44);
  const heterozygosity = readSpeciesDNAParam(dnaBuffer, speciesId, 45);
  const geneFlow = readSpeciesDNAParam(dnaBuffer, speciesId, 46);
  const repressor = readSpeciesDNAParam(dnaBuffer, speciesId, 47);
  // Genetics & regulatory params (48-63, genome-only).
  const alleleCount = readSpeciesDNAParam(dnaBuffer, speciesId, 48);
  const epigeneticRate = readSpeciesDNAParam(dnaBuffer, speciesId, 49);
  const hgtRate = readSpeciesDNAParam(dnaBuffer, speciesId, 50);
  const repairEfficiency = readSpeciesDNAParam(dnaBuffer, speciesId, 51);
  const driftRate = readSpeciesDNAParam(dnaBuffer, speciesId, 52);
  const selectionSensitivity = readSpeciesDNAParam(dnaBuffer, speciesId, 53);
  const speciationThreshold = readSpeciesDNAParam(dnaBuffer, speciesId, 54);
  const adaptationRate = readSpeciesDNAParam(dnaBuffer, speciesId, 55);
  const transposonRate = readSpeciesDNAParam(dnaBuffer, speciesId, 56);
  const geneSilencing = readSpeciesDNAParam(dnaBuffer, speciesId, 57);
  const mutagenSensitivity = readSpeciesDNAParam(dnaBuffer, speciesId, 59);
  const ploidyLevel = readSpeciesDNAParam(dnaBuffer, speciesId, 61);
  const codonBias = readSpeciesDNAParam(dnaBuffer, speciesId, 62);
  const regulatoryDepth = readSpeciesDNAParam(dnaBuffer, speciesId, 63);

  // Accumulated radiation dose (RADIATION law) ramps the mutation rate —
  // radiation increases mutation chance more and more over time.
  const exposure = view[base + S.RADIATION_EXPOSURE] || 0;

  let mutProb = mutationRate * (1.0 + temperature) * dt * 0.01 * synergy
    * (1 - repressor * 0.5)            // REPRESSOR dampens genetic drift
    * (1 - repairEfficiency * 0.6)     // REPAIR_EFFICIENCY mends damage
    * (1 / (1 + regulatoryDepth * 0.03)) // REGULATORY_DEPTH stabilizes expression
    * (1 + driftRate * 0.5)            // DRIFT_RATE adds neutral drift
    // MUTAGEN_SENSITIVITY scales how hard radiation dose ramps mutation
    * (1 + exposure * 0.05 * (0.5 + mutagenSensitivity * 1.5));
  if (mutProb < 0.001) return;

  const numMutations = Math.floor(mutProb * 3) + 1;
  const dnaStart = S.DNA_CACHE_START;

  for (let m = 0; m < numMutations; m++) {
    // Somatic drift — per-particle DNA cache (heritable through REPRO).
    const hashVal = Math.sin(base * 127.1 + m * 311.7 + performance.now() * 0.001) * 43758.5453;
    const dnaIdx = Math.abs(Math.floor(hashVal)) % 42;
    const perturbHash = Math.sin(base * 269.5 + dnaIdx * 183.3) * 43758.5453;
    // HETEROZYGOSITY + ALLELE_COUNT + PLOIDY_LEVEL widen variance;
    // GENE_SILENCING damps expression; CODON_BIAS biases the direction.
    const varScale = (1 + heterozygosity * 2
      + (alleleCount - 2) * 0.25
      + (ploidyLevel - 2) * 0.15)
      * (1 - geneSilencing * 0.4);
    const perturb = ((perturbHash - Math.floor(perturbHash)) * 2.0 - 1.0)
      * mutationRate * 0.05 * varScale * (0.5 + codonBias);
    const newVal = view[base + dnaStart + dnaIdx] + perturb;
    if (Number.isFinite(newVal)) {
      view[base + dnaStart + dnaIdx] = newVal;
    }

    // Epigenetic drift — extra non-heritable noise on the cache.
    if ((epigeneticDrift + epigeneticRate) > 0 && prng && prng() < 0.5) {
      const epiIdx = Math.abs(Math.floor(Math.sin(base * 91.7 + m * 173.1) * 43758.5453)) % 42;
      const epiNoise = (prng() - 0.5) * (epigeneticDrift + epigeneticRate * 2) * 2;
      view[base + dnaStart + epiIdx] += epiNoise;
    }

    // Gene flow — horizontal transfer of a foreign gene into the cache.
    if (dnaBuffer && prng && prng() < geneFlow * 0.01 + hgtRate * 0.02) {
      const otherSpecies = (Math.floor(prng() * 63) >= speciesId) ? (Math.floor(prng() * 63) + 1) : Math.floor(prng() * 63);
      const r = DNA_RANGES[dnaIdx] || { min: -1, max: 1 };
      const foreign = readSpeciesDNAParam(dnaBuffer, otherSpecies, dnaIdx);
      view[base + dnaStart + dnaIdx] += (foreign - view[base + dnaStart + dnaIdx]) * 0.1;
    }

    // Transposon jump — TRANSPOSON_RATE: a mobile element leaps to a random
    // locus with a larger, directionally-biased perturbation.
    if (prng && prng() < transposonRate * 0.05) {
      const jumpIdx = Math.abs(Math.floor(Math.sin(base * 137.9 + m * 219.7) * 43758.5453)) % 42;
      view[base + dnaStart + jumpIdx] += (prng() - 0.5) * mutationRate * 0.2 * (0.5 + codonBias);
    }
  }

  // Species-genome evolution — a rare heritable mutation written back to the
  // species DNA buffer, so evolution accumulates at the species level for
  // future spawns and offspring genetics. DNA and genetics are a major part
  // of VEPA, so this is slow but persistent.
  // SELECTION_SENSITIVITY strengthens heritable change; SPECIATION_THRESHOLD
  // (low = easy divergence) gates the write-back; ADAPTATION_RATE scales the leap.
  if (dnaBuffer && prng && prng() < crossoverRate * 0.0002 * dt
      * (0.2 + selectionSensitivity * 0.8)
      * (1 - speciationThreshold * 0.4)) {
    const gIdx = Math.abs(Math.floor(Math.sin(base * 53.7 + performance.now() * 0.0007) * 43758.5453)) % 42;
    const current = readSpeciesDNAParam(dnaBuffer, speciesId, gIdx);
    const gPerturb = (prng() - 0.5) * mutationRate * 0.02 * (0.5 + adaptationRate * 1.5);
    writeSpeciesDNAParam(dnaBuffer, speciesId, gIdx, current + gPerturb);
  }
}

// ============================================================================
// 49. PHENOTYPE — Express DNA as visual trait modulation
// ============================================================================
export function applyPhenotype(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.PHENOTYPE)) return;
  const energy = view[base + S.ENERGY];
  const radius = view[base + S.RADIUS];
  if (!Number.isFinite(energy) || !Number.isFinite(radius)) return;
  // Energy-driven size (batch-05 confirmation): ENERGY is the environment —
  // a well-fed particle (energy > 100) expresses a larger body, a starving
  // one shrinks, exactly like real organisms where nutrition affects size.
  const energyFactor = 1 + (energy / 200 - 0.5) * 0.5 * synergy;
  view[base + S.RADIUS] = radius * energyFactor;

  // Gene expression: the inherited genome (DNA cache) is translated into the
  // visible phenotype — POLARITY → hue, ALPHA → saturation, SYMMETRY →
  // lightness — so offspring inherit their species' look along with its DNA.
  const polarity = view[base + S.DNA_CACHE_START + 4];
  const alpha = view[base + S.DNA_CACHE_START + 5];
  const symmetry = view[base + S.DNA_CACHE_START + 6];
  if (Number.isFinite(polarity) && Number.isFinite(alpha) && Number.isFinite(symmetry)) {
    const hue = (polarity + 1) * 120; // POLARITY -1..1 → 0(red)..240(blue)
    const sat = Math.max(0, Math.min(1, alpha)); // ALPHA 0..1
    const light = Math.max(0.1, Math.min(0.9, 0.5 + symmetry * 0.4)); // SYMMETRY -1..1
    const [r, g, b] = hslToRgb(hue, sat, light);
    view[base + S.COLOR_R] = r * 255;
    view[base + S.COLOR_G] = g * 255;
    view[base + S.COLOR_B] = b * 255;
  }
}

// ============================================================================
// 50. SOLVATION — Increase reaction rate in solvent
// ============================================================================
export function applySolvationEffect(lawState, view, iBase, jBase, distSq, synergy) {
  if (!isSet(lawState, LAW_INDEXES.SOLVATION)) return 1.0;
  const chargeI = view[iBase + S.CHARGE];
  const chargeJ = view[jBase + S.CHARGE];
  if (!Number.isFinite(chargeI) || !Number.isFinite(chargeJ)) return 1.0;
  const polarity = Math.abs(chargeI - chargeJ);
  if (polarity > 0.5) {
    return 1.0 + polarity * 0.2 * synergy;
  }
  return 1.0;
}

// ============================================================================
// 51. ACIDITY — Acidic charge damages unprotected particles
// ============================================================================
export function applyAcidityEffect(lawState, view, iBase, jBase, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.ACIDITY)) return;
  const chargeI = view[iBase + S.CHARGE];
  const chargeJ = view[jBase + S.CHARGE];
  if (!Number.isFinite(chargeI) || !Number.isFinite(chargeJ)) return;
  const diff = chargeJ - chargeI;
  if (Math.abs(diff) < 0.3) return;
  // Documented behavior (batch-05 confirmation): acid/base exchange equalizes
  // electrical potential. CONDUCTIVITY DNA controls the transfer rate and the
  // CHARGE field is altered — charge flows from the higher-charge particle to
  // the lower until the gap closes. ENERGY is untouched.
  const condI = view[iBase + S.DNA_CACHE_START + 32] || 0;
  const condJ = view[jBase + S.DNA_CACHE_START + 32] || 0;
  const conductivity = Math.max(condI, condJ);
  if (conductivity <= 0) return;
  const transfer = diff * conductivity * 0.1 * dt * synergy;
  view[iBase + S.CHARGE] += transfer;
  view[jBase + S.CHARGE] -= transfer;
}

// ============================================================================
// 52. OXIDATION — Charge imbalance causes structural degradation
// ============================================================================
export function applyOxidationEffect(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.OXIDATION)) return;
  const charge = Math.abs(view[base + S.CHARGE]);
  if (!Number.isFinite(charge) || charge < 0.3) return;
  const mass = view[base + S.MASS];
  if (Number.isFinite(mass) && mass > 0.1) {
    view[base + S.MASS] -= charge * 0.001 * dt * synergy;
  }
  // Batch-06 confirmation: real oxidation is electron loss — the charge
  // magnitude drifts toward 0 at the same rate (the particle rusts
  // electrically) instead of only eating mass.
  const c = view[base + S.CHARGE];
  if (Number.isFinite(c) && c !== 0) {
    const decay = c * 0.001 * dt * synergy;
    view[base + S.CHARGE] = Math.abs(c) <= Math.abs(decay) ? 0 : c - decay;
  }

  // HEAT_OUTPUT DNA (39): charged oxidation releases energy + temperature and
  // the particle flashes brighter (glow) as it burns.
  const heatOutput = view[base + S.DNA_CACHE_START + D.HEAT_OUTPUT] || 0;
  if (heatOutput > 0.001) {
    const release = charge * heatOutput * 0.05 * dt * synergy;
    view[base + S.ENERGY] = Math.min(200, (view[base + S.ENERGY] || 0) + release);
    view[base + S.TEMPERATURE] = (view[base + S.TEMPERATURE] || 0) + release * 0.01;
    if (release > 0.0001) {
      const flash = release * 40;
      view[base + S.COLOR_R] = Math.min(255, (view[base + S.COLOR_R] || 0) + flash);
      view[base + S.COLOR_G] = Math.min(255, (view[base + S.COLOR_G] || 0) + flash);
      view[base + S.COLOR_B] = Math.min(255, (view[base + S.COLOR_B] || 0) + flash);
      view[base + S.ALPHA] = Math.min(1, (view[base + S.ALPHA] || 0) + release * 0.1);
    }
  }
}

// ============================================================================
// 53. ISOMERIZATION — Structural rearrangement changes properties
// ============================================================================
export function applyIsomerization(lawState, view, base, dt, synergy, prng, stride) {
  if (!isSet(lawState, LAW_INDEXES.ISOMERIZATION)) return;
  // Batch-06 confirmation ("match real life"): real isomerization keeps the
  // same atoms but rearranges the bonds. A particle with 3+ chain bonds
  // occasionally breaks one connection — the freed partner becomes a fragment
  // (its reciprocal bond is cleared too) — and the rearrangement consumes a
  // little energy. The old "radius breathing" placeholder is gone.
  const bondCount = view[base + S.BOND_COUNT];
  if (!Number.isFinite(bondCount) || bondCount < 3) return;
  const energy = view[base + S.ENERGY];
  if (!Number.isFinite(energy) || energy < 1) return;
  const chance = 0.02 * dt * synergy;
  if (prng && prng() >= chance) return;

  const iIdx = Math.round(base / stride);
  for (const slot of BOND_SLOTS) {
    const partnerIdx = view[base + slot];
    if (partnerIdx >= 0) {
      const partnerBase = Math.round(partnerIdx) * stride;
      if (Number.isFinite(partnerBase) && partnerBase >= 0 && partnerBase < view.length) {
        for (const pSlot of BOND_SLOTS) {
          if (view[partnerBase + pSlot] === iIdx) {
            view[partnerBase + pSlot] = -1;
            view[partnerBase + S.BOND_COUNT] = Math.max(0, (view[partnerBase + S.BOND_COUNT] || 0) - 1);
            break;
          }
        }
      }
      view[base + slot] = -1;
      view[base + S.BOND_COUNT] = Math.max(0, bondCount - 1);
      break;
    }
  }
  // Isomerization consumes energy (documented).
  view[base + S.ENERGY] = Math.max(0, energy - 0.5 * dt * synergy);
}

// ============================================================================
// 54. CHIRALITY — Handedness affects interaction bias
// ============================================================================
export function applyChirality(lawState, view, iBase, jBase, dx, dy, dz, dist, synergy) {
  if (!isSet(lawState, LAW_INDEXES.CHIRALITY)) return null;
  if (dist < 1) return null;
  // Batch-06 confirmation (documented): handedness comes from TORQUE DNA
  // (rotational momentum), not POLARITY — real chirality is geometric
  // mirror-handedness (clockwise vs counter-clockwise spin), not charge.
  const torqueI = view[iBase + S.DNA_CACHE_START + D.TORQUE];
  const torqueJ = view[jBase + S.DNA_CACHE_START + D.TORQUE];
  if (!Number.isFinite(torqueI) || !Number.isFinite(torqueJ)) return null;
  if (torqueI === 0 || torqueJ === 0) return null;
  // Same-handedness pairs deflect perpendicular to their separation; the
  // deflection direction follows the handedness sign (left vs right mirror
  // image rotate opposite ways). Opposite-handedness pairs: no force.
  if ((torqueI > 0 && torqueJ > 0) || (torqueI < 0 && torqueJ < 0)) {
    const strength = 0.01 * synergy;
    const invDist = 1.0 / dist;
    const dir = torqueI > 0 ? 1 : -1;
    return {
      ax: -dy * invDist * strength * dir,
      ay: dx * invDist * strength * dir,
      az: 0,
    };
  }
  return null;
}

// ============================================================================
// 55. CRYSTALLIZATION — Particles align into ordered lattice
// ============================================================================
export function applyCrystallization(lawState, view, iBase, jBase, dx, dy, dz, dist, synergy) {
  if (!isSet(lawState, LAW_INDEXES.CRYSTALLIZATION)) return null;
  // Batch-07 repair: range widened 30 -> 150 so lattices actually form at
  // default spawn spacing (~100-300 units), pull strengthened 0.01 -> 0.05.
  if (dist < 1 || dist > 150) return null;
  const gridSize = 8.0;
  const targetX = Math.round(dx / gridSize) * gridSize;
  const targetY = Math.round(dy / gridSize) * gridSize;
  const targetZ = Math.round(dz / gridSize) * gridSize;
  // Same-species pairs crystallize 3x stronger (batch-07 confirmation)
  const sameSpecies = view[iBase + S.SPECIES_ID] === view[jBase + S.SPECIES_ID];
  const pullScale = sameSpecies ? 3.0 : 1.0;
  const pullX = (targetX - dx) * 0.05 * synergy * pullScale;
  const pullY = (targetY - dy) * 0.05 * synergy * pullScale;
  const pullZ = (targetZ - dz) * 0.05 * synergy * pullScale;
  return {
    ax: pullX,
    ay: pullY,
    az: pullZ,
  };
}

// ============================================================================
// 56. PHASE_RADIATION — Hot particles radiate energy as light
// ============================================================================
export function applyPhaseRadiation(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.PHASE_RADIATION)) return;
  const temp = view[base + S.TEMPERATURE];
  const energy = view[base + S.ENERGY];
  if (!Number.isFinite(temp) || !Number.isFinite(energy)) return;
  // Batch-08 confirmation ("follow irl behaviour"): Stefan-Boltzmann blackbody
  // emission — every warm body radiates, hot bodies radiate disproportionately
  // (T^4 curve), cooling both TEMPERATURE and ENERGY and glowing via SIGNAL.
  if (temp > 0.05) {
    const radiated = temp * temp * temp * temp * 0.05 * dt * synergy;
    if (radiated > 0) {
      // Energy floor 0: radiation cools and dims a body, it can never drive
      // ENERGY negative (the unclamped drain let hot bodies crater ENERGY
      // below zero every tick once multiple heat sources compounded).
      view[base + S.ENERGY] = Math.max(0, energy - radiated);
      view[base + S.TEMPERATURE] = Math.max(0, view[base + S.TEMPERATURE] - radiated);
      view[base + S.SIGNAL] = Math.min(1, view[base + S.SIGNAL] + radiated);
    }
  }
}

// ============================================================================
// 57. SUBLIMATION — Solid particles skip liquid phase
// ============================================================================
export function applySublimation(lawState, view, base, dt, synergy, prng) {
  if (!isSet(lawState, LAW_INDEXES.SUBLIMATION)) return;
  const temp = view[base + S.TEMPERATURE];
  const mass = view[base + S.MASS];
  const energy = view[base + S.ENERGY];
  if (!Number.isFinite(temp) || !Number.isFinite(mass) || !Number.isFinite(energy)) return;
  // Batch-08 confirmation ("sure"): documented low-mass + high-energy gate;
  // mass can sublimate almost fully away (floor 0.02); burst uses the sim PRNG.
  if (temp > 0.5 && energy > 50 && mass > 0.02) {
    const sublRate = (temp - 0.5) * 0.005 * dt * synergy;
    view[base + S.MASS] = Math.max(0.02, view[base + S.MASS] - sublRate);
    view[base + S.VEL_X] += (prng() - 0.5) * sublRate * 5;
    view[base + S.VEL_Y] += (prng() - 0.5) * sublRate * 5;
    view[base + S.ENERGY] = Math.max(0, view[base + S.ENERGY] - sublRate * 20);
    view[base + S.TEMPERATURE] = Math.max(0, view[base + S.TEMPERATURE] - sublRate * 0.5);
  }
}

// ============================================================================
// 11. ELECTROMAGNETISM (cyan)
// ============================================================================

/** CHARGE_LAW — real Coulomb force on effective charge = POLARITY + stored CHARGE. */
export function applyChargeForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const q1 = (readDNA(p1Ptr, D.POLARITY) || 0) + (buf[p1Ptr + S.CHARGE] || 0);
  const q2 = (readDNA(p2Ptr, D.POLARITY) || 0) + (buf[p2Ptr + S.CHARGE] || 0);
  const qq = q1 * q2;
  if (qq === 0) return null;
  const force = -k * qq / (dist * dist + 0.5); // like charges repel, opposite attract
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** FIELD — uniform 3D drift along POLARITY sign, scaled by stored charge. */
export function applyFieldDrift(p1Ptr, k) {
  const buf = buffer_global;
  const q = readDNA(p1Ptr, D.POLARITY) || 0;
  if (q === 0) return null;
  const c = buf[p1Ptr + S.CHARGE] || 0;
  const f = k * (1 + Math.abs(c) * 0.5); // charged particles feel the field harder
  return { ax: q * f, ay: q * f, az: q * f };
}

/** CURRENT — charge diffusion between conductive neighbors. */
export function applyCurrentTransfer(p1Ptr, p2Ptr, distSq, k) {
  const buf = buffer_global;
  if (distSq > 300) return;
  // Real conduction needs both materials to conduct (confirmed batch-14).
  const cond = Math.min(readDNA(p1Ptr, D.CONDUCTIVITY) || 0, readDNA(p2Ptr, D.CONDUCTIVITY) || 0);
  if (cond <= 0) return;
  const dq = (buf[p2Ptr + S.CHARGE] - buf[p1Ptr + S.CHARGE]) * cond * k;
  if (dq === 0) return;
  buf[p1Ptr + S.CHARGE] += dq;
  buf[p2Ptr + S.CHARGE] -= dq;
}

/** RESISTANCE — kinetic energy → heat + velocity damping (per-particle).
 * Material-dependent (batch-15): high CONDUCTIVITY = low resistance, and
 * hotter particles damp harder (the doc's "hotter they get, more they slow"
 * feedback — prevents runaway charge-driven velocities). */
export function applyResistance(p1Ptr, vx, vy, vz, k) {
  const buf = buffer_global;
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (speed < 0.01) return null;
  const cond = readDNA(p1Ptr, D.CONDUCTIVITY) || 0;
  const materialFactor = 1 - cond * 0.9; // conductors glide, insulators resist
  const heatFactor = 1 + (buf[p1Ptr + S.TEMPERATURE] || 0) * 2; // hotter → slower
  const damp = speed * k * materialFactor * heatFactor;
  buf[p1Ptr + S.TEMPERATURE] = Math.min(1, (buf[p1Ptr + S.TEMPERATURE] || 0) + speed * k * materialFactor * 0.5);
  return { ax: -vx * damp, ay: -vy * damp, az: -vz * damp };
}

/** CAPACITANCE — store surplus energy as charge (per-particle).
 * Batch-15: discharging drains toward zero only — a depleted capacitor never
 * flips sign from draining. Charging keeps the ±2 breakdown clamp. */
export function applyCapacitanceStore(p1Ptr, k) {
  const buf = buffer_global;
  const energy = buf[p1Ptr + S.ENERGY] || 50;
  const delta = (energy - 50) * k;
  const c = buf[p1Ptr + S.CHARGE] || 0;
  if (delta < 0) {
    // Bleed toward zero; never overshoot into the opposite polarity.
    buf[p1Ptr + S.CHARGE] = c > 0 ? Math.max(0, c + delta) : c;
  } else {
    buf[p1Ptr + S.CHARGE] = clamp(c + delta, -2, 2);
  }
}

/** CAPACITANCE — pairwise force from stored charge. */
export function applyStoredChargeForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const c1 = buf[p1Ptr + S.CHARGE] || 0;
  const c2 = buf[p2Ptr + S.CHARGE] || 0;
  const qq = c1 * c2;
  if (qq === 0) return null;
  const force = -k * qq / (dist * dist + 0.5); // same-sign stored charge repels
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** INDUCTANCE — velocity alignment (magnetic coupling), in-place.
 * Batch-15: coupling scales with the product of MAGNETIC_MOMENT magnitudes
 * (|m1·m2| — induction needs a magnetic field), fades with distance, and both
 * particles must conduct (real materials, consistent with CURRENT). Momentum
 * is conserved: the pair swaps equal-and-opposite velocity deltas. */
export function applyInductance(p1Ptr, p2Ptr, dist, k) {
  const buf = buffer_global;
  const cond = Math.min(readDNA(p1Ptr, D.CONDUCTIVITY) || 0, readDNA(p2Ptr, D.CONDUCTIVITY) || 0);
  if (cond <= 0) return;
  const m1 = readDNA(p1Ptr, D.MAGNETIC_MOMENT) || 0;
  const m2 = readDNA(p2Ptr, D.MAGNETIC_MOMENT) || 0;
  const couple = Math.abs(m1 * m2) / (1 + dist * 0.03);
  if (couple <= 0.0001) return;
  for (const slot of [S.VEL_X, S.VEL_Y, S.VEL_Z]) {
    const dv = (buf[p2Ptr + slot] - buf[p1Ptr + slot]) * k * couple;
    buf[p1Ptr + slot] += dv;
    buf[p2Ptr + slot] -= dv;
  }
}

/** MAGNETISM — aligned moments attract, opposing repel. */
export function applyMagneticForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const m1 = readDNA(p1Ptr, D.MAGNETIC_MOMENT) || 0;
  const m2 = readDNA(p2Ptr, D.MAGNETIC_MOMENT) || 0;
  const mm = m1 * m2;
  if (mm === 0) return null;
  const force = k * mm / (dist * dist + 0.5);
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** RESONANCE — sympathetic vibration: matched pulsing pairs attract and amplify.
 * Batch-16: phase alignment matters. In-phase pairs (constructive interference)
 * scale the attraction up and the stronger pulser amplifies the weaker one's
 * SIGNAL — synchronized swarms get louder. Mismatched phase damps the force. */
export function applyResonanceForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const s1 = buf[p1Ptr + S.SIGNAL] || 0;
  const s2 = buf[p2Ptr + S.SIGNAL] || 0;
  if (s1 <= 0.01 || s2 <= 0.01) return null;
  const pr1 = readDNA(p1Ptr, D.PULSE_RATE) || 0.5;
  const pr2 = readDNA(p2Ptr, D.PULSE_RATE) || 0.5;
  const sync = 1.0 - Math.abs(pr1 - pr2);
  const sig = s1 * s2 * Math.max(0, sync);
  if (sig <= 0.001) return null;
  // Same oscillator phase as GLOW/COMMS: phase = sin(age·0.01·(0.1+pulseRate)).
  const ph1 = Math.sin((buf[p1Ptr + S.AGE] || 0) * 0.01 * (0.1 + pr1));
  const ph2 = Math.sin((buf[p2Ptr + S.AGE] || 0) * 0.01 * (0.1 + pr2));
  const phaseSync = 0.5 + 0.5 * Math.cos((ph1 - ph2) * Math.PI * 0.5);
  // Constructive interference: the weaker pulser is driven by the stronger.
  if (phaseSync > 0.6) {
    const weaker = s1 < s2 ? p1Ptr : p2Ptr;
    const stronger = weaker === p1Ptr ? p2Ptr : p1Ptr;
    buf[weaker + S.SIGNAL] = Math.min(1, (buf[weaker + S.SIGNAL] || 0) + (buf[stronger + S.SIGNAL] || 0) * phaseSync * k * 0.1);
  }
  const force = k * sig * phaseSync / (dist + 1.0);
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** FLUX — charge carriers drift along the field: F = qE (batch-16).
 * Direction depends on the particle's effective charge q = POLARITY + CHARGE:
 * positive carriers move DOWN the stored-charge gradient (with the field),
 * negative carriers move UP it (electrons run the other way), and neutrals
 * follow the field lines — the classic "pushed toward higher charge" behavior. */
export function applyFluxForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const dq = (buf[p2Ptr + S.CHARGE] || 0) - (buf[p1Ptr + S.CHARGE] || 0);
  if (dq === 0) return null;
  const q = (readDNA(p1Ptr, D.POLARITY) || 0) + (buf[p1Ptr + S.CHARGE] || 0);
  // Epsilon band: quantized "default 0" POLARITY is ~1.5e-5, so treat |q| ≤ 1e-3 as neutral (follows the field lines).
  const dir = q > 1e-3 ? -1 : q < -1e-3 ? 1 : 1;
  const force = dir * k * dq / (dist + 1.0);
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** IONIZATION — hard contacts strip charge, forming conserved +/− ion pairs.
 * Batch-16 (match irl): ionization needs a threshold impact (real ionization
 * energy), and it transfers charge — the pair becomes a +/− ion pair with
 * conserved total charge (q_i + q_j = 0). The combined POLARITY of the pair
 * sets which partner turns positive. Already-charged particles are not re-stripped. */
export function applyIonization(p1Ptr, p2Ptr, dist, relSpeed, k) {
  const buf = buffer_global;
  if (dist > 3.0) return;
  const impact = Math.min(1, relSpeed * k);
  if (impact <= 0.15) return; // below ionization energy — no strip
  const c1 = buf[p1Ptr + S.CHARGE] || 0;
  const c2 = buf[p2Ptr + S.CHARGE] || 0;
  if (c1 !== 0 || c2 !== 0) return; // already ionized — no further stripping
  const s = Math.sign((readDNA(p1Ptr, D.POLARITY) || 0) + (readDNA(p2Ptr, D.POLARITY) || 0)) || 1;
  buf[p1Ptr + S.CHARGE] = impact * s;
  buf[p2Ptr + S.CHARGE] = -impact * s;
}

/** DISCHARGE — stored charge bursts into motion + heat (per-particle).
 * Batch-16 (match irl): the spark travels along the potential difference —
 * kicked toward the neighbor with the most opposite stored charge (accumulated
 * by the solver during the pair loop). Random burst only when no opposite-charge
 * field exists nearby. Threshold (|c| ≥ 0.5), heat spike, and reset unchanged. */
export function applyDischarge(p1Ptr, prng, k, aimX, aimY, aimZ) {
  const buf = buffer_global;
  const c = buf[p1Ptr + S.CHARGE] || 0;
  if (Math.abs(c) < 0.5) return null;
  const kick = c * k;
  const aimMag = Math.sqrt(aimX * aimX + aimY * aimY + aimZ * aimZ);
  let ax, ay, az;
  if (aimMag > 0.001) {
    // Spark follows the gradient toward the opposite charge. Direction comes
    // from the aim (already charge-aware); magnitude is |charge|·k so the
    // charge sign never flips the aimed kick.
    ax = Math.abs(kick) * (aimX / aimMag);
    ay = Math.abs(kick) * (aimY / aimMag);
    az = Math.abs(kick) * (aimZ / aimMag);
  } else {
    const dir = prng ? (prng() - 0.5) * 2 : 0;
    ax = kick * 0.6;
    ay = kick * dir;
    az = kick * 0.2;
  }
  buf[p1Ptr + S.TEMPERATURE] = Math.min(1, (buf[p1Ptr + S.TEMPERATURE] || 0) + Math.abs(c) * 0.08);
  buf[p1Ptr + S.CHARGE] = 0;
  return { ax: nanGuard(ax), ay: nanGuard(ay), az: nanGuard(az) };
}

/** PLASMA — the thermal-EM bridge with hysteresis (batch-17, match irl).
 * Above 0.6 surplus heat ionizes into stored charge, cooling the gas. Below
 * 0.5 a cooled plasma recombines: stored charge converts back to heat and the
 * ion resets — real plasma never keeps its charge after it cools. The 0.6/0.5
 * band prevents rapid ionize/recombine oscillation. */
export function applyPlasma(p1Ptr, k) {
  const buf = buffer_global;
  const temp = buf[p1Ptr + S.TEMPERATURE] || 0;
  const excess = temp - 0.6;
  if (excess > 0) {
    const conv = excess * k;
    buf[p1Ptr + S.CHARGE] = clamp((buf[p1Ptr + S.CHARGE] || 0) + conv, -2, 2);
    buf[p1Ptr + S.TEMPERATURE] = temp - conv * 0.5;
    return;
  }
  // Recombination: below the ionization threshold, charge releases as heat.
  if (temp < 0.5) {
    const c = buf[p1Ptr + S.CHARGE] || 0;
    if (c !== 0) {
      buf[p1Ptr + S.TEMPERATURE] = Math.min(1, temp + Math.abs(c) * k * 2);
      buf[p1Ptr + S.CHARGE] = 0;
    }
  }
}

/** SUPERCONDUCTIVITY — cold pairs couple: relative motion damped + charge equalized. */
export function applySuperconductivity(p1Ptr, p2Ptr, k) {
  const buf = buffer_global;
  const t1 = buf[p1Ptr + S.TEMPERATURE] || 0;
  const t2 = buf[p2Ptr + S.TEMPERATURE] || 0;
  if (t1 > 0.35 || t2 > 0.35) return null;
  const dq = ((buf[p2Ptr + S.CHARGE] || 0) - (buf[p1Ptr + S.CHARGE] || 0)) * k * 0.4;
  buf[p1Ptr + S.CHARGE] = (buf[p1Ptr + S.CHARGE] || 0) + dq;
  buf[p2Ptr + S.CHARGE] = (buf[p2Ptr + S.CHARGE] || 0) - dq;
  // Coupling force: damps the subject's motion toward the neighbor's velocity
  return {
    ax: nanGuard((buf[p2Ptr + S.VEL_X] - buf[p1Ptr + S.VEL_X]) * k),
    ay: nanGuard((buf[p2Ptr + S.VEL_Y] - buf[p1Ptr + S.VEL_Y]) * k),
    az: nanGuard((buf[p2Ptr + S.VEL_Z] - buf[p1Ptr + S.VEL_Z]) * k),
  };
}

// ============================================================================
// 12. INFORMATION (gold)
// ============================================================================

/** MEMORY — refresh the trace on contact. */
export function applyMemoryRefresh(p1Ptr, p2Ptr) {
  const buf = buffer_global;
  buf[p1Ptr + S.MEMORY] = Math.min(1, (buf[p1Ptr + S.MEMORY] || 0) + 0.05);
  buf[p2Ptr + S.MEMORY] = Math.min(1, (buf[p2Ptr + S.MEMORY] || 0) + 0.05);
}

/** MEMORY — decay + momentum persistence (per-particle). */
export function applyMemoryDecay(p1Ptr, decay, k) {
  const buf = buffer_global;
  const mem = buf[p1Ptr + S.MEMORY] || 0;
  if (mem <= 0) return;
  buf[p1Ptr + S.MEMORY] = mem * decay;
  buf[p1Ptr + S.VEL_X] *= 1.0 + mem * k * 0.02;
  buf[p1Ptr + S.VEL_Y] *= 1.0 + mem * k * 0.02;
  buf[p1Ptr + S.VEL_Z] *= 1.0 + mem * k * 0.02;
}

/** PATTERN — cohesion: dense regions pull particles together. */
export function applyPatternForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  if (dist < 1.0) return null;
  const force = k / (dist + 1.0);
  const invDist = 1.0 / dist;
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** STIGMERGY — lay a predicted-path trail marker, or let it evaporate.
 * Batch-17 (match irl): only moving particles lay pheromone (speed gate);
 * a stopped particle's marker melts back toward it (evaporation), so trails
 * fade instead of persisting forever. */
export function applyTrailWrite(p1Ptr, px, py, pz, vx, vy, vz) {
  const buf = buffer_global;
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (speed >= 0.5) {
    buf[p1Ptr + S.TRAIL_X] = px + vx * 8.0;
    buf[p1Ptr + S.TRAIL_Y] = py + vy * 8.0;
    buf[p1Ptr + S.TRAIL_Z] = pz + vz * 8.0;
  } else {
    // Evaporation: the marker melts back toward the owner's position.
    buf[p1Ptr + S.TRAIL_X] += (px - buf[p1Ptr + S.TRAIL_X]) * 0.08;
    buf[p1Ptr + S.TRAIL_Y] += (py - buf[p1Ptr + S.TRAIL_Y]) * 0.08;
    buf[p1Ptr + S.TRAIL_Z] += (pz - buf[p1Ptr + S.TRAIL_Z]) * 0.08;
  }
}

/** STIGMERGY — follow a neighbor's trail marker along the pheromone gradient.
 * Batch-17 (match irl): the pull falls off with distance to the marker and
 * scales with freshness — a marker far from its owner's current position is
 * stale (evaporated) and pulls weakly. */
export function applyStigmergyForce(p1Ptr, p2Ptr, k, out) {
  const buf = buffer_global;
  const tx = buf[p2Ptr + S.TRAIL_X] || 0;
  const ty = buf[p2Ptr + S.TRAIL_Y] || 0;
  const tz = buf[p2Ptr + S.TRAIL_Z] || 0;
  const ddx = tx - buf[p1Ptr + S.POS_X];
  const ddy = ty - buf[p1Ptr + S.POS_Y];
  const ddz = tz - buf[p1Ptr + S.POS_Z];
  const dd = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) + 1.0;
  // Freshness: how close the marker is to its owner's current position.
  const ownerDx = tx - buf[p2Ptr + S.POS_X];
  const ownerDy = ty - buf[p2Ptr + S.POS_Y];
  const ownerDz = tz - buf[p2Ptr + S.POS_Z];
  const ownerDist = Math.sqrt(ownerDx * ownerDx + ownerDy * ownerDy + ownerDz * ownerDz);
  const freshness = 1.0 / (1.0 + ownerDist * 0.02);
  // Distance falloff: pheromone strength drops with distance from the marker.
  const falloff = 1.0 / (1.0 + dd * 0.1);
  const fx = nanGuard((ddx / dd) * k * freshness * falloff);
  const fy = nanGuard((ddy / dd) * k * freshness * falloff);
  const fz = nanGuard((ddz / dd) * k * freshness * falloff);
  // Allocation-free fast path: write into the caller's scratch object.
  if (out) { out.ax = fx; out.ay = fy; out.az = fz; return out; }
  return { ax: fx, ay: fy, az: fz };
}

/** SIGNAL_BOOST — relay signal to a neighbor on contact.
 * Batch-17: the relay scales with the sender's SIGNAL_STRENGTH DNA (0.5..1.5×),
 * consistent with GLOW/COMMS — stronger emitters relay more. */
export function applySignalBoost(p1Ptr, p2Ptr, k) {
  const buf = buffer_global;
  const s1 = buf[p1Ptr + S.SIGNAL] || 0;
  if (s1 > 0.01) {
    const strengthRaw = readDNA(p1Ptr, D.SIGNAL_STRENGTH);
    const strength = Number.isFinite(strengthRaw) ? strengthRaw : 0.5;
    buf[p2Ptr + S.SIGNAL] = Math.min(1, (buf[p2Ptr + S.SIGNAL] || 0) + s1 * k * (0.5 + strength * 0.5));
  }
}

/** LEARN — velocity matching (boids alignment), in-place. */
export function applyLearnAlign(p1Ptr, p2Ptr, k) {
  const buf = buffer_global;
  const kk = k * 0.1;
  for (const slot of [S.VEL_X, S.VEL_Y, S.VEL_Z]) {
    buf[p1Ptr + slot] += (buf[p2Ptr + slot] - buf[p1Ptr + slot]) * kk;
  }
}

/** SYMBOL — token-gated social force with contact imprinting (v4.6.29).
 * Arbitrary tokens acquire shared meaning: the higher-MEMORY partner teaches
 * its token on contact; same-token particles attract (homing on shared
 * meaning), different-token pairs repel weakly. Grouping follows learned
 * identity, not species — distinct from AFFINITY. */
export function applySymbolForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const t1 = Math.round((buf[p1Ptr + S.SYMBOL_TOKEN] || 0) * 7);
  const t2 = Math.round((buf[p2Ptr + S.SYMBOL_TOKEN] || 0) * 7);
  const rSum = (buf[p1Ptr + S.RADIUS] || 0.6) + (buf[p2Ptr + S.RADIUS] || 0.6);
  if (dist < rSum + 0.5) {
    const m1 = buf[p1Ptr + S.MEMORY] || 0;
    const m2 = buf[p2Ptr + S.MEMORY] || 0;
    const learn = Math.min(0.3, Math.abs(m1 - m2) * 0.2 * k);
    if (learn > 0.001) {
      if (m1 > m2) {
        const cur = buf[p2Ptr + S.SYMBOL_TOKEN] || 0;
        buf[p2Ptr + S.SYMBOL_TOKEN] = nanGuard(Math.min(1, Math.max(0, cur + (t1 / 7 - cur) * learn)));
      } else if (m2 > m1) {
        const cur = buf[p1Ptr + S.SYMBOL_TOKEN] || 0;
        buf[p1Ptr + S.SYMBOL_TOKEN] = nanGuard(Math.min(1, Math.max(0, cur + (t2 / 7 - cur) * learn)));
      }
    }
  }
  const strength = t1 === t2 ? 0.15 : -0.05;
  const force = k * strength / (dist + 1.0);
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** METRIC — climb the energy gradient. */
export function applyMetricForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const dE = (buf[p2Ptr + S.ENERGY] || 50) - (buf[p1Ptr + S.ENERGY] || 50);
  if (dE === 0) return null;
  const force = k * dE / (dist + 1.0);
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** PREDICT — aim at the neighbor's extrapolated position. */
export function applyPredictForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const t = 3.0;
  const pdx = dx + (buf[p2Ptr + S.VEL_X] - buf[p1Ptr + S.VEL_X]) * t;
  const pdy = dy + (buf[p2Ptr + S.VEL_Y] - buf[p1Ptr + S.VEL_Y]) * t;
  const pdz = dz + (buf[p2Ptr + S.VEL_Z] - buf[p1Ptr + S.VEL_Z]) * t;
  const pd = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz) + 0.001;
  const force = k / (dist + 1.0);
  return {
    ax: nanGuard((pdx / pd) * force),
    ay: nanGuard((pdy / pd) * force),
    az: nanGuard((pdz / pd) * force),
  };
}

/** CODE — blend DNA cache loci between contacting particles. */
export function applyCodeBlend(p1Ptr, p2Ptr, distSq, k) {
  const buf = buffer_global;
  if (distSq > 16.0) return;
  const rate = k * 0.01;
  for (let d = 0; d < 42; d += 6) {
    const base = S.DNA_CACHE_START + d;
    const v1 = buf[p1Ptr + base];
    const v2 = buf[p2Ptr + base];
    buf[p1Ptr + base] = v1 + (v2 - v1) * rate;
    buf[p2Ptr + base] = v2 + (v1 - v2) * rate;
  }
}

/** PROTOCOL — entrain signal phase between neighbors. */
export function applyProtocolSync(p1Ptr, p2Ptr, k) {
  const buf = buffer_global;
  const s1 = buf[p1Ptr + S.SIGNAL] || 0;
  const s2 = buf[p2Ptr + S.SIGNAL] || 0;
  const d1 = (s2 - s1) * k;
  buf[p1Ptr + S.SIGNAL] = Math.max(0, Math.min(1, s1 + d1));
  buf[p2Ptr + S.SIGNAL] = Math.max(0, Math.min(1, s2 - d1));
}

/** FEEDBACK — memory amplifies motion and motion refreshes memory. */
export function applyFeedback(p1Ptr, k) {
  const buf = buffer_global;
  const mem = buf[p1Ptr + S.MEMORY] || 0;
  const vx = buf[p1Ptr + S.VEL_X] || 0;
  const vy = buf[p1Ptr + S.VEL_Y] || 0;
  const vz = buf[p1Ptr + S.VEL_Z] || 0;
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  buf[p1Ptr + S.MEMORY] = Math.min(1, mem + speed * k * 0.02);
  if (mem <= 0 || speed < 0.001) return null;
  // Self-propulsion along current velocity, scaled by the memory trace
  const boost = mem * k * 0.1;
  return {
    ax: nanGuard(vx * boost),
    ay: nanGuard(vy * boost),
    az: nanGuard(vz * boost),
  };
}

/** LANGUAGE — signaling pairs exchange memory traces (shared words). */
export function applyLanguage(p1Ptr, p2Ptr, k) {
  const buf = buffer_global;
  const s1 = buf[p1Ptr + S.SIGNAL] || 0;
  const s2 = buf[p2Ptr + S.SIGNAL] || 0;
  if (s1 <= 0.01 && s2 <= 0.01) return;
  const m1 = buf[p1Ptr + S.MEMORY] || 0;
  const m2 = buf[p2Ptr + S.MEMORY] || 0;
  const avg = (m1 + m2) * 0.5;
  buf[p1Ptr + S.MEMORY] = m1 + (avg - m1) * k;
  buf[p2Ptr + S.MEMORY] = m2 + (avg - m2) * k;
  if (s1 > 0.01) {
    buf[p2Ptr + S.SIGNAL] = Math.min(1, (buf[p2Ptr + S.SIGNAL] || 0) + s1 * k * 0.1);
  }
}

/** CULTURE — same-species contacts converge their DNA cache. */
export function applyCulture(p1Ptr, p2Ptr, k) {
  const buf = buffer_global;
  if (buf[p1Ptr + S.SPECIES_ID] !== buf[p2Ptr + S.SPECIES_ID]) return;
  const rate = k * 0.02;
  for (let d = 0; d < 42; d += 3) {
    const base = S.DNA_CACHE_START + d;
    const v1 = buf[p1Ptr + base];
    const v2 = buf[p2Ptr + base];
    buf[p1Ptr + base] = v1 + (v2 - v1) * rate;
    buf[p2Ptr + base] = v2 + (v1 - v2) * rate;
  }
}

// ============================================================================
// 13. NEW LAW TYPES (singularity / entanglement / history)
// ============================================================================

/** SINGULARITY — extreme inward pull from a supermassive neighbour. */
export function applySingularityForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const m2 = buf[p2Ptr + S.MASS] || 0;
  if (m2 < SINGULARITY_MASS) return null;
  const force = k * (m2 * m2) / (dist * dist + 0.5);
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/**
 * SINGULARITY — event horizon absorption. The subject (p1, a normal particle)
 * is consumed by the neighbouring singularity (p2). Returns true if absorbed.
 */
export function applySingularityAbsorb(p1Ptr, p2Ptr, dist, k) {
  const buf = buffer_global;
  const m2 = buf[p2Ptr + S.MASS] || 0;
  if (m2 < SINGULARITY_MASS) return false;
  const horizon = Math.max(2.5, Math.sqrt(m2) * 0.8);
  if (dist >= horizon) return false;
  const m1 = buf[p1Ptr + S.MASS] || 0;
  if (m1 <= 0) return false;
  buf[p2Ptr + S.MASS] = m2 + m1;
  buf[p2Ptr + S.TEMPERATURE] = Math.min(1, (buf[p2Ptr + S.TEMPERATURE] || 0) + 0.12 * k);
  buf[p1Ptr + S.MASS] = 0;
  buf[p1Ptr + S.DEAD] = 1;
  return true;
}

/** ENTANGLEMENT — contact pairs two unentangled particles into a quantum link. */
export function applyEntanglePair(p1Ptr, p2Ptr, dist) {
  const buf = buffer_global;
  if (buf[p1Ptr + S.ENTANGLE_ID] >= 0 || buf[p2Ptr + S.ENTANGLE_ID] >= 0) return;
  const rSum = (buf[p1Ptr + S.RADIUS] || 0.6) + (buf[p2Ptr + S.RADIUS] || 0.6);
  if (dist > rSum + 0.5) return;
  buf[p1Ptr + S.ENTANGLE_ID] = p2Ptr / PARTICLE_STRIDE;
  buf[p2Ptr + S.ENTANGLE_ID] = p1Ptr / PARTICLE_STRIDE;
  buf[p1Ptr + S.ENTANGLE_PHASE] = 1.0;
  buf[p2Ptr + S.ENTANGLE_PHASE] = 1.0;
}

/**
 * ENTANGLEMENT — correlated link lifecycle (per-particle). The pair shares a
 * phase that decoheres (×0.998/tick); no signals and no momentum travel
 * through the link (no-signaling theorem). When one partner dies or the phase
 * expires, the shared correlation collapses on both sides. TELEPORT is the
 * only legitimate use of the link (quantum state transfer).
 */
export function applyEntanglement(p1Ptr) {
  const buf = buffer_global;
  const partnerIdx = buf[p1Ptr + S.ENTANGLE_ID];
  if (partnerIdx < 0) return null;
  const phase = buf[p1Ptr + S.ENTANGLE_PHASE] || 0;
  buf[p1Ptr + S.ENTANGLE_PHASE] = phase * 0.998;

  const jBase = partnerIdx * PARTICLE_STRIDE;
  if (buf[jBase + S.DEAD] >= 0.5 || buf[jBase + S.MASS] <= 0) {
    // partner lost → the correlation collapses on both sides
    clearEntangleLink(p1Ptr);
    clearEntangleLink(jBase);
    return null;
  }

  if (buf[p1Ptr + S.ENTANGLE_PHASE] < 0.05) {
    clearEntangleLink(p1Ptr);
    clearEntangleLink(jBase);
    return null;
  }
  return null;
}

/** Clear one side of an entangled pair. */
function clearEntangleLink(ptr) {
  const buf = buffer_global;
  buf[ptr + S.ENTANGLE_ID] = -1;
  buf[ptr + S.ENTANGLE_PHASE] = 0;
}

/** HISTORY — accumulate presence into the spatial memory field. */
export function applyHistoryWrite(p1Ptr, px, py, pz, worldSize) {
  const buf = buffer_global;
  if (!historyField) return;
  const cx = Math.max(0, Math.min(HISTORY_DIM - 1, Math.floor((px / worldSize) * HISTORY_DIM)));
  const cy = Math.max(0, Math.min(HISTORY_DIM - 1, Math.floor((py / worldSize) * HISTORY_DIM)));
  const cz = Math.max(0, Math.min(HISTORY_DIM - 1, Math.floor((pz / worldSize) * HISTORY_DIM)));
  const c = cx + cy * HISTORY_DIM + cz * HISTORY_DIM * HISTORY_DIM;
  const dt = historyTick - (historyLast[c] || 0);
  const presence = (buf[p1Ptr + S.ENERGY] || 50) * 0.02 + (buf[p1Ptr + S.MASS] || 1) * 0.05;
  historyField[c] = historyField[c] * Math.pow(HISTORY_DECAY, dt) + presence;
  historyLast[c] = historyTick;
}

/** Advance the memory-field clock once per solve. */
export function applyHistoryCalc() {
  if (!historyField) return;
  historyTick++;
}

/** HISTORY — drift along the local memory-field gradient (archaeology as a force). */
export function applyHistoryForce(p1Ptr, px, py, pz, worldSize, k) {
  if (!historyField) return null;
  const cellX = (px / worldSize) * HISTORY_DIM;
  const cellY = (py / worldSize) * HISTORY_DIM;
  const cellZ = (pz / worldSize) * HISTORY_DIM;
  const { gx, gy, gz } = historyGradient(cellX, cellY, cellZ);
  const gm = Math.sqrt(gx * gx + gy * gy + gz * gz);
  if (gm < 1e-6) return null;
  return {
    ax: nanGuard((gx / gm) * k),
    ay: nanGuard((gy / gm) * k),
    az: nanGuard((gz / gm) * k),
  };
}

/** Value of one coarse memory cell, toroidally wrapped. */
function historyCell(cx, cy, cz) {
  const x = ((cx % HISTORY_DIM) + HISTORY_DIM) % HISTORY_DIM;
  const y = ((cy % HISTORY_DIM) + HISTORY_DIM) % HISTORY_DIM;
  const z = ((cz % HISTORY_DIM) + HISTORY_DIM) % HISTORY_DIM;
  return historyField[x + y * HISTORY_DIM + z * HISTORY_DIM * HISTORY_DIM] || 0;
}

/**
 * Central-difference gradient of the coarse memory field at a fractional cell
 * position (wrap-around neighbours). Six reads — no global field scan.
 */
function historyGradient(cx, cy, cz) {
  const x = Math.floor(cx);
  const y = Math.floor(cy);
  const z = Math.floor(cz);
  return {
    gx: historyCell(x + 1, y, z) - historyCell(x - 1, y, z),
    gy: historyCell(x, y + 1, z) - historyCell(x, y - 1, z),
    gz: historyCell(x, y, z + 1) - historyCell(x, y, z - 1),
  };
}
