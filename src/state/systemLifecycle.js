/**
 * VEPA4 — Cross-system lifecycle substrate (Phases 2–5).
 *
 * This is a generic, additive registry for system observations. It does not
 * replace group, lineage, economy, or physics state and never writes particle
 * stride fields. Domain modules may attach stable subjects and explicit events;
 * analysis can then derive bounded regime evidence without inventing entities.
 */
import { SYSTEM_FOUNDATION, SYSTEM_FOUNDATION_ORDER } from './systemFoundation.js';
import { finite, clamp01 } from '../core/numeric.js';
import {
  createStaggeredImplementationPlan,
  getStaggeredIntegrationEdges,
  getSystemVariant,
} from './systemVariants.js';

const PHASES = Object.freeze({
  1: 'evidence-contract',
  2: 'durable-records',
  3: 'causal-events',
  4: 'emergent-evidence',
  5: 'analysis-report',
});

const DEFAULT_EVENT_CAP = 256;
const DEFAULT_RECORD_CAP = 2048;

function assertSystem(systemId) {
  if (!SYSTEM_FOUNDATION[systemId]) throw new Error(`Unknown system: ${systemId}`);
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export { PHASES };

export function createSystemLifecycle(options = {}) {
  return {
    records: new Map(),
    events: [],
    sequence: new Map(),
    clock: finite(options.clock, 0),
    eventCap: Math.max(1, Math.floor(options.eventCap || DEFAULT_EVENT_CAP)),
    recordCap: Math.max(1, Math.floor(options.recordCap || DEFAULT_RECORD_CAP)),
    variants: new Map(),
    integrations: [],
    relationships: new Map(),
    topology: null,
    evolution: null,
  };
}

/** Create a durable record with a deterministic system-local identifier. */
export function createSystemRecord(lifecycle, systemId, subjectId, attributes = {}) {
  assertSystem(systemId);
  const sequence = (lifecycle.sequence.get(systemId) || 0) + 1;
  lifecycle.sequence.set(systemId, sequence);
  const id = `${systemId}:${sequence}`;
  const now = ++lifecycle.clock;
  const record = {
    id,
    systemId,
    subjectId: subjectId ?? id,
    phase: 2,
    status: 'active',
    evidence: SYSTEM_FOUNDATION[systemId].evidence,
    createdAt: now,
    updatedAt: now,
    metrics: {},
    attributes: clone(attributes) || {},
  };
  lifecycle.records.set(id, record);
  trimRecords(lifecycle);
  return clone(record);
}

/** Update a durable record without changing its stable identity. */
export function updateSystemRecord(lifecycle, recordId, patch = {}) {
  const record = lifecycle.records.get(recordId);
  if (!record) return null;
  if (patch.systemId && patch.systemId !== record.systemId) {
    throw new Error('A system record cannot change systems');
  }
  const now = ++lifecycle.clock;
  if (patch.attributes) record.attributes = { ...record.attributes, ...clone(patch.attributes) };
  if (patch.metrics) record.metrics = { ...record.metrics, ...clone(patch.metrics) };
  if (patch.status) record.status = patch.status;
  record.updatedAt = now;
  return clone(record);
}

/** Append an explicit causal event and attach it to the durable record. */
export function recordSystemEvent(lifecycle, recordId, type, payload = {}) {
  const record = lifecycle.records.get(recordId);
  if (!record) return null;
  const event = {
    id: `${recordId}:event:${lifecycle.events.length + 1}`,
    recordId,
    systemId: record.systemId,
    type,
    at: ++lifecycle.clock,
    payload: clone(payload) || {},
  };
  lifecycle.events.push(event);
  if (lifecycle.events.length > lifecycle.eventCap) lifecycle.events.shift();
  record.phase = Math.max(record.phase, 3);
  record.updatedAt = event.at;
  record.metrics.events = (record.metrics.events || 0) + 1;
  record.metrics[type] = (record.metrics[type] || 0) + 1;
  return clone(event);
}

/** Close a record while retaining its history for analysis. */
export function closeSystemRecord(lifecycle, recordId, reason = 'closed') {
  const record = lifecycle.records.get(recordId);
  if (!record) return null;
  record.status = 'closed';
  record.phase = Math.max(record.phase, 3);
  record.updatedAt = ++lifecycle.clock;
  record.attributes.closeReason = reason;
  return clone(record);
}

/** Derive bounded emergence evidence from event density and explicit confidence. */
export function deriveSystemEvidence(lifecycle, systemId, options = {}) {
  assertSystem(systemId);
  const records = [...lifecycle.records.values()].filter((r) => r.systemId === systemId);
  const events = lifecycle.events.filter((e) => e.systemId === systemId);
  const eventCount = events.length;
  const activeRecords = records.filter((r) => r.status === 'active').length;
  const threshold = Math.max(1, Math.floor(options.eventThreshold || 3));
  const explicitConfidence = records.length
    ? records.reduce((sum, record) => sum + clamp01(record.attributes.confidence), 0) / records.length
    : 0;
  const persistence = records.length
    ? records.reduce((sum, record) => sum + (record.status === 'active' ? 1 : 0), 0) / records.length
    : 0;
  const score = clamp01((Math.min(1, eventCount / threshold) * 0.5) + (persistence * 0.3) + (explicitConfidence * 0.2));
  return {
    systemId,
    phase: score >= 0.5 ? 4 : 3,
    eventCount,
    recordCount: records.length,
    activeRecords,
    persistence,
    confidence: score,
    regime: score >= 0.75 ? 'stable-pattern' : score >= 0.5 ? 'emerging-pattern' : 'insufficient-evidence',
  };
}

/** Produce the Phase 5 report for one system or all systems. */
export function analyzeSystems(lifecycle, systemId = null) {
  const ids = systemId ? [systemId] : SYSTEM_FOUNDATION_ORDER;
  return ids.map((id) => {
    const evidence = deriveSystemEvidence(lifecycle, id);
    return {
      ...evidence,
      phase: 5,
      breadthRank: SYSTEM_FOUNDATION[id].breadthRank,
      implementationEvidence: SYSTEM_FOUNDATION[id].evidence,
      sourceAnchors: [...SYSTEM_FOUNDATION[id].sourceAnchors],
      causalEvents: lifecycle.events.filter((event) => event.systemId === id).map(clone),
    };
  });
}

export function getSystemPhaseStatus(lifecycle, systemId) {
  assertSystem(systemId);
  const evidence = deriveSystemEvidence(lifecycle, systemId);
  return {
    systemId,
    phaseOne: PHASES[1],
    phaseTwo: evidence.recordCount > 0 ? 'complete' : 'ready',
    phaseThree: evidence.eventCount > 0 ? 'complete' : 'ready',
    phaseFour: evidence.phase >= 4 ? 'complete' : 'ready',
    phaseFive: 'available',
  };
}

/** Register one roadmap variant after its predecessor seam has been applied. */
export function applyStaggeredVariant(lifecycle, variantId) {
  const plan = createStaggeredImplementationPlan();
  const step = plan.find((candidate) => candidate.variantId === variantId);
  if (!step) throw new Error(`Unknown system variant: ${variantId}`);
  if (lifecycle.variants.has(variantId)) return clone(lifecycle.variants.get(variantId));
  const previous = step.integrationBefore?.from;
  if (previous && !lifecycle.variants.has(previous)) {
    throw new Error(`Variant ${variantId} requires integration from ${previous}`);
  }
  const variant = getSystemVariant(step.systemId, step.variant);
  const record = createSystemRecord(lifecycle, step.systemId, variantId, {
    variant: step.variant,
    mode: variant.mode,
    emphasis: variant.emphasis,
    confidence: 0,
  });
  record.variantId = variantId;
  lifecycle.records.get(record.id).variantId = variantId;
  lifecycle.variants.set(variantId, { ...record, phase: 2 });
  if (previous) {
    const integration = { from: previous, to: variantId, step: step.step, at: ++lifecycle.clock };
    lifecycle.integrations.push(integration);
    recordSystemEvent(lifecycle, record.id, 'variant-integrated', integration);
  }
  return clone(lifecycle.variants.get(variantId));
}

export function applyNextStaggeredVariant(lifecycle) {
  const next = createStaggeredImplementationPlan().find((step) => !lifecycle.variants.has(step.variantId));
  return next ? applyStaggeredVariant(lifecycle, next.variantId) : null;
}

/** Create a durable relationship for one completed adjacent-variant seam. */
export function integrateStaggeredSeam(lifecycle, fromVariantId, toVariantId, attributes = {}) {
  const edge = getStaggeredIntegrationEdges().find(
    (candidate) => candidate.from === fromVariantId && candidate.to === toVariantId,
  );
  if (!edge) throw new Error(`Unknown staggered seam: ${fromVariantId} -> ${toVariantId}`);
  if (!lifecycle.variants.has(fromVariantId) || !lifecycle.variants.has(toVariantId)) {
    throw new Error(`Both variants must be applied before integrating ${fromVariantId} -> ${toVariantId}`);
  }
  const id = `integration:${fromVariantId}->${toVariantId}`;
  if (lifecycle.relationships.has(id)) return clone(lifecycle.relationships.get(id));
  const from = lifecycle.variants.get(fromVariantId);
  const to = lifecycle.variants.get(toVariantId);
  const relationship = {
    id,
    kind: 'roadmap-integration',
    fromVariantId,
    toVariantId,
    fromSystemId: from.systemId,
    toSystemId: to.systemId,
    status: 'active',
    phase: 3,
    formedAt: ++lifecycle.clock,
    attributes: clone(attributes) || {},
  };
  lifecycle.relationships.set(id, relationship);
  const toRecord = [...lifecycle.records.values()].find((record) => record.variantId === toVariantId);
  if (toRecord) recordSystemEvent(lifecycle, toRecord.id, 'relationship-integrated', { relationshipId: id });
  return clone(relationship);
}

/** Apply the next relationship seam after the first stagger has registered variants. */
export function applyNextStaggeredRelationship(lifecycle) {
  const edge = getStaggeredIntegrationEdges().find((candidate) => !lifecycle.relationships.has(`integration:${candidate.from}->${candidate.to}`));
  if (!edge) return null;
  return integrateStaggeredSeam(lifecycle, edge.from, edge.to);
}

export function closeStaggeredRelationship(lifecycle, relationshipId, reason = 'closed') {
  const relationship = lifecycle.relationships.get(relationshipId);
  if (!relationship) return null;
  relationship.status = 'closed';
  relationship.closedAt = ++lifecycle.clock;
  relationship.attributes = { ...relationship.attributes, closeReason: reason };
  return clone(relationship);
}

export function getStaggeredRelationshipReport(lifecycle) {
  return [...lifecycle.relationships.values()].map(clone);
}

/** Build the deterministic dependency topology produced by the first two staggers. */
export function computeStaggeredTopology(lifecycle) {
  const plan = createStaggeredImplementationPlan();
  const nodes = plan
    .filter((step) => lifecycle.variants.has(step.variantId))
    .map((step) => ({
      id: step.variantId,
      systemId: step.systemId,
      variant: step.variant,
      mode: step.mode,
    }));
  const edges = [...lifecycle.relationships.values()].map((relationship) => ({
    id: relationship.id,
    from: relationship.fromVariantId,
    to: relationship.toVariantId,
    status: relationship.status,
  }));
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) continue;
    adjacency.get(edge.from).push(edge.to);
    adjacency.get(edge.to).push(edge.from);
  }
  const expectedEdges = getStaggeredIntegrationEdges();
  const expectedEdgeIds = new Set(expectedEdges.map((edge) => `integration:${edge.from}->${edge.to}`));
  const unexpectedEdges = edges.filter((edge) => !expectedEdgeIds.has(edge.id));
  const dependencyOrder = plan.filter((step) => lifecycle.variants.has(step.variantId)).map((step) => step.variantId);
  const dependencyIndex = new Map(dependencyOrder.map((id, index) => [id, index]));
  const dependencyViolations = edges
    .filter((edge) => dependencyIndex.has(edge.from) && dependencyIndex.has(edge.to))
    .filter((edge) => dependencyIndex.get(edge.from) >= dependencyIndex.get(edge.to))
    .map((edge) => edge.id);
  const components = [];
  const visited = new Set();
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const component = [];
    const queue = [node.id];
    visited.add(node.id);
    while (queue.length) {
      const id = queue.shift();
      component.push(id);
      for (const neighbour of adjacency.get(id) || []) {
        if (!visited.has(neighbour)) {
          visited.add(neighbour);
          queue.push(neighbour);
        }
      }
    }
    components.push(component);
  }
  return {
    version: 1,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    activeEdgeCount: edges.filter((edge) => edge.status === 'active').length,
    dependencyOrder,
    dependencyEdgeCount: edges.filter((edge) => expectedEdgeIds.has(edge.id)).length,
    unexpectedEdges,
    dependencyViolations,
    deterministic: unexpectedEdges.length === 0 && dependencyViolations.length === 0,
    components,
    nodes,
    edges,
  };
}

