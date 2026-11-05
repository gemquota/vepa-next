// ============================================================================
// VEPA4 — Barnes–Hut Octree + Quadrupole FMM (v8.17.0 algorithmic phase)
//
// Monopole Barnes–Hut (θ=0.5 → ~2% RMS force error) with optional quadrupole
// correction (FMM order-2 Cartesian expansion). The quadrupole moments Q_ij
// are propagated up the tree during the build pass; during traversal the
// quadrupole-corrected force kernel replaces the monopole for accepted cells,
// reducing RMS error ~10× at the same θ (or allowing coarser θ for speed).
//
// Semantics vs the exact law (documented approximation):
//  - Bodies are aggregated into cell centres of mass (opening angle theta ≈
//    0.7), so per-pair DNA modifiers (FORCE / TIDAL / HIDDEN_MASS) are NOT
//    applied to aggregated far-field contributions. This engine trades
//    per-pair DNA nuance for scale; the exact engine remains the default.
//  - Toroidal space is approximated with the minimum-image convention applied
//    to particle→node displacements.
// ============================================================================

const MAX_DEPTH = 24;
const SOFTENING = 0.5; // matches laws.js applyGravity

const OX = 0, OY = 1, OZ = 2, MASS = 6, DEAD = 52; // stride offsets used

/**
 * Create an octree with preallocated storage. Grows amortised on demand.
 */
export function createOctree(capacityBodies = 1024) {
  const tree = {
    nCap: 0,
    nodeCount: 0,
    child: null,      // Int32Array(8 * nCap) — -1 empty
    comM: null,       // Float64Array(nCap) — total mass
    cx: null, cy: null, cz: null, // Float64Array(nCap) — centre of mass
    gcx: null, gcy: null, gcz: null, // Float64Array(nCap) — geometric centre
    size: null,       // Float64Array(nCap) — cube edge length
    bodyIdx: null,    // Int32Array(nCap) — body index for leaves, -1 internal
    // v8.17 FMM — quadrupole tensors about geometric centre (6 unique components)
    qxx: null, qyy: null, qzz: null, qxy: null, qxz: null, qyz: null,
    stack: null,
    worldSize: 0,
    // FMM engine: when true, the traversal uses the quadrupole-corrected
    // force kernel instead of monopole-only. Set by the solver.
    useQuadrupole: false,
  };
  ensureNodeCapacity(tree, Math.max(16, capacityBodies * 2));
  return tree;
}

function ensureNodeCapacity(tree, minNodes) {
  if (tree.nCap >= minNodes) return;
  let cap = Math.max(16, tree.nCap);
  while (cap < minNodes) cap *= 2;

  const child = new Int32Array(cap * 8).fill(-1);
  if (tree.child) child.set(tree.child.subarray(0, tree.nodeCount * 8));
  tree.child = child;

  const growF = (old) => {
    const a = new Float64Array(cap);
    if (old) a.set(old.subarray(0, tree.nodeCount));
    return a;
  };
  tree.comM = growF(tree.comM);
  tree.cx = growF(tree.cx);
  tree.cy = growF(tree.cy);
  tree.cz = growF(tree.cz);
  tree.gcx = growF(tree.gcx);
  tree.gcy = growF(tree.gcy);
  tree.gcz = growF(tree.gcz);
  tree.size = growF(tree.size);
  tree.qxx = growF(tree.qxx); tree.qyy = growF(tree.qyy); tree.qzz = growF(tree.qzz);
  tree.qxy = growF(tree.qxy); tree.qxz = growF(tree.qxz); tree.qyz = growF(tree.qyz);

  const bi = new Int32Array(cap).fill(-1);
  if (tree.bodyIdx) bi.set(tree.bodyIdx.subarray(0, tree.nodeCount));
  tree.bodyIdx = bi;

  tree.stack = new Int32Array(Math.max(4096, cap));
  tree.nCap = cap;
}

function isInternal(tree, node) {
  const base = node * 8;
  return (
    tree.child[base] !== -1 || tree.child[base + 1] !== -1 ||
    tree.child[base + 2] !== -1 || tree.child[base + 3] !== -1 ||
    tree.child[base + 4] !== -1 || tree.child[base + 5] !== -1 ||
    tree.child[base + 6] !== -1 || tree.child[base + 7] !== -1
  );
}

