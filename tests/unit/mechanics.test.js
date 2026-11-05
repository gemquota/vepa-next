import { describe, expect, it } from 'vitest';
import { STRIDE_INDEXES as S, PARTICLE_STRIDE } from '../../src/constants.js';
import {
  applyContact,
  applyContactCorrection,
  applyCollisionImpulse,
  applyWrapBoundary,
  wrapCoordinate,
  diagnoseCollisionImpulse,
  diagnoseWrapBoundary,
  diagnoseTopology,
} from '../../src/physics/lawgroups/mechanicsLaws.js';

function pair({ distance = 1, radius = 1, velocity = 1 } = {}) {
  const view = new Float32Array(PARTICLE_STRIDE * 2);
  view[S.POS_X] = 0;
  view[PARTICLE_STRIDE + S.POS_X] = distance;
  view[S.MASS] = 1;
  view[PARTICLE_STRIDE + S.MASS] = 1;
  view[S.RADIUS] = radius;
  view[PARTICLE_STRIDE + S.RADIUS] = radius;
  view[S.VEL_X] = velocity;
  return view;
}

describe('physics/mechanics boundary', () => {
  it('exposes contact as positional correction, not impact response', () => {
    const view = pair({ distance: 1, radius: 1 });
    const correction = applyContactCorrection(view, 0, PARTICLE_STRIDE, 1, 0, 0, 1, 2);
    expect(correction).toMatchObject({ x: -0.5, y: -0, z: -0 });
    expect(applyContact(view, 0, PARTICLE_STRIDE, 1, 0, 0, 1)).toMatchObject({ ax: -0.5 });
    expect(view[S.VEL_X]).toBe(1);
  });

  it('applies COLL only when bodies approach along the contact normal', () => {
    const view = pair({ distance: 2, radius: 1, velocity: 1 });
    const impulse = applyCollisionImpulse(view, 0, PARTICLE_STRIDE, 1, 0, 0, 0.5);
    expect(impulse.ax).toBeLessThan(0);

    view[S.VEL_X] = -1;
    expect(applyCollisionImpulse(view, 0, PARTICLE_STRIDE, 1, 0, 0, 0.5)).toBeNull();
  });

  it('keeps impulse magnitude mass-weighted and bounded by restitution', () => {
    const view = pair({ distance: 2, radius: 1, velocity: 2 });
    view[PARTICLE_STRIDE + S.MASS] = 3;
    const impulse = applyCollisionImpulse(view, 0, PARTICLE_STRIDE, 1, 0, 0, 1);
    expect(impulse.ax).toBeCloseTo(-3);
    expect(impulse.ay).toBeCloseTo(0);
    expect(impulse.az).toBeCloseTo(0);
  });

  it('provides non-mutating diagnostics for COLL, WRAP, and TOPOLOGY', () => {
    const view = pair({ distance: 2, radius: 1, velocity: 2 });
    view[S.BOND_COUNT] = 4;
    view[PARTICLE_STRIDE + S.BOND_COUNT] = 1;
    const before = view.slice();

    const collision = diagnoseCollisionImpulse(view, 0, PARTICLE_STRIDE, 1, 0, 0, 0.5);
    const wrap = diagnoseWrapBoundary({ x: 100, y: 5, z: -1 }, { x: 3, y: 0, z: -2 }, 100, true, 1);
    const topology = diagnoseTopology(view, 0, PARTICLE_STRIDE, 1, 0, 0, 2);

    expect(collision.approaching).toBe(true);
    expect(collision.impulse.x).toBeLessThan(0);
    expect(wrap.toroidal).toEqual({ x: 0, y: 5, z: 99 });
    expect(wrap.walls.position.z).toBe(0);
    expect(topology.bondImbalance).toBe(3);
    expect(topology.correction.ax).toBeCloseTo(0.015);
    expect(view).toEqual(before);
    expect(Object.isFrozen(collision)).toBe(true);
    expect(Object.isFrozen(wrap)).toBe(true);
    expect(Object.isFrozen(topology)).toBe(true);
  });
});

/* ── WRAP ────────────────────────────────────────────────────────────── */

describe('WRAP — the boundary rule that replaced the dead INERTIA toggle', () => {
  const SIZE = 100;

  it('folds every axis back into the world when the law is on', () => {
    const out = applyWrapBoundary(
      { x: 100, y: -1, z: 250 },
      { x: 3, y: -2, z: 1 },
      SIZE,
      true,
    );
    expect(out.mode).toBe('toroidal');
    expect(out.position).toEqual({ x: 0, y: 99, z: 50 });
    // Toroidal wrapping never touches velocity.
    expect(out.velocity).toEqual({ x: 3, y: -2, z: 1 });
    expect(wrapCoordinate(-1, SIZE)).toBe(99);
  });

  it('clamps and reflects when the law is off, honouring WALL REFLECT', () => {
    const absorb = applyWrapBoundary({ x: -5, y: 150, z: 50 }, { x: -4, y: 4, z: 0 }, SIZE, false, 0);
    expect(absorb.mode).toBe('walls');
    expect(absorb.position.x).toBe(0);
    expect(absorb.velocity.x).toBe(0);        // 0 = fully absorbing
    expect(absorb.position.y).toBe(SIZE - 0.01);
    expect(absorb.velocity.y).toBeCloseTo(0);  // 0 absorbs every face, not just one

    const bounce = applyWrapBoundary({ x: -5, y: 0, z: 0 }, { x: -4, y: 0, z: 0 }, SIZE, false, 1);
    expect(bounce.velocity.x).toBe(4);

    const superBounce = applyWrapBoundary({ x: 150, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, SIZE, false, 2);
    expect(superBounce.velocity.x).toBe(-8);
  });

  it('leaves an in-bounds particle alone in both modes', () => {
    for (const wrap of [true, false]) {
      const out = applyWrapBoundary({ x: 10, y: 20, z: 30 }, { x: 1, y: 2, z: 3 }, SIZE, wrap);
      expect(out.position).toEqual({ x: 10, y: 20, z: 30 });
      expect(out.velocity).toEqual({ x: 1, y: 2, z: 3 });
      if (!wrap) expect(out.touched).toEqual([]);
    }
  });
});
