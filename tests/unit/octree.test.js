import { describe, it, expect, afterEach } from 'vitest';
import {
  createOctree,
  buildOctree,
  octreeGravity,
} from '../../src/physics/octree.js';
import { solve } from '../../src/physics/solver.js';
import { createLawState, set as lawSet } from '../../src/state/lawState.js';
import { LAW_INDEXES } from '../../src/constants.js';
import { runtimeConfig } from '../../src/state/runtimeConfig.js';
import { SplitMix32 } from '../../src/core/prng.js';

const STRIDE = 100;
const WS = 200;

function makeCloud(N, seed = 12345) {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const buf = new Float32Array(N * STRIDE);
  for (let i = 0; i < N; i++) {
    const b = i * STRIDE;
    buf[b + 0] = rnd() * WS; // POS_X
    buf[b + 1] = rnd() * WS;
    buf[b + 2] = rnd() * WS;
    buf[b + 6] = 0.5 + rnd() * 2; // MASS
  }
  return buf;
}

/** Brute-force min-image softened gravity — reference implementation. */
function bruteForce(buf, N, px, py, pz, G, self) {
  const SOFT = 0.5;
  let ax = 0, ay = 0, az = 0;
  for (let j = 0; j < N; j++) {
    if (j === self) continue;
    const b = j * STRIDE;
    let rx = px - buf[b], ry = py - buf[b + 1], rz = pz - buf[b + 2];
    const h = WS / 2;
    if (rx > h) rx -= WS; else if (rx < -h) rx += WS;
    if (ry > h) ry -= WS; else if (ry < -h) ry += WS;
    if (rz > h) rz -= WS; else if (rz < -h) rz += WS;
    const inv = 1 / Math.sqrt(rx * rx + ry * ry + rz * rz + SOFT);
    const f = G * buf[b + 6] * inv * inv * inv;
    ax -= f * rx; ay -= f * ry; az -= f * rz;
  }
  return [ax, ay, az];
}

describe('octree', () => {
  const N = 600;
  const buf = makeCloud(N);

  it('is exact at theta = 0 (matches brute force)', () => {
    const tree = createOctree(N);
    buildOctree(tree, buf, STRIDE, N, WS);
    const out = { ax: 0, ay: 0, az: 0 };
    for (let t = 0; t < 20; t++) {
      const i = (t * 31) % N, b = i * STRIDE;
      octreeGravity(tree, buf[b], buf[b + 1], buf[b + 2], 1, 0, out, i);
      const [bx, by, bz] = bruteForce(buf, N, buf[b], buf[b + 1], buf[b + 2], 1, i);
      expect(Math.abs(out.ax - bx)).toBeLessThan(1e-5);
      expect(Math.abs(out.ay - by)).toBeLessThan(1e-5);
      expect(Math.abs(out.az - bz)).toBeLessThan(1e-5);
    }
  });

  it('converges with the opening angle (~theta^2 error scaling)', () => {
    const tree = createOctree(N);
    buildOctree(tree, buf, STRIDE, N, WS);
    const out = { ax: 0, ay: 0, az: 0 };
    const rmsAt = (theta) => {
      let err2 = 0, f2 = 0;
      for (let i = 0; i < N; i++) {
        const b = i * STRIDE;
        octreeGravity(tree, buf[b], buf[b + 1], buf[b + 2], 1, theta, out, i);
        const [bx, by, bz] = bruteForce(buf, N, buf[b], buf[b + 1], buf[b + 2], 1, i);
        err2 += (out.ax - bx) ** 2 + (out.ay - by) ** 2 + (out.az - bz) ** 2;
        f2 += bx * bx + by * by + bz * bz;
      }
      return Math.sqrt(err2 / f2);
    };
    const tight = rmsAt(0.05);
    const loose = rmsAt(0.7);
    expect(tight).toBeLessThan(0.01);   // < 1%
    expect(loose).toBeGreaterThan(tight * 2); // error grows with theta
    expect(loose).toBeLessThan(0.35);   // bounded even at coarse opening
  });

  it('is deterministic for identical inputs', () => {
    const tree = createOctree(N);
    buildOctree(tree, buf, STRIDE, N, WS);
    const o1 = { ax: 0, ay: 0, az: 0 }, o2 = { ax: 0, ay: 0, az: 0 };
    octreeGravity(tree, buf[0], buf[1], buf[2], 1, 0.7, o1, 0);
    octreeGravity(tree, buf[0], buf[1], buf[2], 1, 0.7, o2, 0);
    expect(o1.ax).toBe(o2.ax);
    expect(o1.ay).toBe(o2.ay);
    expect(o1.az).toBe(o2.az);
  });

  it('never produces non-finite accelerations', () => {
    const tree = createOctree(N);
    buildOctree(tree, buf, STRIDE, N, WS);
    const out = { ax: 0, ay: 0, az: 0 };
    for (let i = 0; i < N; i++) {
      const b = i * STRIDE;
      octreeGravity(tree, buf[b], buf[b + 1], buf[b + 2], 1, 0.9, out, i);
      expect(Number.isFinite(out.ax)).toBe(true);
      expect(Number.isFinite(out.ay)).toBe(true);
      expect(Number.isFinite(out.az)).toBe(true);
    }
  });
});

describe('solver GRAV_ENGINE=bh', () => {
  afterEach(() => {
    runtimeConfig.gravEngine = 'exact';
  });

  function runTicks(engine, ticks = 3) {
    runtimeConfig.gravEngine = engine;
    const N = 400;
    const buf = makeCloud(N, 999);
    const law = createLawState();
    lawSet(law, LAW_INDEXES.GRAV);
    const prng = new SplitMix32(42);
    for (let t = 0; t < ticks; t++) solve(buf, N, STRIDE, law, null, WS, 1, prng);
    return buf;
  }

  it('moves particles similarly to the exact engine and stays finite', () => {
    const exact = runTicks('exact');
    const bh = runTicks('bh');
    let sumExact = 0, sumBh = 0;
    for (let i = 0; i < 400; i++) {
      const b = i * STRIDE;
      for (let k = 0; k < 6; k++) {
        expect(Number.isFinite(bh[b + k])).toBe(true);
      }
      sumExact += Math.hypot(exact[b + 3], exact[b + 4], exact[b + 5]);
      sumBh += Math.hypot(bh[b + 3], bh[b + 4], bh[b + 5]);
    }
    // BH population should have comparable kinetic energy scale to exact
    const ratio = sumBh / sumExact;
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(5);
  });
});
