// VEPA v3 — Core Tests Runner
// Run with: node tests/run.js

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { run } from 'node:test';
import process from 'node:process';

// ── PRNG Tests ──────────────────────────────────────────────────
async function testPRNG() {
  const { default: SplitMix32 } = await import('../src/core/prng.js');

  // Determinism
  const a = new SplitMix32(42);
  const b = new SplitMix32(42);
  for (let i = 0; i < 100; i++) {
    assert.strictEqual(a.nextFloat(), b.nextFloat(), 'PRNG determinism failed');
  }
  console.log('  ✓ PRNG deterministic from same seed');

  // Different seeds
  const c = new SplitMix32(42);
  const d = new SplitMix32(99);
  const same = c.nextFloat() === d.nextFloat();
  assert.ok(!same, 'Different seeds should differ');
  console.log('  ✓ PRNG different seeds differ');

  // Range [0, 1)
  const e = new SplitMix32(123);
  for (let i = 0; i < 1000; i++) {
    const v = e.nextFloat();
    assert.ok(v >= 0 && v < 1, `Value ${v} out of range`);
  }
  console.log('  ✓ PRNG values in [0, 1)');

  // Integer range
  const f = new SplitMix32(456);
  for (let i = 0; i < 100; i++) {
    const v = f.int(5, 10);
    assert.ok(v >= 5 && v <= 10, `Int ${v} out of range`);
  }
  console.log('  ✓ PRNG integers in range');

  // Clone
  const g = new SplitMix32(77);
  for (let i = 0; i < 50; i++) g.nextFloat();
  const h = g.clone();
  assert.strictEqual(g.state, h.state, 'Clone state mismatch');
  for (let i = 0; i < 50; i++) {
    assert.strictEqual(g.nextFloat(), h.nextFloat(), 'Clone sequence mismatch');
  }
  console.log('  ✓ PRNG cloneable');
}

// ── EventBus Tests ──────────────────────────────────────────────
async function testEventBus() {
  const { default: EventBus } = await import('../src/core/eventBus.js');

  // Basic emit/receive
  const bus = new EventBus();
  let received = null;
  bus.on('test', (data) => { received = data; });
  bus.emit('test', { x: 1 });
  assert.deepStrictEqual(received, { x: 1 }, 'Event not received');
  console.log('  ✓ EventBus emit/receive');

  // Unsubscribe
  const bus2 = new EventBus();
  let count = 0;
  const unsub = bus2.on('test', () => { count++; });
  unsub();
  bus2.emit('test', {});
  assert.strictEqual(count, 0, 'Unsubscribe failed');
  console.log('  ✓ EventBus unsubscribe');

  // Once
  const bus3 = new EventBus();
  let onceCount = 0;
  bus3.once('test', () => { onceCount++; });
  bus3.emit('test', {});
  bus3.emit('test', {});
  assert.strictEqual(onceCount, 1, 'Once fired multiple times');
  console.log('  ✓ EventBus once');

  // Error handling
  const bus4 = new EventBus();
  let errCount = 0;
  bus4.on('test', () => { throw new Error('oops'); });
  bus4.on('test', () => { errCount++; });
  bus4.emit('test', {});
  assert.strictEqual(errCount, 1, 'Error broke chain');
  console.log('  ✓ EventBus error isolation');
}

// ── DNA Buffer Tests ────────────────────────────────────────────
async function testDNA() {
  const { default: DnaBuffer } = await import('../src/species/dnaBuffer.js');
  const { DNA_INDEXES } = await import('../src/constants.js');

  const buf = new DnaBuffer();

  // Store and retrieve
  buf.set(0, DNA_INDEXES.FORCE, 0.5);
  assert.ok(Math.abs(buf.get(0, DNA_INDEXES.FORCE) - 0.5) < 0.01, 'DNA get/set mismatch');
  console.log('  ✓ DNA buffer get/set');

  // Clamping
  buf.set(0, DNA_INDEXES.FORCE, 100);
  assert.ok(buf.get(0, DNA_INDEXES.FORCE) <= 1.0, 'DNA clamp max failed');
  buf.set(0, DNA_INDEXES.FORCE, -100);
  assert.ok(buf.get(0, DNA_INDEXES.FORCE) >= -1.0, 'DNA clamp min failed');
  console.log('  ✓ DNA range clamping');

  // Pack/unpack round trip
  const values = [0.0, 0.25, 0.5, 0.75, 1.0, -0.5, 0.33];
  for (const v of values) {
    buf.set(0, DNA_INDEXES.POLARITY, v);
    const rt = buf.get(0, DNA_INDEXES.POLARITY);
    assert.ok(Math.abs(rt - v) < 0.005, `DNA round trip error: ${v} -> ${rt}`);
  }
  console.log('  ✓ DNA pack/unpack precision');

  // Mutation
  buf.set(0, DNA_INDEXES.FORCE, 0.5);
  const before = buf.get(0, DNA_INDEXES.FORCE);
  buf.mutate(0, 1.0, () => 0.75);
  const after = buf.get(0, DNA_INDEXES.FORCE);
  assert.ok(Math.abs(after - before) > 0.01, 'DNA mutation had no effect');
  console.log('  ✓ DNA mutation');

  // Crossover
  buf.set(0, DNA_INDEXES.FORCE, 0.0);
  buf.set(1, DNA_INDEXES.FORCE, 1.0);
  const child = buf.crossover(0, 1, 0, () => 0.5);
  assert.ok(Math.abs(child[DNA_INDEXES.FORCE] - 0.5) < 0.1, 'DNA crossover failed');
  console.log('  ✓ DNA crossover');
}