/** Materialize the completed third stagger only after all prior seams exist. */
export function materializeStaggeredTopology(lifecycle) {
  const topology = computeStaggeredTopology(lifecycle);
  if (topology.nodeCount !== 48 || topology.edgeCount !== 47) {
    throw new Error(`Staggered topology requires 48 nodes and 47 edges; got ${topology.nodeCount} and ${topology.edgeCount}`);
  }
  if (topology.components.length !== 1) {
    throw new Error(`Staggered topology must be connected; got ${topology.components.length} components`);
  }
  if (topology.dependencyEdgeCount !== 47 || !topology.deterministic) {
    throw new Error('Staggered topology contains incomplete or non-deterministic dependencies');
  }
  if (!lifecycle.topology) lifecycle.topology = { ...topology, status: 'complete', completedAt: ++lifecycle.clock };
  return clone(lifecycle.topology);
}

/** Compute the bounded replay/evolution layer for the completed fourth stagger. */
export function computeStaggeredEvolution(lifecycle, options = {}) {
  const topology = lifecycle.topology || computeStaggeredTopology(lifecycle);
  const horizon = Math.max(1, Math.min(64, Math.floor(options.horizon || 12)));
  const seed = Math.max(0, Math.floor(options.seed || 0));
  const nodes = topology.nodes.map((node, index) => {
    const modeWeight = { evidence: 1, relationship: 2, explicit: 3, discovery: 4 }[node.mode] || 0;
    const state = (seed + index * 17 + modeWeight * 13) % 101;
    return { id: node.id, systemId: node.systemId, variant: node.variant, state, mode: node.mode };
  });
  const transitions = topology.edges.map((edge, index) => ({
    id: `evolution:${edge.from}->${edge.to}`,
    from: edge.from,
    to: edge.to,
    kind: 'evolutionary-seam',
    step: index + 1,
    delta: ((seed + index * 7) % 9) - 4,
  }));
  // Keep transition deltas deterministic and bounded without introducing RNG state.
  for (const transition of transitions) transition.delta = ((seed + transition.step * 7) % 9) - 4;
  const trajectory = [];
  let signal = seed % 101;
  for (let tick = 0; tick < horizon; tick += 1) {
    signal = (signal + 11 + (tick % 3)) % 101;
    trajectory.push({ tick, signal, activeNode: nodes[tick % nodes.length]?.id || null });
  }
  const regimes = [
    { name: 'reinforcing', score: nodes.filter((node) => node.mode === 'relationship' || node.mode === 'explicit').length / nodes.length },
    { name: 'exploratory', score: nodes.filter((node) => node.mode === 'discovery').length / nodes.length },
    { name: 'observational', score: nodes.filter((node) => node.mode === 'evidence').length / nodes.length },
  ];
  return {
    version: 1,
    status: topology.nodeCount === 48 && topology.edgeCount === 47 ? 'complete' : 'incomplete',
    seed,
    horizon,
    deterministic: true,
    nodeCount: nodes.length,
    transitionCount: transitions.length,
    nodes,
    transitions,
    trajectory,
    regimes,
  };
}

