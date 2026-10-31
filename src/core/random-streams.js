import { SplitMix32 } from './prng.js';
import { textToSeed } from './seed.js';

export const RANDOM_STREAMS_SCHEMA = 'vepa.random-streams';
export const RANDOM_STREAMS_VERSION = 1;

function validateSeed(seed) {
  if (!Number.isInteger(seed) || seed < -2147483648 || seed > 0xffffffff) {
    throw new TypeError('seed must be a 32-bit integer');
  }
  return seed >>> 0;
}

function streamKey(domain, entityId) {
  if (typeof domain !== 'string' || !domain.trim() || domain.includes('\0')) {
    throw new TypeError('random stream domain must be a non-empty string');
  }
  if (!(typeof entityId === 'string' || (Number.isSafeInteger(entityId) && entityId >= 0))) {
    throw new TypeError('random stream entityId must be a non-empty string or non-negative safe integer');
  }
  if (typeof entityId === 'string' && !entityId.length) {
    throw new TypeError('random stream entityId must not be empty');
  }
  return JSON.stringify([domain, typeof entityId, entityId]);
}

function deriveSeed(rootSeed, key) {
  // Domain separation: a stream is independent of request order and of every
  // other (domain, entity) pair. textToSeed is stable UTF-16 FNV-1a.
  let value = (rootSeed ^ textToSeed(key) ^ 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0;
  return (value ^ (value >>> 15)) >>> 0;
}

/**
 * Stable keyed random streams. Each domain/entity pair owns an independent
 * SplitMix32 state, so particle iteration order and births in other domains
 * do not consume a shared global sequence. Entity IDs must be stable across
 * save/load and replay; array indices are not a suitable identity if compaction
 * or reordering can occur.
 *
 * This is infrastructure only: existing solver/biology paths must explicitly
 * request and consume these streams before they can claim deterministic V3
 * behavior parity.
 */
export function createDeterministicRandomStreams({ seed = 0, snapshot = undefined } = {}) {
  const rootSeed = validateSeed(seed);
  const streams = new Map();

  function get(domain, entityId) {
    const key = streamKey(domain, entityId);
    let stream = streams.get(key);
    if (!stream) {
      stream = new SplitMix32(deriveSeed(rootSeed, key));
      streams.set(key, stream);
    }
    return stream;
  }

  function restore(value) {
    if (!value || value.schema !== RANDOM_STREAMS_SCHEMA ||
        value.version !== RANDOM_STREAMS_VERSION || validateSeed(value.rootSeed) !== rootSeed ||
        !Array.isArray(value.streams)) {
      throw new TypeError('Incompatible deterministic random-stream snapshot');
    }
    const next = new Map();
    let previous = null;
    for (const entry of value.streams) {
      if (!entry || typeof entry.key !== 'string' || !Number.isInteger(entry.state) ||
          entry.state < 0 || entry.state > 0xffffffff ||
          (previous !== null && entry.key <= previous)) {
        throw new TypeError('Invalid deterministic random-stream entry');
      }
      let parsedKey;
      try { parsedKey = JSON.parse(entry.key); } catch { throw new TypeError('Invalid deterministic random-stream key'); }
      if (!Array.isArray(parsedKey) || parsedKey.length !== 3 ||
          typeof parsedKey[0] !== 'string' || !parsedKey[0] ||
          !['string', 'number'].includes(parsedKey[1]) ||
          (parsedKey[1] === 'string' ? typeof parsedKey[2] !== 'string' || !parsedKey[2] :
            !Number.isSafeInteger(parsedKey[2]) || parsedKey[2] < 0) ||
          streamKey(parsedKey[0], parsedKey[2]) !== entry.key) {
        throw new TypeError('Invalid deterministic random-stream key');
      }
      previous = entry.key;
      const stream = new SplitMix32(0).restore({
        algorithm: 'splitmix32-v1',
        state: entry.state,
      });
      next.set(entry.key, stream);
    }
    streams.clear();
    for (const [key, stream] of next) streams.set(key, stream);
    return Object.freeze({ restored: true, streamCount: streams.size });
  }

  if (snapshot !== undefined) restore(snapshot);

  return Object.freeze({
    seed: rootSeed,
    get(domain, entityId) {
      const stream = get(domain, entityId);
      return Object.freeze({
        next: () => stream.next(),
        nextUint32: () => stream.nextUint32(),
        nextInt: (min, max) => stream.nextInt(min, max),
        nextFloat: (min, max) => stream.nextFloat(min, max),
      });
    },
    snapshot() {
      const entries = Array.from(streams, ([key, stream]) => ({
        key,
        state: stream.snapshot().state,
      })).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
      return Object.freeze({
        schema: RANDOM_STREAMS_SCHEMA,
        version: RANDOM_STREAMS_VERSION,
        rootSeed,
        streams: Object.freeze(entries.map(entry => Object.freeze(entry))),
      });
    },
    restore,
    get streamCount() { return streams.size; },
  });
}
