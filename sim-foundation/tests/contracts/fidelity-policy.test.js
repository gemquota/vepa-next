import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePhysicsFidelityPolicy, describeComputeBackend } from '../../src/sim/fidelity-policy.js';

test('configured mode preserves the configured interaction cap', () => {
  const policy = resolvePhysicsFidelityPolicy({
    mode: 'configured', population: 100_000, configuredMaxInteractions: 500,
    pairwiseBudget: 96, targetFps: 60,
  });
  assert.equal(policy.effectiveMaxInteractions, 500);
  assert.equal(policy.semanticsChangedByPolicy, false);
});

test('adaptive mode reports when it reduces authoritative interaction work', () => {
  const policy = resolvePhysicsFidelityPolicy({
    mode: 'adaptive', population: 100_000, configuredMaxInteractions: 500,
    pairwiseBudget: 96, targetFps: 60,
  });
  assert.ok(policy.effectiveMaxInteractions < policy.configuredMaxInteractions);
  assert.equal(policy.semanticsChangedByPolicy, true);
  assert.equal(policy.targetFps, 60);
});

test('policy makes quality inputs explicit and clamps target FPS', () => {
  const policy = resolvePhysicsFidelityPolicy({
    mode: 'adaptive', population: 0, targetFps: 120,
  });
  assert.equal(policy.targetFps, 60);
  assert.equal(policy.population, 0);
  assert.ok(Object.isFrozen(policy));
});

test('invalid or implicit mode values are rejected', () => {
  assert.throws(() => resolvePhysicsFidelityPolicy({ population: 10, mode: 'automatic' }), /mode/);
  assert.throws(() => resolvePhysicsFidelityPolicy({ population: -1 }), /population/);
  assert.throws(() => resolvePhysicsFidelityPolicy({ population: 10, gravityEngine: 'magic' }), /gravityEngine/);
});

test('backend availability is distinct from initialization and active passes', () => {
  const report = describeComputeBackend({
    backend: 'webgpu', available: true, initialized: true,
    activePasses: ['gravity'], fallbackReason: null,
  });
  assert.equal(report.available, true);
  assert.equal(report.initialized, true);
  assert.equal(report.active, true);
  assert.equal(report.scope, 'listed passes only');
});

test('backend fallback does not falsely report an active GPU pass', () => {
  const report = describeComputeBackend({
    backend: 'webgpu', available: true, initialized: false,
    activePasses: [], fallbackReason: 'device-lost',
  });
  assert.equal(report.available, true);
  assert.equal(report.active, false);
  assert.equal(report.fallbackReason, 'device-lost');
});
