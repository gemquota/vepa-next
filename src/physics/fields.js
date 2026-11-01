// ============================================================================
// VEPA4 — Field System (v8.2.0, Set E.1 "Matter & Medium")
//
// The dish is more than a box: a coarse 3D field grid (12³–24³ cells) holds
// named vector fields (WIND, EM), scalar fields (THERMAL, INFO), an
// impassable-wall flag grid, deterministic gravity wells, and paired portals.
//
//   Fields   — coarse grids advanced every tick: scalar diffusion + decay,
//              gentle vector circulation, and generalized advection (vector
//              fields carry scalar fields). Particles feel gradient forces.
//   Walls    — IMPASSABLE cell flags (presets: none / border / ring / cross);
//              velocity-only reflect response, gated by the COLL law.
//   Wells    — deterministic radial attractors (gravity-well regions).
//   Portals  — paired cells that teleport matter across the dish.
//
// Unified write API: writeField(system, name, x, y, z, delta) — the single
// entry point for laws, groups (Set F constructions) and player tools.
//
// The system is a module singleton like the spatial grid: ensureFields() on
// every solve, rebuilt only when its structural config (world size, grid dim,
// wall/well/portal layout) changes. All placement is deterministic — no PRNG.
// ============================================================================

const SCALARS = ['THERMAL', 'INFO', 'EXOTIC', 'CURVATURE'];
const VECTORS = ['WIND', 'EM'];

let _system = null;
let _fingerprint = '';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function idx(dim, x, y, z) {
  return (z * dim + y) * dim + x;
}

/**
 * Grid resolution: user-set FIELD_GRID_DIM (12–24) wins; 0 = auto-scaled to
 * world size (clamped 12–24) so cell volume stays roughly constant.
 */
export function gridDimFor(worldSize, params = {}) {
  const set = Number(params.FIELD_GRID_DIM) || 0;
  if (set > 0) return clamp(Math.round(set), 12, 24);
  return clamp(Math.round(worldSize / 125), 12, 24);
}

/** True when any field feature is switched on via world params. */
export function fieldsEnabled(params = {}) {
  return (Number.isFinite(params.FIELD_WIND) && params.FIELD_WIND > 0)
    || (Number.isFinite(params.FIELD_THERMAL) && params.FIELD_THERMAL > 0)
    || (Number.isFinite(params.FIELD_EM) && params.FIELD_EM > 0)
    || (Number.isFinite(params.FIELD_INFO) && params.FIELD_INFO > 0)
    || (Math.round(params.PORTAL_COUNT || 0) > 0)
    || (Math.round(params.WALLS_PRESET || 0) > 0)
    || (Number.isFinite(params.WELL_STRENGTH) && params.WELL_STRENGTH > 0 && Math.round(params.WELL_COUNT || 0) > 0);
}

/** Build a fresh field system (grids, walls, wells, portals) for a world. */
export function createFieldSystem(worldSize, dim, params = {}) {
  const cell = worldSize / dim;
  const cells = dim * dim * dim;
  const system = {
    worldSize,
    dim,
    cell,
    cells,
    scalars: {
      THERMAL: new Float32Array(cells),
      INFO: new Float32Array(cells),
      EXOTIC: new Float32Array(cells), // Set L.1 — exotic zone kind (1-4) or 0
      CURVATURE: new Float32Array(cells), // Set M.1 — mass-warped spacetime curvature
    },
    vectors: {
      WIND: new Float32Array(cells * 3),
      EM: new Float32Array(cells * 3),
    },
    walls: new Uint8Array(cells),
    hasWalls: false,
    wells: [],
    portals: [],
    scratch: new Float32Array(cells),
    acc: new Float32Array(cells),
  };

  const wallsPreset = Math.round(params.WALLS_PRESET || 0);
  const wallThickness = Math.max(1, Math.round(params.WALL_THICKNESS || 2));
  if (wallsPreset > 0) {
    buildWalls(system.walls, dim, wallsPreset, wallThickness);
    system.hasWalls = true;
  }
  system.wells = buildWells(worldSize, Math.max(0, Math.round(params.WELL_COUNT || 0)));
  system.portals = buildPortals(dim, Math.max(0, Math.round(params.PORTAL_COUNT || 0)));
  return system;
}

