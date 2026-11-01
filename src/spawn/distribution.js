/**
 * VEPA4 — Spawn distribution sampling (pure, testable)
 *
 * The WORLD panel distribution sliders (SHAPE / SPAWN_CENTRES /
 * SPAWN_CENTRE_RANDOM / SPAWN_CENTRE_BIAS / GROUND_HEIGHT) drive these
 * functions. Kept free of DOM/main-thread state so the audit suite can
 * validate each slider deterministically.
 */
import { DEFAULT_PARTICLES_PER_SPECIES } from '../constants.js';

/**
 * Compute spawn cluster centres across the world volume.
 * count 1 → single centre at the middle of the dish.
 * random 0 → centres evenly spaced on a grid; 1 → random placement.
 */
export function buildSpawnCentres(count, random, worldSize, prng) {
  const r = Math.max(0, Math.min(1, random));
  const centres = [];
  if (count <= 1) {
    centres.push({ x: worldSize * 0.5, y: worldSize * 0.5, z: worldSize * 0.5 });
    return centres;
  }
  const gridDim = Math.max(2, Math.ceil(Math.cbrt(count)));
  const cellSize = (worldSize - 20) / gridDim;
  for (let c = 0; c < count; c++) {
    const gx = c % gridDim;
    const gy = Math.floor(c / gridDim) % gridDim;
    const gz = Math.floor(c / (gridDim * gridDim));
    const bx = 10 + gx * cellSize + cellSize * 0.5;
    const by = 10 + gy * cellSize + cellSize * 0.5;
    const bz = 10 + gz * cellSize + cellSize * 0.5;
    const rx = prng.nextFloat ? prng.nextFloat(0, worldSize) : prng() * worldSize;
    const ry = prng.nextFloat ? prng.nextFloat(0, worldSize) : prng() * worldSize;
    const rz = prng.nextFloat ? prng.nextFloat(0, worldSize) : prng() * worldSize;
    centres.push({
      x: bx + (rx - bx) * r,
      y: by + (ry - by) * r,
      z: bz + (rz - bz) * r,
    });
  }
  return centres;
}

/**
 * Sample a random spawn point from the configured distribution.
 * cfg: world params object (SHAPE, SPAWN_CENTRES, SPAWN_CENTRE_RANDOM,
 *      SPAWN_CENTRE_BIAS, GROUND_HEIGHT).
 * shape 0 = even grid, 1 = fully random; centreBias 0 = uniform,
 * 1 = pinned to centres; GROUND_HEIGHT keeps z inside the ground band.
 */
export function sampleSpawnPosition(cfg, worldSize, prng) {
  const perSpecies = DEFAULT_PARTICLES_PER_SPECIES;
  const gridDim = Math.max(2, Math.ceil(Math.cbrt(perSpecies)));
  const cellSize = (worldSize - 10) / gridDim;
  const cell = Math.floor(rand01(prng) * gridDim * gridDim * gridDim);
  const gx = cell % gridDim;
  const gy = Math.floor(cell / gridDim) % gridDim;
  const gz = Math.floor(cell / (gridDim * gridDim));
  const jit = () => (rand01(prng) - 0.5) * cellSize * 0.4;
  let px = 5 + gx * cellSize + cellSize * 0.5 + jit();
  let py = 5 + gy * cellSize + cellSize * 0.5 + jit();
  let pz = 5 + gz * cellSize + cellSize * 0.5 + jit();
  const shape = Number.isFinite(cfg.SHAPE) ? cfg.SHAPE : 0;
  if (shape > 0) {
    px = px + (rand01(prng) * worldSize - px) * shape;
    py = py + (rand01(prng) * worldSize - py) * shape;
    pz = pz + (rand01(prng) * worldSize - pz) * shape;
  }
  const centreBias = Number.isFinite(cfg.SPAWN_CENTRE_BIAS) ? cfg.SPAWN_CENTRE_BIAS : 0;
  if (centreBias > 0) {
    const centres = buildSpawnCentres(
      Math.max(1, Math.min(64, Math.round(cfg.SPAWN_CENTRES) || 1)),
      Number.isFinite(cfg.SPAWN_CENTRE_RANDOM) ? cfg.SPAWN_CENTRE_RANDOM : 0.5,
      worldSize,
      prng,
    );
    if (centres.length) {
      const c = centres[Math.floor(rand01(prng) * centres.length)];
      px = px + (c.x - px) * centreBias;
      py = py + (c.y - py) * centreBias;
      pz = pz + (c.z - pz) * centreBias;
    }
  }
  // GROUND_HEIGHT: keep spawns inside the ground band (z ∈ [0, worldSize * h]).
  const groundH = Math.max(0, Math.min(1, Number.isFinite(cfg.GROUND_HEIGHT) ? cfg.GROUND_HEIGHT : 0.9));
  if (groundH < 1) pz = Math.min(pz, Math.max(0, worldSize * groundH));
  return { x: px, y: py, z: pz };
}

function rand01(prng) {
  return prng && typeof prng.nextFloat === 'function' ? prng.nextFloat(0, 1) : prng();
}

/**
 * Total initial population from INITIAL_POP, capped by the hard cap.
 */
export function initialPopulationTarget(cfg, caps) {
  return Math.min(Math.max(1, Math.round(cfg.INITIAL_POP)), caps.hardCap);
}

/**
 * Per-species allocation (even split, rounded up) of a population target.
 */
export function perSpeciesAllocation(target, speciesCount) {
  return Math.max(1, Math.ceil(target / Math.max(1, speciesCount)));
}
