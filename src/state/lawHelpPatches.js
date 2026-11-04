/**
 * VEPA4 — LAW_HELP_DB patches (v8.0.0 "Matter & Union")
 *
 * These entries extend the static help table with runtime-confirmed semantics.
 * The tooltip overlays them on LAW_HELP_DB, and the technical-spec generator
 * records their supplemental provenance separately from canonical metadata.
 */

export const LAW_HELP_PATCHES = {
  ACCR: {
    hint: 'Accretion: overlapping bodies merge into one.',
    explanation:
      'When the fusion gate passes — FUSION_MOMENTUM DNA (minimum relative momentum to fuse on impact) or FUSION_TIME DNA (seconds of continuous close contact for slower pairs) — the pair collapses into a single body: combined mass (× FUSION DNA efficiency), centre-of-mass position, momentum-conserving velocity, and mass-weighted colour. Bonded pairs (BOND / POLYMER) are molecules and never accrete — they stay as separate attached orbs.',
    system:
      'True merger (v8.0.0): the survivor keeps its slot with MASS = (m1+m2)·(0.5+FUSION), colour and energy mass-weighted; the neighbour is marked DEAD. Proximity dwell is tracked per pair (PARTNER_ID / MITOSIS_TIMER) and resets when contact breaks. STOICHIOMETRY forces an exact merger (efficiency 1.0). Stars absorb whole bodies.',
    advanced:
      'Replaces the pre-8.0 gradual dissolution (≈4% mass per frame until the smaller body died). Momentum, centre-of-mass position and weighted colour are exact; total mass may shift by FUSION efficiency unless STOICHIOMETRY is active. Shares the mergeParticles core with ALLOY — see src/physics/mergePhysics.js.',
  },
  ALLOY: {
    hint: 'Alloying: different-species particles fuse into composites.',
    explanation:
      'Confirmed batch-11 (real-life behavior) + v8.0.0: two different-species particles that overlap dissolve into one homogeneous composite — full mass merge, per-particle DNA averaged (mass-weighted), colour blended (mass-weighted — the heavier partner dominates). The survivor keeps its species slot but behaves as the mix. Bonded pairs stay as separate attached orbs and never alloy.',
    system:
      'Overlap dist < (r1+r2)·0.5: MASS = m1+m2, DNA_CACHE = mass-weighted average of both, colours mass-weighted, j is marked DEAD. Bonded pairs are excluded. Gated by ALLOY.',
    advanced:
      'The colour blend was upgraded from a flat 50/50 average to a mass-weighted average in v8.0.0. Shares the mergeParticles core with ACCR — see src/physics/mergePhysics.js.',
  },
  FIELD: {
    advanced: 'FIELD is the central simulation-field gradient; ELECTRIC_FIELD is the separate electromagnetic polarity drift.',
  },
  ELECTRIC_FIELD: {
    hint: 'Electric field drift follows particle polarity.',
    explanation: 'The electromagnetic field applies a uniform polarity-directed drift, with stored CHARGE increasing the response magnitude.',
    system: 'For non-zero POLARITY, acceleration follows the polarity sign and is scaled by the electric-field coefficient and charge magnitude.',
    advanced: 'This is the electromagnetic drift primitive; FIELD is the central simulation-field gradient.',
  },
  HORIZON: {
    hint: 'Event horizons capture nearby matter.',
    explanation: 'Massive bodies expose a bounded capture region whose inward acceleration increases toward the horizon, providing the local event-horizon effect.',
    system: 'The horizon radius combines the body RADIUS with the square root of MASS; inside its falloff range, inward force scales with mass and distance.',
    advanced: 'HORIZON supplies the capture-force primitive; singularity absorption remains a separate lifecycle operation.',
  },
  RADIATION_PRESSURE: {
    hint: 'Radiant energy pushes matter outward.',
    explanation: 'Energetic bodies transfer outward momentum to nearby particles, with pressure decreasing as distance increases.',
    system: 'ENERGY, ELECTRIC_ENERGY, and STORED_ENERGY contribute to a bounded inverse-square outward force.',
    advanced: 'PHASE_RADIATION emits energy; RADIATION_PRESSURE converts available energy into momentum transfer.',
  },
  MASS_INERTIA: {
    hint: 'Mass resists changes in motion.',
    explanation: 'The mass-inertia primitive attenuates accumulated acceleration according to particle MASS, so heavier particles respond less to the same force.',
    system: 'Acceleration is scaled by 1 / (1 + MASS x inertia coefficient), with finite-value and force bounds preserved.',
    advanced: 'The primitive is exported from the Physics lawgroup; the solver audit records whether its law gate is wired separately.',
  },
};