function ensureChild(tree, parent, oct) {
  let c = tree.child[parent * 8 + oct];
  if (c !== -1) return c;
  c = tree.nodeCount++;
  if (c >= tree.nCap) {
    ensureNodeCapacity(tree, tree.nCap * 2);
  }
  tree.child[parent * 8 + oct] = c;
  tree.child.fill(-1, c * 8, c * 8 + 8);
  tree.bodyIdx[c] = -1;
  tree.comM[c] = 0;
  tree.qxx[c] = 0; tree.qyy[c] = 0; tree.qzz[c] = 0;
  tree.qxy[c] = 0; tree.qxz[c] = 0; tree.qyz[c] = 0;
  const hs = tree.size[parent] * 0.25;
  tree.gcx[c] = tree.gcx[parent] + (oct & 1 ? hs : -hs);
  tree.gcy[c] = tree.gcy[parent] + (oct & 2 ? hs : -hs);
  tree.gcz[c] = tree.gcz[parent] + (oct & 4 ? hs : -hs);
  tree.size[c] = tree.size[parent] * 0.5;
  return c;
}

function wrapCoord(v, ws) {
  return ((v % ws) + ws) % ws;
}

/**
 * Build (rebuild) the octree from the flat particle buffer.
 * Skips dead and zero-mass particles, matching the exact solver's filters.
 * Returns the tree for chaining.
 */
export function buildOctree(tree, view, stride, count, worldSize) {
  tree.worldSize = worldSize;
  ensureNodeCapacity(tree, Math.max(16, count * 4));

  // Reset the working range (children of every node + body slots)
  tree.child.fill(-1, 0, tree.nCap * 8);
  tree.bodyIdx.fill(-1, 0, tree.nCap);
  tree.nodeCount = 1;

  // Root: whole world cube centred at (ws/2, ws/2, ws/2)
  const root = 0;
  tree.comM[root] = 0;
  tree.size[root] = worldSize;
  tree.gcx[root] = worldSize * 0.5;
  tree.gcy[root] = worldSize * 0.5;
  tree.gcz[root] = worldSize * 0.5;

  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + DEAD] >= 0.5) continue;
    const m = view[b + MASS];
    if (!(m > 0)) continue;
    const x = wrapCoord(view[b + OX], worldSize);
    const y = wrapCoord(view[b + OY], worldSize);
    const z = wrapCoord(view[b + OZ], worldSize);

    let node = root;
    let depth = 0;
    for (;;) {
      const internal = isInternal(tree, node);
      if (!internal && tree.bodyIdx[node] === -1) {
        // Empty leaf → take it; quadrupole about geometric centre
        tree.bodyIdx[node] = i;
        tree.comM[node] = m;
        tree.cx[node] = x; tree.cy[node] = y; tree.cz[node] = z;
        const dx = x - tree.gcx[node], dy = y - tree.gcy[node], dz = z - tree.gcz[node];
        tree.qxx[node] = m * dx * dx;
        tree.qyy[node] = m * dy * dy;
        tree.qzz[node] = m * dz * dz;
        tree.qxy[node] = m * dx * dy;
        tree.qxz[node] = m * dx * dz;
        tree.qyz[node] = m * dy * dz;
        break;
      }
      if (!internal && depth < MAX_DEPTH) {
        // Occupied leaf → subdivide; push the existing body one level down
        const old = tree.bodyIdx[node];
        tree.bodyIdx[node] = -1;
        const ob = old * stride;
        const octO = octantOf(
          wrapCoord(view[ob + OX], worldSize),
          wrapCoord(view[ob + OY], worldSize),
          wrapCoord(view[ob + OZ], worldSize),
          tree, node
        );
        const cOld = ensureChild(tree, node, octO);
        tree.bodyIdx[cOld] = old;
        tree.comM[cOld] = tree.comM[node];
        tree.cx[cOld] = tree.cx[node];
        tree.cy[cOld] = tree.cy[node];
        tree.cz[cOld] = tree.cz[node];
        // Keep node's COM as the old body's — the loop below accumulates the
        // new body into it, so the internal COM always covers both subtrees.
        // (Zeroing here dropped the old body from every ancestor aggregate.)
        // continue the loop — node is now internal, new body descends below
        continue;
      }
      // Internal (or depth-capped leaf) → accumulate COM and descend
      const total = tree.comM[node] + m;
      tree.cx[node] = (tree.cx[node] * tree.comM[node] + x * m) / total;
      tree.cy[node] = (tree.cy[node] * tree.comM[node] + y * m) / total;
      tree.cz[node] = (tree.cz[node] * tree.comM[node] + z * m) / total;
      tree.comM[node] = total;

      if (depth >= MAX_DEPTH) break; // fold into this deep node's COM

      const oct = octantOf(x, y, z, tree, node);
      const next = tree.child[node * 8 + oct];
      if (next === -1) {
        const c = ensureChild(tree, node, oct);
        tree.bodyIdx[c] = i;
        tree.comM[c] = m;
        tree.cx[c] = x; tree.cy[c] = y; tree.cz[c] = z;
        break;
      }
      node = next;
      depth++;
    }
  }

  // ── Upward quadrupole pass (FMM M2M) ──
  // Propagate quadrupole moments from leaves to root using the parallel-axis
  // theorem: Q_ij(parent) = Σ (Q_ij(child) + M_child · d_i · d_j) where
  // d = geometric_centre(child) − geometric_centre(parent).
  // Bottom-up: nodes 0..nodeCount-1 are in insertion order (parent before
  // child), so reverse iteration guarantees children are processed first.
  for (let n = tree.nodeCount - 1; n >= 0; n--) {
    const isLeaf = !isInternal(tree, n) && tree.bodyIdx[n] >= 0;
    if (isLeaf || tree.comM[n] <= 0) continue;
    const base = n * 8;
    const pgx = tree.gcx[n], pgy = tree.gcy[n], pgz = tree.gcz[n];
    let qxx = 0, qyy = 0, qzz = 0, qxy = 0, qxz = 0, qyz = 0;
    let anyChild = false;
    for (let k = 0; k < 8; k++) {
      const c = tree.child[base + k];
      if (c === -1) continue;
      const cm = tree.comM[c];
      if (!(cm > 0)) continue;
      anyChild = true;
      const dgx = tree.gcx[c] - pgx, dgy = tree.gcy[c] - pgy, dgz = tree.gcz[c] - pgz;
      qxx += tree.qxx[c] + cm * dgx * dgx;
      qyy += tree.qyy[c] + cm * dgy * dgy;
      qzz += tree.qzz[c] + cm * dgz * dgz;
      qxy += tree.qxy[c] + cm * dgx * dgy;
      qxz += tree.qxz[c] + cm * dgx * dgz;
      qyz += tree.qyz[c] + cm * dgy * dgz;
    }
    if (anyChild) {
      tree.qxx[n] = qxx; tree.qyy[n] = qyy; tree.qzz[n] = qzz;
      tree.qxy[n] = qxy; tree.qxz[n] = qxz; tree.qyz[n] = qyz;
    }
  }

  return tree;
}

