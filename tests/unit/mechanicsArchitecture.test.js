import { describe, expect, it } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S } from '../../src/constants.js';
import { getPairGeometry } from '../../src/physics/pairGeometry.js';
import { inspectMechanicsPair } from '../../src/physics/mechanicsDiagnostics.js';
import {
  applyContact,
  applyMomentum,
  applyTorque,
  applyFragmentation,
  applyAdhesion,
} from '../../src/physics/lawgroups/mechanicsLaws.js';

function pair({ x0 = 0, x1 = 3, radius = 2, vx0 = 0, vx1 = 0, armor = 0 } = {}) {
  const view = new Float32Array(PARTICLE_STRIDE * 2);
  view[S.POS_X] = x0;
  view[PARTICLE_STRIDE + S.POS_X] = x1;
  view[S.RADIUS] = radius;
  view[PARTICLE_STRIDE + S.RADIUS] = radius;
  view[S.MASS] = 1;
  view[PARTICLE_STRIDE + S.MASS] = 1;
  view[S.VEL_X] = vx0;
  view[PARTICLE_STRIDE + S.VEL_X] = vx1;
  view[S.ARMOR] = armor;
  view[PARTICLE_STRIDE + S.ARMOR] = armor;
  return view;
}

describe('Physics/Mechanics boundary primitives', () => {
  it('computes wrapped pair facts once, including normal and relative motion', () => {
    const view = pair({ x0: 1, x1: 99, radius: 1, vx0: 2, vx1: -1 });
    const facts = getPairGeometry(view, 0, PARTICLE_STRIDE, 100);
    expect(facts.dx).toBe(-2);
    expect(facts.distance).toBe(2);
    expect(facts.normalX).toBe(-1);
    expect(facts.overlap).toBe(0);
    expect(facts.relativeSpeed).toBe(3);
    expect(facts.relativeVelocityAlongNormal).toBe(3);
  });

  it('keeps CONTACT geometric and separate from impact response', () => {
    const view = pair({ x0: 0, x1: 3, radius: 2 });
    const facts = getPairGeometry(view, 0, PARTICLE_STRIDE, 100);
    const contact = applyContact(view, 0, PARTICLE_STRIDE, facts.dx, facts.dy, facts.dz, facts.distance);
    expect(contact).toEqual({ ax: expect.any(Number), ay: expect.any(Number), az: expect.any(Number) });
    expect(contact.ax).toBeLessThan(0);
    expect(view[S.VEL_X]).toBe(0);
  });

  it('does not treat separating relative motion as an impact impulse', () => {
    const view = pair({ x0: 0, x1: 3, radius: 2, vx0: -1, vx1: 1 });
    const facts = getPairGeometry(view, 0, PARTICLE_STRIDE, 100);
    const normalVelocity = facts.relativeVelocityAlongNormal;
    expect(normalVelocity).toBeGreaterThan(0);
    expect(applyMomentum(view, 0, PARTICLE_STRIDE)).toEqual(expect.objectContaining({ ax: expect.any(Number) }));
    expect(applyFragmentation(view, 0, PARTICLE_STRIDE, facts.dx, facts.dy, facts.dz, facts.distance)).toBeNull();
  });

  it('keeps torque tangential and adhesion non-merging', () => {
    const view = pair({ x0: 0, x1: 3, radius: 2, vx0: 0, vx1: 0 });
    view[PARTICLE_STRIDE + S.VEL_Y] = 2;
    const facts = getPairGeometry(view, 0, PARTICLE_STRIDE, 100);
    const torque = applyTorque(view, 0, PARTICLE_STRIDE, facts.dx, facts.dy, facts.dz);
    expect(Math.abs(torque.ax) + Math.abs(torque.ay) + Math.abs(torque.az)).toBeGreaterThan(0);
    expect(applyAdhesion(view, 0, PARTICLE_STRIDE, facts.dx, facts.dy, facts.dz, facts.distance)).not.toBeNull();
    expect(view[S.MASS]).toBe(1);
    expect(view[PARTICLE_STRIDE + S.MASS]).toBe(1);
  });

  it('provides pair diagnostics without mutating the particle buffer', () => {
    const view = pair({ x0: 0, x1: 3, radius: 2, vx0: 4, vx1: 0, armor: 0.5 });
    const before = view.slice();
    const diagnostics = inspectMechanicsPair(view, 0, PARTICLE_STRIDE, 100);
    expect(Array.from(view)).toEqual(Array.from(before));
    expect(diagnostics).toMatchObject({
      distance: 3,
      overlap: 1,
      relativeSpeed: 4,
      contactCorrection: expect.any(Object),
      momentumCorrection: expect.any(Object),
      torqueContribution: expect.any(Object),
      constraintCorrection: expect.any(Object),
      fragmentationThreshold: 3,
    });
    const scalars = [
      diagnostics.distance,
      diagnostics.overlap,
      diagnostics.relativeSpeed,
      diagnostics.fragmentationThreshold,
      diagnostics.contactCorrection.ax,
      diagnostics.contactCorrection.ay,
      diagnostics.contactCorrection.az,
      diagnostics.momentumCorrection.ax,
      diagnostics.momentumCorrection.ay,
      diagnostics.momentumCorrection.az,
      diagnostics.torqueContribution.ax,
      diagnostics.torqueContribution.ay,
      diagnostics.torqueContribution.az,
      diagnostics.constraintCorrection.ax,
      diagnostics.constraintCorrection.ay,
      diagnostics.constraintCorrection.az,
    ];
    expect(scalars.every(Number.isFinite)).toBe(true);
  });
});