// ── Spatial Grid Tests ──────────────────────────────────────────
async function testGrid() {
  const { default: SpatialGrid } = await import('../src/physics/spatialGrid.js');
  const { PARTICLE_STRIDE, STRIDE_INDEXES } = await import('../src/constants.js');

  const grid = new SpatialGrid(800);
  const buffer = new Float32Array(10 * PARTICLE_STRIDE);

  // Place all particles in same cell area
  for (let i = 0; i < 10; i++) {
    const base = i * PARTICLE_STRIDE;
    buffer[base + STRIDE_INDEXES.POS_X] = 100 + i * 5;
    buffer[base + STRIDE_INDEXES.POS_Y] = 100 + i * 3;
    buffer[base + STRIDE_INDEXES.POS_Z] = 0;
    grid.insert(i, buffer, PARTICLE_STRIDE);
  }

  const result = grid.getNeighborsForParticle(0, buffer, PARTICLE_STRIDE);
  assert.ok(result.count >= 10, 'Grid query returned only ' + result.count + ' neighbors');
  console.log('  ✓ SpatialGrid insert & query');

  grid.clear();
  const allEmpty = grid._cellCounts.every(c => c === 0);
  assert.ok(allEmpty, 'Grid clear failed');
  console.log('  ✓ SpatialGrid clear');

  // Toroidal wrapping
  const grid2 = new SpatialGrid(800);
  assert.ok(grid2._toCell(-10) >= 0 && grid2._toCell(-10) < 12, 'Toroidal negative failed');
  assert.ok(grid2._toCell(810) >= 0 && grid2._toCell(810) < 12, 'Toroidal overflow failed');
  console.log('  ✓ SpatialGrid toroidal wrapping');
}

// ── Law Manager Tests ───────────────────────────────────────────
async function testLaws() {
  const { default: LawManager } = await import('../src/physics/laws.js');
  const { LAW_INDEXES } = await import('../src/constants.js');

  const lm = new LawManager();

  // Default all on
  assert.ok(lm.isLaw(LAW_INDEXES.GRAV), 'Default law should be on');
  console.log('  ✓ Laws default enabled');

  // Toggle off
  lm.setLaw(LAW_INDEXES.GRAV, false);
  assert.ok(!lm.isLaw(LAW_INDEXES.GRAV), 'Toggle off failed');
  const flags = lm.getFlags();
  assert.ok(!LawManager.isSet(LAW_INDEXES.GRAV, flags.low, flags.high), 'Bitmask not updated');
  console.log('  ✓ Laws toggle off');

  // Toggle back on
  lm.setLaw(LAW_INDEXES.GRAV, true);
  assert.ok(lm.isLaw(LAW_INDEXES.GRAV), 'Toggle on failed');
  console.log('  ✓ Laws toggle on');

  // Multi-state
  lm.setLawState(LAW_INDEXES.WRAP, 2);
  assert.strictEqual(lm.getLawState(LAW_INDEXES.WRAP), 2, 'Multi-state failed');
  console.log('  ✓ Laws multi-state');

  // Get flags static
  lm.setLaw(LAW_INDEXES.GRAV, true);
  lm.setLaw(LAW_INDEXES.COLL, false);
  const f = lm.getFlags();
  assert.ok(LawManager.isSet(LAW_INDEXES.GRAV, f.low, f.high), 'Static isSet GRAV');
  assert.ok(!LawManager.isSet(LAW_INDEXES.COLL, f.low, f.high), 'Static isSet COLL off');
  console.log('  ✓ Laws static isSet');
}

// ── Run All ─────────────────────────────────────────────────────
async function main() {
  console.log('\nVEPA v3 — Core Test Suite\n');

  console.log('PRNG Tests:');
  await testPRNG();

  console.log('\nEventBus Tests:');
  await testEventBus();

  console.log('\nDNA Buffer Tests:');
  await testDNA();

  console.log('\nSpatial Grid Tests:');
  await testGrid();

  console.log('\nLaw Manager Tests:');
  await testLaws();

  console.log('\n✅ All tests passed!');
}

main().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