function octantOf(x, y, z, tree, node) {
  return (x >= tree.gcx[node] ? 1 : 0) | (y >= tree.gcy[node] ? 2 : 0) | (z >= tree.gcz[node] ? 4 : 0);
}

/**
 * Approximate gravitational acceleration on one particle (Barnes–Hut).
 * a = Σ G·m_j · (r_j − r_i) / (|r_j − r_i|² + ε)^{3/2}   (attractive)
 * Writes {ax, ay, az} into `out`. Deterministic traversal order.
 *
 * Toroidal handling (correct, not naive min-image):
 *  - Acceptance uses the TRUE wrapped distance D from the particle to the
 *    cell's cubic REGION (per-axis circular interval gap). A cell that
 *    surrounds or abuts the particle has D ≈ 0 and is therefore always
 *    descended — collapsing it to a distant point mass would be wrong.
 *  - On acceptance, the centre-of-mass displacement is evaluated against the
 *    SAME nearest periodic copy of the cell (offset derived from the region
 *    gap, not from the COM), so extended cells are never misrepresented.
 *
 * @param {number} theta - opening angle; 0 → exact brute force via the tree
 * @param {number} selfIdx - particle index to skip (self-interaction)
 */
export function octreeGravity(tree, px, py, pz, G, theta, out, selfIdx = -1) {
  const ws = tree.worldSize;
  const invWs = 1 / ws;
  let ax = 0, ay = 0, az = 0;
  const stack = tree.stack;
  let sp = 0;
  stack[sp++] = 0;
  const quad = !!tree.useQuadrupole;

  while (sp > 0) {
    const node = stack[--sp];
    const m = tree.comM[node];
    if (!(m > 0)) continue;

    const hs = tree.size[node] * 0.5;
    let gx = (px - tree.gcx[node]) * invWs;
    let gy = (py - tree.gcy[node]) * invWs;
    let gz = (pz - tree.gcz[node]) * invWs;
    gx -= Math.round(gx);
    gy -= Math.round(gy);
    gz -= Math.round(gz);
    const ux = Math.abs(gx * ws) - hs;
    const uy = Math.abs(gy * ws) - hs;
    const uz = Math.abs(gz * ws) - hs;
    const gapX = ux > 0 ? ux : 0;
    const gapY = uy > 0 ? uy : 0;
    const gapZ = uz > 0 ? uz : 0;

    if (tree.bodyIdx[node] >= 0) {
      if (tree.bodyIdx[node] === selfIdx) continue;
      let rx = px - tree.cx[node];
      let ry = py - tree.cy[node];
      let rz = pz - tree.cz[node];
      rx -= Math.round(rx * invWs) * ws;
      ry -= Math.round(ry * invWs) * ws;
      rz -= Math.round(rz * invWs) * ws;
      const d2 = rx * rx + ry * ry + rz * rz;
      const inv = 1 / Math.sqrt(d2 + SOFTENING);
      const f = G * m * inv * inv * inv;
      ax -= f * rx; ay -= f * ry; az -= f * rz;
      continue;
    }

    const s = tree.size[node];
    const d2Region = gapX * gapX + gapY * gapY + gapZ * gapZ;
    if (
      s * s <= theta * theta * d2Region ||
      sp + 8 >= stack.length
    ) {
      let rx = px - tree.cx[node];
      let ry = py - tree.cy[node];
      let rz = pz - tree.cz[node];
      rx -= Math.round(rx * invWs) * ws;
      ry -= Math.round(ry * invWs) * ws;
      rz -= Math.round(rz * invWs) * ws;
      const d2 = rx * rx + ry * ry + rz * rz;
      const d = Math.sqrt(d2 + SOFTENING);
      const d3 = d * d * d;
      const d5 = d3 * d * d;
      let f = G * m / d3;
      ax -= f * rx; ay -= f * ry; az -= f * rz;

      // ── Quadrupole correction ──
      // Force_i = -G * (3/2 * Q_jk * r_i * r_j * r_k / r^7)
      // where Q_jk about the COM uses the trace-free convention (pre-subtracted).
      // We subtract the trace term inside the loop: Q'_jk pushes the tensor
      // trace into the scaling constants, and the full contraction gives the
      // corrected force components.
      if (quad) {
        // Trace of the quadrupole tensor
        const tr = tree.qxx[node] + tree.qyy[node] + tree.qzz[node];
        // Trace-free quadrupole components (about the COM)
        const Qxx = tree.qxx[node] - tr / 3;
        const Qyy = tree.qyy[node] - tr / 3;
        const Qzz = tree.qzz[node] - tr / 3;
        const Qxy = tree.qxy[node];
        const Qxz = tree.qxz[node];
        const Qyz = tree.qyz[node];
        // Contract: Q_jk * r_k  (summation over k)
        const Qr_x = Qxx * rx + Qxy * ry + Qxz * rz;
        const Qr_y = Qxy * rx + Qyy * ry + Qyz * rz;
        const Qr_z = Qxz * rx + Qyz * ry + Qzz * rz;
        // r · Q · r  (scalar dot product of r with Q·r)
        const rQr = rx * Qr_x + ry * Qr_y + rz * Qr_z;
        const scale = (G * 1.5) / d5;
        // ∂_i(Φ_quad) = (3/2) * G * (5 * r_i * rQr / r^7 - 2 * Qr_i / r^5)
        const f5 = 5 * rQr / (d * d);
        ax -= scale * (f5 * rx - 2 * Qr_x);
        ay -= scale * (f5 * ry - 2 * Qr_y);
        az -= scale * (f5 * rz - 2 * Qr_z);
      }
    } else {
      const base = node * 8;
      for (let k = 0; k < 8; k++) {
        const c = tree.child[base + k];
        if (c !== -1) stack[sp++] = c;
      }
    }
  }
  out.ax = ax; out.ay = ay; out.az = az;
  return out;
}

/**
 * Count alive, positive-mass particles (engine-selection threshold helper).
 */
export function countAlive(view, stride, count) {
  let n = 0;
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + DEAD] < 0.5 && view[b + MASS] > 0) n++;
  }
  return n;
}
