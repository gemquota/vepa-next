// ============================================================================
// VEPA4 — Quantum Law Group
// 16 stateless quantum laws (SUPERPOSITION .. ANTIMATTER). Per-particle laws
// return a force object {ax, ay, az} or null and may mutate state directly;
// pairwise laws act on the i-j pair. All buffer writes are NaN-guarded.
// ============================================================================

import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_INDEXES as D } from '../../constants.js';

const FORCE_LIMIT = 50;
const ENERGY_MAX = 200;
const SIGNAL_MAX = 10;
const BOUND_MAX = 1e4;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function nanGuard(v) {
  return Number.isFinite(v) ? v : 0;
}

function applySuperposition(view, iBase, k, prng) {
  // Superposition (v4.6.29): a spread of 4 basis amplitudes over candidate
  // velocities (stay, +perp, −perp, boost). Phases rotate each tick; a
  // collapse event picks one basis with probability |a|² (Born rule), then
  // renormalises (L2) — the real quantum measurement mechanism in a discrete
  // toy. Amplitudes are stored unnormalised; the collapse draw always uses
  // p_b = |a_b|² / Σ|a|², never the raw amplitude.
  let a1 = view[iBase + S.SUPER_AMP_1] || 0;
  let a2 = view[iBase + S.SUPER_AMP_2] || 0;
  let a3 = view[iBase + S.SUPER_AMP_3] || 0;
  let a4 = view[iBase + S.SUPER_AMP_4] || 0;
  if (a1 * a1 + a2 * a2 + a3 * a3 + a4 * a4 <= 1e-6) {
    a1 = 0.7; a2 = 0.1; a3 = 0.1; a4 = 0.1;
    view[iBase + S.SUPER_AMP_1] = a1;
    view[iBase + S.SUPER_AMP_2] = a2;
    view[iBase + S.SUPER_AMP_3] = a3;
    view[iBase + S.SUPER_AMP_4] = a4;
  }
  const phase = (view[iBase + S.SUPER_PHASE] || 0) + 0.05 * k;
  view[iBase + S.SUPER_PHASE] = phase;

  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  let px = 1, py = 0, pz = 0;
  if (speed > 0.01) { px = -vy / speed; py = vx / speed; pz = 0; }
  const offsets = [
    { x: 0, y: 0, z: 0 },
    { x: px * 0.3, y: py * 0.3, z: pz * 0.3 },
    { x: -px * 0.3, y: -py * 0.3, z: -pz * 0.3 },
    { x: vx * 0.15, y: vy * 0.15, z: vz * 0.15 },
  ];

  if (prng() < 0.02 * k) {
    // Born-rule collapse: sample basis b with p_b = |a_b|² / Σ|a|² (L2
    // normalisation), then collapse to the measured eigenstate plus a tiny
    // symmetric re-spread so interference can rebuild.
    const amps = [a1, a2, a3, a4];
    let norm2 = 0;
    for (let b = 0; b < 4; b++) norm2 += amps[b] * amps[b];
    if (norm2 > 1e-12) {
      const r = prng() * norm2;
      let acc = 0, basis = 0;
      for (let b = 0; b < 4; b++) {
        acc += amps[b] * amps[b];
        if (r <= acc) { basis = b; break; }
      }
      const o = offsets[basis];
      const eps = 0.05;
      view[iBase + S.SUPER_AMP_1] = basis === 0 ? 1 - 3 * eps : eps;
      view[iBase + S.SUPER_AMP_2] = basis === 1 ? 1 - 3 * eps : eps;
      view[iBase + S.SUPER_AMP_3] = basis === 2 ? 1 - 3 * eps : eps;
      view[iBase + S.SUPER_AMP_4] = basis === 3 ? 1 - 3 * eps : eps;
      return {
        ax: clamp(nanGuard(o.x * k), -FORCE_LIMIT, FORCE_LIMIT),
        ay: clamp(nanGuard(o.y * k), -FORCE_LIMIT, FORCE_LIMIT),
        az: clamp(nanGuard(o.z * k), -FORCE_LIMIT, FORCE_LIMIT),
      };
    }
  }
  // No collapse: gentle interference drift from the rotating phase.
  return {
    ax: clamp(nanGuard(Math.sin(phase) * 0.05 * k), -FORCE_LIMIT, FORCE_LIMIT),
    ay: clamp(nanGuard(Math.cos(phase) * 0.05 * k), -FORCE_LIMIT, FORCE_LIMIT),
    az: 0,
  };
}