function buildWalls(walls, dim, preset, t) {
  const mid = dim >> 1;
  for (let z = 0; z < dim; z++) {
    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        let wall = false;
        if (preset === 1) {
          // Border: outer shell on all six faces.
          wall = x < t || x >= dim - t || y < t || y >= dim - t || z < t || z >= dim - t;
        } else if (preset === 2) {
          // Ring: a square band around the centre column, mid-height.
          const d = Math.max(Math.abs(x - mid), Math.abs(y - mid));
          wall = d >= dim / 2 - t && d < dim / 2 && z >= dim / 2 - t && z < dim / 2 + t;
        } else if (preset === 3) {
          // Cross: two perpendicular slabs through the centre.
          wall = Math.abs(x - mid) < t || Math.abs(y - mid) < t;
        }
        if (wall) walls[idx(dim, x, y, z)] = 1;
      }
    }
  }
}

function buildWells(worldSize, count) {
  const wells = [];
  if (count <= 0) return wells;
  const c = worldSize / 2;
  const radius = worldSize * 0.28;
  for (let k = 0; k < count; k++) {
    const ang = (k / count) * Math.PI * 2 + 0.7;
    wells.push({
      x: c + Math.cos(ang) * radius,
      y: c + Math.sin(ang) * radius,
      z: c,
      r: worldSize * 0.25,
    });
  }
  return wells;
}

function buildPortals(dim, count) {
  const portals = [];
  for (let k = 0; k < count; k++) {
    const y = 2 + ((k * 7) % (dim - 4));
    const z = 2 + ((k * 11) % (dim - 4));
    const a = idx(dim, 1, y, z);
    const b = idx(dim, dim - 2, dim - 1 - y, dim - 1 - z);
    portals.push({ a, b });
  }
  return portals;
}

/**
 * Get (or rebuild) the singleton field system for the current world config.
 * Structural params (world size, dim, wall/well/portal layout) trigger a
 * rebuild; field strengths/diffusion are read live and never rebuild.
 */
export function ensureFields(worldSize, params = {}) {
  const dim = gridDimFor(worldSize, params);
  const fp = `${worldSize}|${dim}|${Math.round(params.WALLS_PRESET || 0)}|`
    + `${Math.round(params.WALL_THICKNESS || 2)}|${Math.round(params.WELL_COUNT || 0)}|`
    + `${Math.round(params.PORTAL_COUNT || 0)}`;
  if (_system && _fingerprint === fp) return _system;
  _system = createFieldSystem(worldSize, dim, params);
  _fingerprint = fp;
  return _system;
}

export function getFields() {
  return _system;
}

export function resetFields() {
  _system = null;
  _fingerprint = '';
}

// ── Cell helpers ─────────────────────────────────────────────────────────────

function cellOf(system, px, py, pz) {
  const { cell, dim } = system;
  return {
    x: clamp(Math.floor(px / cell), 0, dim - 1),
    y: clamp(Math.floor(py / cell), 0, dim - 1),
    z: clamp(Math.floor(pz / cell), 0, dim - 1),
  };
}

function cellCenter(system, i) {
  const { dim, cell } = system;
  const x = i % dim;
  const y = Math.floor(i / dim) % dim;
  const z = Math.floor(i / (dim * dim));
  return { x: (x + 0.5) * cell, y: (y + 0.5) * cell, z: (z + 0.5) * cell };
}

// ── Unified write API ────────────────────────────────────────────────────────

/**
 * Add a delta to a field at a world position. The single write entry point for
 * laws, group constructions (Set F) and player tools. Vector fields accept a
 * [dx, dy, dz] delta; scalar fields a number.
 */
