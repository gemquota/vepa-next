/**
 * VEPA4 — Shared roadmap variant registry.
 *
 * The 48 roadmap files are implemented through one bounded substrate rather
 * than 48 independent registries. The schedule alternates A/B/C/D within each
 * system, then advances to the next system, preserving an integration seam
 * between every adjacent variant.
 */
import { SYSTEM_FOUNDATION_ORDER } from './systemFoundation.js';

export const VARIANT_ORDER = Object.freeze(['A', 'B', 'C', 'D']);

const VARIANT_MODES = Object.freeze({
  A: Object.freeze({
    mode: 'evidence',
    label: 'evidence-first',
    purpose: 'instrument current behavior before promoting ontology',
  }),
  B: Object.freeze({
    mode: 'relationship',
    label: 'relationship-graph-first',
    purpose: 'add bounded typed relationships and topology',
  }),
  C: Object.freeze({
    mode: 'explicit',
    label: 'explicit-system-first',
    purpose: 'promote validated projections into durable records',
  }),
  D: Object.freeze({
    mode: 'discovery',
    label: 'open-ended-evolutionary',
    purpose: 'discover regimes from replayable trajectories',
  }),
});

const SYSTEM_EMPHASIS = Object.freeze({
  'family-kinship': 'ancestry, care, recognition, and household evidence',
  'group-tribe-clan': 'membership, territory, roles, and fission/fusion',
  'mating-reproduction': 'partner formation, transfer, offspring, and inheritance',
  'nation-polity': 'jurisdiction, authority, policy, borders, and succession',
  civilization: 'institutions, infrastructure, surplus, culture, and continuity',
  'culture-memory': 'transmission, symbols, norms, practices, and fidelity',
  'relationship-laboratory': 'controlled perturbations, trajectories, and regimes',
  'synthetic-society': 'program identity, uploads, upkeep, copying, and machine groups',
  ecology: 'niches, food webs, resources, succession, and extinction',
  'economy-governance': 'production, exchange, scarcity, policy, and redistribution',
  infrastructure: 'construction, networks, maintenance, ownership, and failure',
  'species-lineage': 'genomes, generations, divergence, gene flow, and speciation',
});

const SHARED_PHASES = Object.freeze([
  'baseline current implementation',
  'define bounded durable records',
  'capture causal formation and change events',
  'integrate with adjacent systems',
  'expose reports and replay controls',
  'stress caps, restore, and determinism',
]);

const variantId = (systemId, variant) => `${systemId}-${variant}`;

export const SYSTEM_VARIANTS = Object.freeze(
  Object.fromEntries(SYSTEM_FOUNDATION_ORDER.flatMap((systemId) => VARIANT_ORDER.map((variant) => {
    const mode = VARIANT_MODES[variant];
    return [variantId(systemId, variant), Object.freeze({
      id: variantId(systemId, variant),
      systemId,
      variant,
      mode: mode.mode,
      label: mode.label,
      purpose: mode.purpose,
      emphasis: SYSTEM_EMPHASIS[systemId],
      phases: SHARED_PHASES,
    })];
  }))),
);

export function getSystemVariant(systemId, variant) {
  return SYSTEM_VARIANTS[variantId(systemId, variant)] || null;
}

export function getSystemVariantReport() {
  return Object.values(SYSTEM_VARIANTS).map((variant) => ({
    ...variant,
    phases: [...variant.phases],
  }));
}

/**
 * Return the implementation order: A, B, C, D for system 1, then A, B, C, D
 * for system 2, etc. Every item after the first carries an explicit seam.
 */
export function createStaggeredImplementationPlan() {
  const plan = [];
  for (const systemId of SYSTEM_FOUNDATION_ORDER) {
    for (const variant of VARIANT_ORDER) {
      const current = getSystemVariant(systemId, variant);
      const previous = plan.at(-1);
      plan.push({
        step: plan.length + 1,
        variantId: current.id,
        systemId,
        variant,
        mode: current.mode,
        integrationBefore: previous
          ? { from: previous.variantId, to: current.id, kind: 'cross-variant-seam' }
          : null,
      });
    }
  }
  return plan;
}

export function getStaggeredIntegrationEdges() {
  return createStaggeredImplementationPlan().slice(1).map((step) => ({ ...step.integrationBefore }));
}

export { SHARED_PHASES };