function applyTunneling(view, iBase, k, prng) {
  if (prng() < 0.005 * k) {
    const hop = nanGuard(view[iBase + S.RADIUS]) * 6;
    view[iBase + S.POS_X] = clamp(nanGuard(view[iBase + S.POS_X]) + (prng() < 0.5 ? -hop : hop), 0, BOUND_MAX);
    view[iBase + S.POS_Y] = clamp(nanGuard(view[iBase + S.POS_Y]) + (prng() < 0.5 ? -hop : hop), 0, BOUND_MAX);
    view[iBase + S.POS_Z] = clamp(nanGuard(view[iBase + S.POS_Z]) + (prng() < 0.5 ? -hop : hop), 0, BOUND_MAX);
  }
  return null;
}

function applyDecoherence(view, iBase, k) {
  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  view[iBase + S.SIGNAL] = clamp(nanGuard(view[iBase + S.SIGNAL]) + 0.001 * k, 0, SIGNAL_MAX);
  return {
    ax: clamp(-vx * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
    ay: clamp(-vy * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
    az: clamp(-vz * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
  };
}

function applyWaveParticle(view, iBase, k) {
  // Duality is measurement-gated (v4.6.29), not speed-gated: an unmeasured
  // particle spreads as a wave (de Broglie, λ ∝ 1/p); once measured
  // (collision or OBSERVER neighbour, tracked in WAVE_MEASURED) it behaves
  // as a localised particle until the flag decays.
  const measured = view[iBase + S.WAVE_MEASURED] || 0;
  view[iBase + S.WAVE_MEASURED] = measured * 0.95;
  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (measured > 0.1) {
    // Particle mode: localised, ballistic — accelerate along velocity.
    return {
      ax: clamp(vx * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
      ay: clamp(vy * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
      az: clamp(vz * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
    };
  }
  // Wave mode: de Broglie spread — perpendicular drift, stronger at low
  // momentum (λ ∝ 1/p). PLANCK sets the quantum scale via synergy.
  if (speed < 0.01) {
    const phase = view[iBase + S.PHASE_1] || 0;
    return {
      ax: clamp(Math.sin(phase) * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
      ay: clamp(Math.cos(phase) * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
      az: 0,
    };
  }
  const inv = Math.min(2, 1 / speed);
  const perpX = -vy / speed;
  const perpY = vx / speed;
  const phase = view[iBase + S.PHASE_1] || 0;
  const amp = inv * 0.02 * k * (0.5 + 0.5 * Math.sin(phase));
  return {
    ax: clamp(nanGuard(perpX * amp), -FORCE_LIMIT, FORCE_LIMIT),
    ay: clamp(nanGuard(perpY * amp), -FORCE_LIMIT, FORCE_LIMIT),
    az: 0,
  };
}

function applyUncertainty(view, iBase, k, prng) {
  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  // Batch-30 RRP (match docs): the Heisenberg tradeoff is speed-gated —
  // fast particles jitter position only, slow particles get velocity kicks
  // only. Threshold mirrors WAVE_PARTICLE's 0.5 wave speed.
  if (speed >= 0.5) {
    view[iBase + S.POS_X] = clamp(nanGuard(view[iBase + S.POS_X]) + (prng() - 0.5) * 0.02 * k, 0, BOUND_MAX);
    view[iBase + S.POS_Y] = clamp(nanGuard(view[iBase + S.POS_Y]) + (prng() - 0.5) * 0.02 * k, 0, BOUND_MAX);
    view[iBase + S.POS_Z] = clamp(nanGuard(view[iBase + S.POS_Z]) + (prng() - 0.5) * 0.02 * k, 0, BOUND_MAX);
    return null;
  }
  return {
    ax: clamp((prng() - 0.5) * 0.05 * k, -FORCE_LIMIT, FORCE_LIMIT),
    ay: clamp((prng() - 0.5) * 0.05 * k, -FORCE_LIMIT, FORCE_LIMIT),
    az: clamp((prng() - 0.5) * 0.05 * k, -FORCE_LIMIT, FORCE_LIMIT),
  };
}

function applyTeleport(view, iBase, k, prng) {
  // Quantum state teleportation (v4.6.29): the state is transferred to an
  // entangled partner through a classical channel; the sender collapses — no
  // clone remains, and nothing moves through space. Requires ENTANGLE_ID.
  const partnerIdx = view[iBase + S.ENTANGLE_ID];
  if (partnerIdx < 0) return null;
  if (prng() >= 0.002 * k) return null;
  const energy = view[iBase + S.ENERGY] || 0;
  if (energy < 10) return null;
  const jBase = partnerIdx * PARTICLE_STRIDE;
  if (view[jBase + S.DEAD] >= 0.5 || (view[jBase + S.MASS] || 0) <= 0) {
    view[iBase + S.ENTANGLE_ID] = -1;
    view[iBase + S.ENTANGLE_PHASE] = 0;
    return null;
  }
  // Classical channel cost (one-tick delayed signalling is the sender's ENERGY).
  view[iBase + S.ENERGY] = Math.max(0, energy - 5);
  // Transfer the state to the entangled partner.
  view[jBase + S.VEL_X] = view[iBase + S.VEL_X];
  view[jBase + S.VEL_Y] = view[iBase + S.VEL_Y];
  view[jBase + S.VEL_Z] = view[iBase + S.VEL_Z];
  view[jBase + S.ENERGY] = Math.min(ENERGY_MAX, (view[jBase + S.ENERGY] || 0) + energy * 0.3);
  // Sender collapses to a jittered ground state — no clone remains.
  view[iBase + S.VEL_X] = (prng() - 0.5) * 0.4;
  view[iBase + S.VEL_Y] = (prng() - 0.5) * 0.4;
  view[iBase + S.VEL_Z] = (prng() - 0.5) * 0.4;
  // Link consumed.
  view[iBase + S.ENTANGLE_PHASE] = 0;
  view[iBase + S.ENTANGLE_ID] = -1;
  view[jBase + S.ENTANGLE_ID] = -1;
  view[jBase + S.ENTANGLE_PHASE] = 0;
  return null;
}

function applyObserver(view, iBase, jBase, k) {
  const memI = nanGuard(view[iBase + S.MEMORY]);
  if (memI > 0.5) {
    const vIx = nanGuard(view[iBase + S.VEL_X]);
    const vIy = nanGuard(view[iBase + S.VEL_Y]);
    const vIz = nanGuard(view[iBase + S.VEL_Z]);
    const vJx = nanGuard(view[jBase + S.VEL_X]);
    const vJy = nanGuard(view[jBase + S.VEL_Y]);
    const vJz = nanGuard(view[jBase + S.VEL_Z]);
    view[jBase + S.VEL_X] = vJx + (vIx - vJx) * 0.01 * k;
    view[jBase + S.VEL_Y] = vJy + (vIy - vJy) * 0.01 * k;
    view[jBase + S.VEL_Z] = vJz + (vIz - vJz) * 0.01 * k;
    view[jBase + S.MEMORY] = Math.max(nanGuard(view[jBase + S.MEMORY]), memI * 0.1);
  }
  return null;
}

function applyPlanck(view, iBase, k) {
  const q = Math.max(0.02, 0.1 * k);
  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  view[iBase + S.VEL_X] = Math.sign(vx) * Math.round(Math.abs(vx) / q) * q;
  view[iBase + S.VEL_Y] = Math.sign(vy) * Math.round(Math.abs(vy) / q) * q;
  view[iBase + S.VEL_Z] = Math.sign(vz) * Math.round(Math.abs(vz) / q) * q;
  return null;
}

function applyCoherence(view, iBase, jBase, k) {
  const vIx = nanGuard(view[iBase + S.VEL_X]);
  const vIy = nanGuard(view[iBase + S.VEL_Y]);
  const vIz = nanGuard(view[iBase + S.VEL_Z]);
  const vJx = nanGuard(view[jBase + S.VEL_X]);
  const vJy = nanGuard(view[jBase + S.VEL_Y]);
  const vJz = nanGuard(view[jBase + S.VEL_Z]);
  const ddx = vIx - vJx;
  const ddy = vIy - vJy;
  const ddz = vIz - vJz;
  const diff = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
  if (diff < 1) {
    return {
      ax: clamp((vJx - vIx) * 0.02 * k, -FORCE_LIMIT, FORCE_LIMIT),
      ay: clamp((vJy - vIy) * 0.02 * k, -FORCE_LIMIT, FORCE_LIMIT),
      az: clamp((vJz - vIz) * 0.02 * k, -FORCE_LIMIT, FORCE_LIMIT),
    };
  }
  return null;
}

function applyBosonic(view, iBase, jBase, dx, dy, dz, dist, k) {
  if (dist < 3) {
    const scale = (3 - dist) * k;
    const invDist = 1 / dist;
    return {
      ax: clamp(dx * invDist * scale, -FORCE_LIMIT, FORCE_LIMIT),
      ay: clamp(dy * invDist * scale, -FORCE_LIMIT, FORCE_LIMIT),
      az: clamp(dz * invDist * scale, -FORCE_LIMIT, FORCE_LIMIT),
    };
  }
  return null;
}

function applyFermionic(view, iBase, jBase, dx, dy, dz, dist, k) {
  const rSum = nanGuard(view[iBase + S.RADIUS]) + nanGuard(view[jBase + S.RADIUS]);
  if (dist < rSum) {
    const scale = (1 - dist / rSum) * k * 5;
    const invDist = 1 / dist;
    return {
      ax: clamp(-dx * invDist * scale, -FORCE_LIMIT, FORCE_LIMIT),
      ay: clamp(-dy * invDist * scale, -FORCE_LIMIT, FORCE_LIMIT),
      az: clamp(-dz * invDist * scale, -FORCE_LIMIT, FORCE_LIMIT),
    };
  }
  return null;
}

function applySpin(view, iBase, k, prng) {
  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  const sign = Math.floor(iBase / PARTICLE_STRIDE) % 2 === 0 ? 1 : -1;
  const amp = 0.1 * k * sign;
  if (speed > 0.1) {
    return {
      ax: clamp((-vy / speed) * amp, -FORCE_LIMIT, FORCE_LIMIT),
      ay: clamp((vx / speed) * amp, -FORCE_LIMIT, FORCE_LIMIT),
      az: 0,
    };
  }
  return {
    ax: clamp((prng() - 0.5) * 2 * amp, -FORCE_LIMIT, FORCE_LIMIT),
    ay: clamp((prng() - 0.5) * 2 * amp, -FORCE_LIMIT, FORCE_LIMIT),
    az: clamp((prng() - 0.5) * 2 * amp, -FORCE_LIMIT, FORCE_LIMIT),
  };
}

function applySpectral(view, iBase, k) {
  const species = nanGuard(view[iBase + S.SPECIES_ID]);
  view[iBase + S.SIGNAL] = clamp(nanGuard(view[iBase + S.SIGNAL]) + (0.001 + 0.001 * (species % 5)) * k, 0, SIGNAL_MAX);
  return null;
}

function applyWavefunction(view, iBase, k) {
  const q = Math.max(0.25, 0.5 * k);
  const px = nanGuard(view[iBase + S.POS_X]);
  const py = nanGuard(view[iBase + S.POS_Y]);
  const pz = nanGuard(view[iBase + S.POS_Z]);
  view[iBase + S.POS_X] = Math.round(px / q) * q;
  view[iBase + S.POS_Y] = Math.round(py / q) * q;
  view[iBase + S.POS_Z] = Math.round(pz / q) * q;
  return null;
}

function applyHyperplane(view, iBase, k) {
  return {
    ax: clamp(0.001 * k, -FORCE_LIMIT, FORCE_LIMIT),
    ay: clamp(0.0005 * k, -FORCE_LIMIT, FORCE_LIMIT),
    az: clamp(0.0002 * k, -FORCE_LIMIT, FORCE_LIMIT),
  };
}

function applyAntimatter(view, iBase, jBase, k) {
  const chargeI = nanGuard(view[iBase + S.CHARGE]);
  const chargeJ = nanGuard(view[jBase + S.CHARGE]);
  if ((chargeI > 0.1 && chargeJ < -0.1) || (chargeJ > 0.1 && chargeI < -0.1)) {
    view[iBase + S.DEAD] = 1;
    view[jBase + S.DEAD] = 1;
    view[iBase + S.SIGNAL] = Math.min(SIGNAL_MAX, nanGuard(view[iBase + S.SIGNAL]) + 10 * k);
    view[jBase + S.SIGNAL] = Math.min(SIGNAL_MAX, nanGuard(view[jBase + S.SIGNAL]) + 10 * k);
  }
  return null;
}
export { applySuperposition, applyTunneling, applyDecoherence, applyWaveParticle, applyUncertainty, applyTeleport, applyObserver, applyPlanck, applyCoherence, applyBosonic, applyFermionic, applySpin, applySpectral, applyWavefunction, applyHyperplane, applyAntimatter };