export function writeField(system, name, px, py, pz, delta) {
  if (!system) return;
  const c = cellOf(system, px, py, pz);
  const i = idx(system.dim, c.x, c.y, c.z);
  if (VECTORS.includes(name)) {
    const base = i * 3;
    const v = system.vectors[name];
    if (Array.isArray(delta)) {
      v[base] += delta[0];
      v[base + 1] += delta[1];
      v[base + 2] += delta[2];
    } else {
      v[base] += delta;
    }
  } else if (SCALARS.includes(name)) {
    system.scalars[name][i] += delta;
  }
}

/**
 * Set the impassable-wall flag at a world position (Set I barriers). Walls are
 * physically impassable only while the COLL law is on (the hard-matter toggle),
 * like the preset walls — this is the same wall grid, just written at runtime.
 */
export function writeWall(system, px, py, pz, on = true) {
  if (!system) return;
  const c = cellOf(system, px, py, pz);
  system.walls[idx(system.dim, c.x, c.y, c.z)] = on ? 1 : 0;
  if (on) system.hasWalls = true;
}

// ── Sampling (trilinear) ─────────────────────────────────────────────────────

function sampleScalar(system, name, fx, fy, fz) {
  const { dim } = system;
  const x0 = clamp(Math.floor(fx), 0, dim - 2);
  const y0 = clamp(Math.floor(fy), 0, dim - 2);
  const z0 = clamp(Math.floor(fz), 0, dim - 2);
  const tx = clamp(fx - x0, 0, 1);
  const ty = clamp(fy - y0, 0, 1);
  const tz = clamp(fz - z0, 0, 1);
  const s = system.scalars[name];
  let v = 0;
  for (let dz = 0; dz <= 1; dz++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const w = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz);
        v += s[idx(dim, x0 + dx, y0 + dy, z0 + dz)] * w;
      }
    }
  }
  return v;
}

function sampleVector(system, name, fx, fy, fz) {
  const { dim } = system;
  const x0 = clamp(Math.floor(fx), 0, dim - 2);
  const y0 = clamp(Math.floor(fy), 0, dim - 2);
  const z0 = clamp(Math.floor(fz), 0, dim - 2);
  const tx = clamp(fx - x0, 0, 1);
  const ty = clamp(fy - y0, 0, 1);
  const tz = clamp(fz - z0, 0, 1);
  const v = system.vectors[name];
  let ox = 0, oy = 0, oz = 0;
  for (let dz = 0; dz <= 1; dz++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const w = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz);
        const base = idx(dim, x0 + dx, y0 + dy, z0 + dz) * 3;
        ox += v[base] * w;
        oy += v[base + 1] * w;
        oz += v[base + 2] * w;
      }
    }
  }
  return { x: ox, y: oy, z: oz };
}

function scalarGradient(system, name, fx, fy, fz) {
  const { cell } = system;
  const h = 1.0; // one cell in fractional space
  const gx = (sampleScalar(system, name, fx + h, fy, fz) - sampleScalar(system, name, fx - h, fy, fz)) / (2 * cell);
  const gy = (sampleScalar(system, name, fx, fy + h, fz) - sampleScalar(system, name, fx, fy - h, fz)) / (2 * cell);
  const gz = (sampleScalar(system, name, fx, fy, fz + h) - sampleScalar(system, name, fx, fy, fz - h)) / (2 * cell);
  return { x: gx, y: gy, z: gz };
}

/**
 * Total gradient force from the enabled fields at a world position.
 * Vector fields push along their flow; scalar fields push down-gradient.
 */