/** Persist the fourth stagger only after the connected third-stagger topology exists. */
export function materializeStaggeredEvolution(lifecycle, options = {}) {
  if (!lifecycle.topology) materializeStaggeredTopology(lifecycle);
  const evolution = computeStaggeredEvolution(lifecycle, options);
  if (evolution.status !== 'complete' || evolution.nodeCount !== 48 || evolution.transitionCount !== 47) {
    throw new Error('Staggered evolution requires a complete 48-node, 47-edge topology');
  }
  lifecycle.evolution = { ...evolution, completedAt: ++lifecycle.clock };
  return clone(lifecycle.evolution);
}

export function getStaggeredEvolutionReport(lifecycle) {
  return clone(lifecycle.evolution);
}

export function getStaggeredProgress(lifecycle) {
  const plan = createStaggeredImplementationPlan();
  return {
    completed: lifecycle.variants.size,
    total: plan.length,
    next: plan.find((step) => !lifecycle.variants.has(step.variantId))?.variantId || null,
    integrations: lifecycle.integrations.length,
    relationshipIntegrations: lifecycle.relationships.size,
    topology: lifecycle.topology?.status || 'ready',
    evolution: lifecycle.evolution?.status || 'ready',
  };
}

export function serializeSystemLifecycle(lifecycle) {
  return {
    version: 2,
    clock: lifecycle.clock,
    sequence: Object.fromEntries(lifecycle.sequence),
    records: [...lifecycle.records.values()].map(clone),
    events: lifecycle.events.map(clone),
    variants: [...lifecycle.variants.values()].map(clone),
    integrations: lifecycle.integrations.map(clone),
    relationships: [...lifecycle.relationships.values()].map(clone),
    topology: clone(lifecycle.topology),
    evolution: clone(lifecycle.evolution),
  };
}

