import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductRandomBridge } from '../../src/interop/product-boundary.js';
import { createDeterministicRandomStreams } from '../../src/core/random-streams.js';

function legacyWorkerNext(stateRef) {
  let z = (stateRef.state + 0x9e3779b9) | 0;
  stateRef.state = z;
  z = (z ^ (z >>> 16)) | 0;
  z = Math.imul(z, 0x21f0aaad);
  z = z ^ (z >>> 15);
  z = Math.imul(z, 0x735a2d97);
  z = z ^ (z >>> 15);
  return z >>> 0;
}

test('product worker SplitMix32 and SIM compatibility bridge produce identical legacy sequences', () => {
  const seed = 0x51f15e;
  const legacy = { state: seed | 0 };
  const bridge = createProductRandomBridge({ seed, state: seed });
  for (let i = 0; i < 128; i++) assert.equal(bridge.nextUint32(), legacyWorkerNext(legacy));
  assert.equal(bridge.state, legacy.state >>> 0);
});

test('named random streams are independent of access order and survive snapshot restore', () => {
  const a = createDeterministicRandomStreams({ seed: 0x1234 });
  const aMutation = a.get('mutation', 'particle:0');
  const aReproduction = a.get('reproduction', 'particle:0');
  const firstMutation = aMutation.nextUint32();
  const firstReproduction = aReproduction.nextUint32();
  const snapshot = a.snapshot();

  const b = createDeterministicRandomStreams({ seed: 0x1234 });
  const bReproduction = b.get('reproduction', 'particle:0');
  const bMutation = b.get('mutation', 'particle:0');
  assert.equal(bMutation.nextUint32(), firstMutation);
  assert.equal(bReproduction.nextUint32(), firstReproduction);

  const restored = createDeterministicRandomStreams({ seed: 0x1234, snapshot });
  assert.equal(restored.get('mutation', 'particle:0').nextUint32(), aMutation.nextUint32());
  assert.equal(restored.get('reproduction', 'particle:0').nextUint32(), aReproduction.nextUint32());
});