export function sampleFieldForces(system, px, py, pz, params = {}) {
  const out = { ax: 0, ay: 0, az: 0 };
  if (!system) return out;
  const fx = px / system.cell;
  const fy = py / system.cell;
  const fz = pz / system.cell;

  const windK = (Number.isFinite(params.FIELD_WIND) ? params.FIELD_WIND : 0) * 0.5;
  if (windK > 0) {
    const w = sampleVector(system, 'WIND', fx, fy, fz);
    out.ax += w.x * windK;
    out.ay += w.y * windK;
    out.az += w.z * windK;
  }
  const emK = (Number.isFinite(params.FIELD_EM) ? params.FIELD_EM : 0) * 0.5;
  if (emK > 0) {
    const e = sampleVector(system, 'EM', fx, fy, fz);
    out.ax += e.x * emK;
    out.ay += e.y * emK;
    out.az += e.z * emK;
  }
  const thermK = (Number.isFinite(params.FIELD_THERMAL) ? params.FIELD_THERMAL : 0) * (system.worldSize / 4);
  if (thermK > 0) {
    const g = scalarGradient(system, 'THERMAL', fx, fy, fz);
    out.ax -= g.x * thermK;
    out.ay -= g.y * thermK;
    out.az -= g.z * thermK;
  }
  const infoK = (Number.isFinite(params.FIELD_INFO) ? params.FIELD_INFO : 0) * (system.worldSize / 8);
  if (infoK > 0) {
    const g = scalarGradient(system, 'INFO', fx, fy, fz);
    out.ax -= g.x * infoK;
    out.ay -= g.y * infoK;
    out.az -= g.z * infoK;
  }
  return out;
}

/** Radial pull from gravity wells (falls off with distance). */
export function wellForce(system, px, py, pz, params = {}) {
  const out = { ax: 0, ay: 0, az: 0 };
  if (!system || system.wells.length === 0) return out;
  const strength = Number.isFinite(params.WELL_STRENGTH) ? params.WELL_STRENGTH : 1;
  if (!(strength > 0)) return out;
  for (const w of system.wells) {
    const dx = w.x - px;
    const dy = w.y - py;
    const dz = w.z - pz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > w.r || d < 1e-6) continue;
    const pull = strength * 0.5 * (1 - d / w.r);
    out.ax += (dx / d) * pull;
    out.ay += (dy / d) * pull;
    out.az += (dz / d) * pull;
  }
  return out;
}

// ── Walls & portals ──────────────────────────────────────────────────────────

export function isWall(system, px, py, pz) {
  if (!system || !system.hasWalls) return false;
  const c = cellOf(system, px, py, pz);
  return system.walls[idx(system.dim, c.x, c.y, c.z)] === 1;
}

/**
 * Velocity-only wall response: if the position sits inside a wall cell, push it
 * back out along the axis nearest the cell edge and reflect the velocity
 * component pointing into the wall.
 */
export function resolveWall(system, px, py, pz, vx, vy, vz) {
  if (!isWall(system, px, py, pz)) return { px, py, pz, vx, vy, vz };
  const { dim, cell } = system;
  const c = cellOf(system, px, py, pz);
  const fx = px / cell - c.x;
  const fy = py / cell - c.y;
  const fz = pz / cell - c.z;
  const dxEdge = Math.min(fx, 1 - fx);
  const dyEdge = Math.min(fy, 1 - fy);
  const dzEdge = Math.min(fz, 1 - fz);
  const minEdge = Math.min(dxEdge, dyEdge, dzEdge);
  const EPS = 0.02;
  // Push just OUTSIDE the wall cell (across the nearest face), so the escape
  // position is itself free and the particle is not re-pinned every tick.
  if (minEdge === dxEdge) {
    px = (fx < 0.5 ? c.x * cell - EPS : (c.x + 1) * cell + EPS);
    if ((fx < 0.5 && vx > 0) || (fx >= 0.5 && vx < 0)) vx = -vx;
  } else if (minEdge === dyEdge) {
    py = (fy < 0.5 ? c.y * cell - EPS : (c.y + 1) * cell + EPS);
    if ((fy < 0.5 && vy > 0) || (fy >= 0.5 && vy < 0)) vy = -vy;
  } else {
    pz = (fz < 0.5 ? c.z * cell - EPS : (c.z + 1) * cell + EPS);
    if ((fz < 0.5 && vz > 0) || (fz >= 0.5 && vz < 0)) vz = -vz;
  }
  return { px, py, pz, vx, vy, vz };
}

