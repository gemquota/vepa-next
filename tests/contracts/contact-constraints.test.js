import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveParticleContacts } from '../../src/sim/contact-constraints.js';

const S = { POS_X:0, POS_Y:1, POS_Z:2, MASS:3, DEAD:4, RADIUS:5 };
const stride = 6;
function particles(rows) {
  const data = new Float32Array(rows.length * stride);
  rows.forEach((r,i) => { for (let k=0;k<stride;k++) data[i*stride+k]=r[k] ?? 0; });
  return data;
}
function distance(a,b) { return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]); }
function point(data,i) { const b=i*stride; return [data[b],data[b+1],data[b+2]]; }

test('separates overlapping particles and remains finite', () => {
  const p=particles([[5,5,5,1,0,1],[5.5,5,5,1,0,1]]);
  resolveParticleContacts(p,2,stride,20,false,8,S);
  assert.ok(distance(point(p,0),point(p,1)) >= 1.999);
  assert.ok([...p].every(Number.isFinite));
});

test('uses mass-weighted position correction', () => {
  const p=particles([[5,5,5,9,0,1],[5.5,5,5,1,0,1]]);
  const before=point(p,0);
  resolveParticleContacts(p,2,stride,20,false,8,S);
  const movedHeavy=distance(before,point(p,0));
  const movedLight=distance([5.5,5,5],point(p,1));
  assert.ok(movedHeavy < movedLight);
});

test('handles coincident centres without NaN or Infinity', () => {
  const p=particles([[5,5,5,1,0,1],[5,5,5,1,0,1]]);
  resolveParticleContacts(p,2,stride,20,false,8,S);
  assert.ok([...p].every(Number.isFinite));
  assert.ok(distance(point(p,0),point(p,1)) > 1.9);
});

test('wrap boundary uses shortest periodic separation', () => {
  const p=particles([[0.2,5,5,1,0,0.5],[19.8,5,5,1,0,0.5]]);
  resolveParticleContacts(p,2,stride,20,true,8,S);
  const dx=Math.abs(point(p,0)[0]-point(p,1)[0]);
  assert.ok(Math.min(dx,20-dx) >= 0.999);
});

test('ignores dead and zero-mass particles', () => {
  const p=particles([[5,5,5,1,1,1],[5.1,5,5,1,0,1],[5.2,5,5,0,0,1]]);
  const deadBefore=point(p,0);
  resolveParticleContacts(p,3,stride,20,false,8,S);
  assert.deepEqual(point(p,0),deadBefore);
});

test('rejects invalid buffers and negative radii', () => {
  assert.throws(()=>resolveParticleContacts([],1,stride,20,false,8,S),/Invalid contact resolver/);
  const p=particles([[1,1,1,1,0,-1],[2,2,2,1,0,1]]);
  assert.throws(()=>resolveParticleContacts(p,2,stride,20,false,8,S),/Invalid particle radius/);
});


test('shared grid handles dense same-cell neighborhoods without non-finite state', () => {
  const rows = Array.from({ length: 40 }, (_, i) => [
    8 + (i % 2) * 0.01,
    8 + (i % 3) * 0.01,
    8 + (i % 5) * 0.01,
    1 + (i % 4),
    0,
    0.5,
  ]);
  const p = particles(rows);
  resolveParticleContacts(p, rows.length, stride, 20, false, 8, S);
  assert.ok([...p].every(Number.isFinite));
});
