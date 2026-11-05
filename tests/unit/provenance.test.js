import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateProvenance } from '../../scripts/validate-provenance.mjs';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S, WORLD_SIZE } from '../../src/constants.js';
import { getPairGeometry } from '../../src/physics/pairGeometry.js';
import {
  applyCollisionImpulse,
  applyContact,
} from '../../src/physics/lawgroups/mechanicsLaws.js';

function makePair() {
  const view = new Float32Array(PARTICLE_STRIDE * 2);
  view[S.POS_X] = 1;
  view[PARTICLE_STRIDE + S.POS_X] = WORLD_SIZE - 1;
  view[S.MASS] = 2;
  view[PARTICLE_STRIDE + S.MASS] = 3;
  view[S.RADIUS] = 1;
  view[PARTICLE_STRIDE + S.RADIUS] = 1;
  view[S.VEL_X] = 2;
  view[PARTICLE_STRIDE + S.VEL_X] = 0;
  return view;
}

describe('repository provenance contracts', () => {
  it('validates the audit and export manifests without external credentials', () => {
    expect(validateProvenance()).toEqual([]);
  });

  it('records explicit evidence boundaries in both manifests', () => {
    const audit = JSON.parse(readFileSync('docs/audit/provenance.json', 'utf8'));
    const exports = JSON.parse(readFileSync('exports/provenance.json', 'utf8'));
    expect(audit.authority).toContain('executable tests');
    // H3 reconciliation (2026-09-30) resolved the previously-unmapped export:
    // no live record may be left in 'provenance-review-required' state, and
    // every retired artifact must carry an explicit recovery boundary.
    expect(exports.records.some((record) => record.status === 'provenance-review-required')).toBe(false);
    expect(Array.isArray(exports.retired)).toBe(true);
    expect(exports.retired.length).toBeGreaterThan(0);
    for (const entry of exports.retired) {
      expect(entry.status).toBe('retired-2026-09-30');
      expect(entry.recoverableFrom).toMatch(/git history/i);
    }
    expect(readFileSync('src/physics/lawgroups/SPEC.md', 'utf8')).toContain('Lawgroup Implementation Contract');
  });
});

describe('mechanics conservation and non-redundancy scaffolding', () => {
  it('preserves equal-and-opposite collision response in the pair fixture', () => {
    const view = makePair();
    const first = applyCollisionImpulse(view, 0, PARTICLE_STRIDE, 1, 0, 0, 0.5);
    const second = applyCollisionImpulse(view, PARTICLE_STRIDE, 0, -1, 0, 0, 0.5);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(2 * first.ax + 3 * second.ax).toBeCloseTo(0);
    expect(2 * first.ay + 3 * second.ay).toBeCloseTo(0);
    expect(2 * first.az + 3 * second.az).toBeCloseTo(0);
  });

  it('keeps toroidal pair geometry antisymmetric', () => {
    const view = makePair();
    const forward = getPairGeometry(view, 0, PARTICLE_STRIDE, WORLD_SIZE);
    const reverse = getPairGeometry(view, PARTICLE_STRIDE, 0, WORLD_SIZE);
    expect(forward.dx).toBeCloseTo(-reverse.dx);
    expect(forward.dy).toBeCloseTo(-reverse.dy);
    expect(forward.dz).toBeCloseTo(-reverse.dz);
    expect(forward.distance).toBeCloseTo(reverse.distance);
  });

  it('keeps CONTACT geometric correction distinct from COLL impulse', () => {
    const view = makePair();
    const before = view.slice();
    const contact = applyContact(view, 0, PARTICLE_STRIDE, -1, 0, 0, 1);
    const collision = applyCollisionImpulse(view, 0, PARTICLE_STRIDE, 1, 0, 0, 0.5);
    expect(contact).toHaveProperty('ax');
    expect(collision).not.toBeNull();
    expect(contact.ax).not.toBe(collision.ax);
    expect(view).toEqual(before);
  });
});