/** If the position sits on a portal cell, return the paired cell's centre. */
export function portalAt(system, px, py, pz) {
  if (!system || system.portals.length === 0) return null;
  const c = cellOf(system, px, py, pz);
  const i = idx(system.dim, c.x, c.y, c.z);
  for (const p of system.portals) {
    if (p.a === i) return cellCenter(system, p.b);
    if (p.b === i) return cellCenter(system, p.a);
  }
  return null;
}

// ── Per-tick evolution ───────────────────────────────────────────────────────

/**
 * Ambient seeding — relax each field toward its world-param target so the
 * FIELD_* sliders take effect LIVE (no rebuild): WIND blows uniformly +X,
 * EM drifts uniformly +Y, THERMAL runs hot→cold along X, INFO is dense at
 * the dish core. Deterministic — no PRNG. Writes from laws / groups / the
 * player (writeField) decay away at the same gentle rate, so constructions
 * persist for a while but the dish eventually returns to its ambient state.
 */
function seedAmbient(system, dt, params = {}) {
  const { dim, cells } = system;
  const windT = Number.isFinite(params.FIELD_WIND) ? params.FIELD_WIND : 0;
  const emT = Number.isFinite(params.FIELD_EM) ? params.FIELD_EM : 0;
  const thermT = Number.isFinite(params.FIELD_THERMAL) ? params.FIELD_THERMAL : 0;
  const infoT = Number.isFinite(params.FIELD_INFO) ? params.FIELD_INFO : 0;

  if (windT > 0) {
    const k = Math.min(1, 0.08 * dt);
    const wind = system.vectors.WIND;
    for (let i = 0; i < cells; i++) {
      const b = i * 3;
      wind[b] += (windT - wind[b]) * k;
      wind[b + 1] *= 1 - k * 0.5;
      wind[b + 2] *= 1 - k * 0.5;
    }
  }
  if (emT > 0) {
    const k = Math.min(1, 0.08 * dt);
    const em = system.vectors.EM;
    for (let i = 0; i < cells; i++) {
      const b = i * 3;
      em[b] *= 1 - k * 0.5;
      em[b + 1] += (emT - em[b + 1]) * k;
      em[b + 2] *= 1 - k * 0.5;
    }
  }
  if (thermT > 0) {
    const k = Math.min(1, 0.05 * dt);
    const s = system.scalars.THERMAL;
    const span = Math.max(1, dim - 1);
    for (let z = 0; z < dim; z++) {
      for (let y = 0; y < dim; y++) {
        for (let x = 0; x < dim; x++) {
          const i = idx(dim, x, y, z);
          const target = thermT * (x / span); // hot at +X, cold at 0
          s[i] += (target - s[i]) * k;
        }
      }
    }
  }
  if (infoT > 0) {
    const k = Math.min(1, 0.05 * dt);
    const s = system.scalars.INFO;
    const half = (dim - 1) / 2;
    for (let z = 0; z < dim; z++) {
      for (let y = 0; y < dim; y++) {
        for (let x = 0; x < dim; x++) {
          const i = idx(dim, x, y, z);
          const d = Math.sqrt((x - half) ** 2 + (y - half) ** 2 + (z - half) ** 2) / Math.max(0.5, half);
          const target = infoT * Math.max(0, 1 - d);
          s[i] += (target - s[i]) * k;
        }
      }
    }
  }
}

/**
 * Advance every active field one tick: ambient seeding toward the FIELD_*
 * slider targets, scalar diffusion + decay, gentle vector circulation (WIND
 * rotates, EM dissipates), and generalized advection — each vector field
 * carries each scalar field along its flow.
 */