export function restoreSystemLifecycle(snapshot, options = {}) {
  const lifecycle = createSystemLifecycle(options);
  if (!snapshot || ![1, 2].includes(snapshot.version)) return lifecycle;
  lifecycle.clock = finite(snapshot.clock, 0);
  lifecycle.sequence = new Map(Object.entries(snapshot.sequence || {}).map(([id, value]) => [id, finite(value)]));
  for (const record of snapshot.records || []) {
    if (SYSTEM_FOUNDATION[record.systemId] && record.id) lifecycle.records.set(record.id, clone(record));
  }
  lifecycle.events = (snapshot.events || []).filter((event) => SYSTEM_FOUNDATION[event.systemId]).map(clone).slice(-lifecycle.eventCap);
  lifecycle.integrations = (snapshot.integrations || []).map(clone);
  for (const relationship of snapshot.relationships || []) {
    if (relationship.id && relationship.kind === 'roadmap-integration') lifecycle.relationships.set(relationship.id, clone(relationship));
  }
  lifecycle.topology = snapshot.topology && snapshot.topology.version === 1 ? clone(snapshot.topology) : null;
  lifecycle.evolution = snapshot.evolution && snapshot.evolution.version === 1 ? clone(snapshot.evolution) : null;
  for (const variant of snapshot.variants || []) {
    if (variant.variantId && SYSTEM_FOUNDATION[variant.systemId]) lifecycle.variants.set(variant.variantId, clone(variant));
  }
  return lifecycle;
}

function trimRecords(lifecycle) {
  while (lifecycle.records.size > lifecycle.recordCap) {
    const oldest = lifecycle.records.keys().next().value;
    lifecycle.records.delete(oldest);
  }
}
