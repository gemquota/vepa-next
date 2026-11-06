/**
 * Bounded sparse relationship graph for social/ecological state.
 *
 * This registry is deliberately outside the particle stride and physics hot
 * loop. Endpoints are stable particle IDs, never transient buffer indices.
 * Directed edge identity is explicit; undirected edges use canonical endpoint
 * ordering. Callers own the meaning and scheduling of relationship effects.
 */

const DEFAULTS = Object.freeze({ maxEdges: 100_000, maxHistory: 16 });

function stableId(value) {
  return (typeof value === 'string' && value.length > 0)
    || (Number.isSafeInteger(value) && value >= 0);
}

function compareIds(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function finiteNonNegative(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be finite and non-negative`);
  return value;
}

function edgeKey(source, target, type, directed) {
  const [a, b] = directed || compareIds(source, target) <= 0
    ? [source, target] : [target, source];
  return JSON.stringify([directed ? 'd' : 'u', a, b, type]);
}

function cloneEdge(edge) {
  return { ...edge, history: edge.history.map((event) => ({ ...event })) };
}

export function createSparseRelationshipGraph(options = {}) {
  const maxEdges = options.maxEdges ?? DEFAULTS.maxEdges;
  const maxHistory = options.maxHistory ?? DEFAULTS.maxHistory;
  if (!Number.isSafeInteger(maxEdges) || maxEdges < 1) throw new RangeError('maxEdges must be a positive safe integer');
  if (!Number.isSafeInteger(maxHistory) || maxHistory < 1) throw new RangeError('maxHistory must be a positive safe integer');
  return { schemaVersion: 1, maxEdges, maxHistory, tick: 0, edges: new Map(), adjacency: new Map() };
}

function addIndex(graph, id, key) {
  let keys = graph.adjacency.get(id);
  if (!keys) graph.adjacency.set(id, keys = new Set());
  keys.add(key);
}

function removeIndex(graph, id, key) {
  const keys = graph.adjacency.get(id);
  if (!keys) return;
  keys.delete(key);
  if (keys.size === 0) graph.adjacency.delete(id);
}

function appendHistory(edge, event, maxHistory) {
  edge.history.push({ tick: event.tick, kind: event.kind, value: event.value ?? null });
  if (edge.history.length > maxHistory) edge.history.splice(0, edge.history.length - maxHistory);
}

/** Add or update one relationship. Returns a defensive edge copy. */
export function upsertRelationship(graph, input = {}) {
  if (!graph || graph.schemaVersion !== 1) throw new TypeError('invalid relationship graph');
  const { source, target, type, directed = false, tick = graph.tick, strength, decay, metadata = {} } = input;
  if (!stableId(source) || !stableId(target) || source === target) throw new TypeError('relationship endpoints must be distinct stable IDs');
  if (typeof type !== 'string' || !type.trim()) throw new TypeError('relationship type is required');
  if (typeof directed !== 'boolean') throw new TypeError('directed must be boolean');
  finiteNonNegative(tick, 'tick');
  finiteNonNegative(decay, 'decay');
  if (!Number.isFinite(strength) || strength < 0 || strength > 1) throw new RangeError('strength must be in [0, 1]');
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new TypeError('metadata must be an object');
  const [a, b] = directed || compareIds(source, target) <= 0 ? [source, target] : [target, source];
  const key = edgeKey(source, target, type, directed);
  let edge = graph.edges.get(key);
  if (!edge) {
    if (graph.edges.size >= graph.maxEdges) throw new RangeError('relationship graph capacity reached; prune before inserting');
    edge = { id: key, source: a, target: b, type, directed, strength: strength ?? 1, decay: decay ?? 0, createdTick: tick, updatedTick: tick, active: true, metadata: { ...metadata }, history: [] };
    graph.edges.set(key, edge);
    addIndex(graph, a, key);
    addIndex(graph, b, key);
    appendHistory(edge, { tick, kind: 'formed', value: edge.strength }, graph.maxHistory);
  } else {
    if (strength !== undefined) edge.strength = strength;
    if (decay !== undefined) edge.decay = decay;
    edge.updatedTick = tick;
    edge.active = true;
    edge.metadata = { ...edge.metadata, ...metadata };
    appendHistory(edge, { tick, kind: 'updated', value: edge.strength }, graph.maxHistory);
  }
  graph.tick = Math.max(graph.tick, tick);
  return cloneEdge(edge);
}

/** Apply deterministic linear decay over elapsed simulation ticks. */
export function advanceRelationshipGraph(graph, tick) {
  finiteNonNegative(tick, 'tick');
  if (tick < graph.tick) throw new RangeError('relationship graph tick cannot move backwards');
  const elapsed = tick - graph.tick;
  if (elapsed === 0) return 0;
  let decayed = 0;
  for (const edge of graph.edges.values()) {
    if (!edge.active || edge.decay === 0) continue;
    const next = Math.max(0, edge.strength - edge.decay * elapsed);
    if (next !== edge.strength) {
      edge.strength = next;
      edge.updatedTick = tick;
      appendHistory(edge, { tick, kind: 'decayed', value: next }, graph.maxHistory);
      decayed += 1;
    }
    if (edge.strength === 0) edge.active = false;
  }
  graph.tick = tick;
  return decayed;
}

export function getRelationships(graph, particleId, { type, includeInactive = false } = {}) {
  if (!stableId(particleId)) throw new TypeError('particleId must be a stable ID');
  const keys = graph.adjacency.get(particleId) || [];
  const result = [];
  for (const key of keys) {
    const edge = graph.edges.get(key);
    if (!edge || (!includeInactive && !edge.active) || (type && edge.type !== type)) continue;
    result.push(cloneEdge(edge));
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

export function pruneRelationshipGraph(graph, { beforeTick = Infinity, inactiveOnly = true } = {}) {
  if (beforeTick !== Infinity) finiteNonNegative(beforeTick, 'beforeTick');
  const removed = [];
  for (const [key, edge] of graph.edges) {
    if ((inactiveOnly && edge.active) || edge.updatedTick >= beforeTick) continue;
    graph.edges.delete(key);
    removeIndex(graph, edge.source, key);
    removeIndex(graph, edge.target, key);
    removed.push(key);
  }
  return removed;
}

export function snapshotRelationshipGraph(graph) {
  return {
    schemaVersion: 1,
    maxEdges: graph.maxEdges,
    maxHistory: graph.maxHistory,
    tick: graph.tick,
    edges: [...graph.edges.values()].map(cloneEdge).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function restoreRelationshipGraph(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.edges)) throw new TypeError('unsupported relationship graph snapshot');
  const graph = createSparseRelationshipGraph({ maxEdges: snapshot.maxEdges, maxHistory: snapshot.maxHistory });
  finiteNonNegative(snapshot.tick, 'snapshot tick');
  if (snapshot.edges.length > graph.maxEdges) throw new RangeError('snapshot exceeds relationship graph capacity');
  for (const edge of snapshot.edges) {
    const restored = upsertRelationship(graph, edge);
    if (restored.id !== edge.id || !Array.isArray(edge.history) || edge.history.length > graph.maxHistory) throw new TypeError('invalid relationship graph edge snapshot');
    const stored = graph.edges.get(restored.id);
    stored.createdTick = finiteNonNegative(edge.createdTick, 'createdTick');
    stored.updatedTick = finiteNonNegative(edge.updatedTick, 'updatedTick');
    stored.active = edge.active === true;
    stored.history = edge.history.map((event) => {
      if (!event || !Number.isFinite(event.tick) || typeof event.kind !== 'string') throw new TypeError('invalid relationship history event');
      return { tick: event.tick, kind: event.kind, value: event.value ?? null };
    });
  }
  graph.tick = snapshot.tick;
  return graph;
}