export function advanceFields(system, dt, params = {}) {
  if (!system) return;
  seedAmbient(system, dt, params);
  const { dim, cells } = system;
  const diff = clamp((Number.isFinite(params.FIELD_DIFFUSION) ? params.FIELD_DIFFUSION : 0.1) * dt, 0, 0.16);
  const decay = 0.01 * dt;
  const advK = 0.04 * dt;
  const windRot = 0.02 * dt;
  const scratch = system.scratch;
  const acc = system.acc;

  // Scalars: decay + diffusion (clamped boundaries).
  for (const name of SCALARS) {
    const s = system.scalars[name];
    if (decay > 0) {
      for (let i = 0; i < cells; i++) s[i] *= 1 - decay;
    }
    if (diff > 0) {
      scratch.set(s);
      for (let z = 0; z < dim; z++) {
        for (let y = 0; y < dim; y++) {
          for (let x = 0; x < dim; x++) {
            const i = idx(dim, x, y, z);
            let sum = s[i] * (1 - 6 * diff);
            sum += (x > 0 ? scratch[i - 1] : scratch[i]) * diff;
            sum += (x < dim - 1 ? scratch[i + 1] : scratch[i]) * diff;
            sum += (y > 0 ? scratch[i - dim] : scratch[i]) * diff;
            sum += (y < dim - 1 ? scratch[i + dim] : scratch[i]) * diff;
            sum += (z > 0 ? scratch[i - dim * dim] : scratch[i]) * diff;
            sum += (z < dim - 1 ? scratch[i + dim * dim] : scratch[i]) * diff;
            s[i] = sum;
          }
        }
      }
    }
  }

  // Vectors: WIND circulates slowly; EM dissipates.
  const wind = system.vectors.WIND;
  if (windRot > 0) {
    for (let i = 0; i < cells; i++) {
      const base = i * 3;
      const wx = wind[base];
      const wy = wind[base + 1];
      const c = Math.cos(windRot);
      const sn = Math.sin(windRot);
      wind[base] = wx * c - wy * sn;
      wind[base + 1] = wx * sn + wy * c;
    }
  }
  const em = system.vectors.EM;
  const emDecay = 1 - 0.02 * dt;
  if (emDecay < 1) {
    for (let i = 0; i < cells * 3; i++) em[i] *= emDecay;
  }

  // Generalized advection: every vector field transports every scalar.
  if (advK > 0) {
    for (const vName of VECTORS) {
      const v = system.vectors[vName];
      for (const sName of SCALARS) {
        const s = system.scalars[sName];
        acc.fill(0);
        for (let z = 0; z < dim; z++) {
          for (let y = 0; y < dim; y++) {
            for (let x = 0; x < dim; x++) {
              const i = idx(dim, x, y, z);
              const mag = Math.abs(v[i * 3]) + Math.abs(v[i * 3 + 1]) + Math.abs(v[i * 3 + 2]);
              if (mag < 1e-6) continue;
              const amount = s[i] * advK * Math.min(1, mag);
              let nx = 0, ny = 0, nz = 0;
              if (Math.abs(v[i * 3]) >= Math.abs(v[i * 3 + 1]) && Math.abs(v[i * 3]) >= Math.abs(v[i * 3 + 2])) {
                nx = v[i * 3] > 0 ? 1 : -1;
              } else if (Math.abs(v[i * 3 + 1]) >= Math.abs(v[i * 3 + 2])) {
                ny = v[i * 3 + 1] > 0 ? 1 : -1;
              } else {
                nz = v[i * 3 + 2] > 0 ? 1 : -1;
              }
              const j = idx(dim, clamp(x + nx, 0, dim - 1), clamp(y + ny, 0, dim - 1), clamp(z + nz, 0, dim - 1));
              acc[j] += amount;
              acc[i] -= amount;
            }
          }
        }
        for (let i = 0; i < cells; i++) s[i] += acc[i];
      }
    }
  }
}
