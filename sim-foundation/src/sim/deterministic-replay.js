import { createParticleExecutionAdapter } from './execution-adapter.js';

function digestState(state) {
  const bytes = new Uint8Array(state.buffer, state.byteOffset, state.byteLength);
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

/**
 * Re-run a fixed number of solver ticks from a complete adapter checkpoint.
 * This replays numerical evolution from the checkpoint; it does not claim that
 * a partial domain-event journal can reconstruct arbitrary prior state.
 */
export function replayParticleTicks(snapshot, tickCount) {
  if (!snapshot || !snapshot.randomState || !snapshot.identityState || !snapshot.state) {
    throw new TypeError('A complete execution-adapter snapshot is required for deterministic replay');
  }
  if (!Number.isInteger(tickCount) || tickCount < 0) throw new RangeError('tickCount must be a non-negative integer');
  const adapter = createParticleExecutionAdapter({
    initialState: snapshot.state,
    count: snapshot.count,
    stride: snapshot.stride,
    config: snapshot.config,
    randomSeed: snapshot.randomState.rootSeed,
    worldId: snapshot.worldId ?? 'replay-world',
  });
  adapter.restoreSnapshot(snapshot);
  for (let i = 0; i < tickCount; i++) adapter.step();
  const state = adapter.readState();
  const finalSnapshot = adapter.createSnapshot();
  return Object.freeze({
    tick: adapter.tick,
    state,
    stateDigest: digestState(state),
    identityState: finalSnapshot.identityState,
    randomState: finalSnapshot.randomState,
    eventJournal: finalSnapshot.eventJournal,
  });
}
