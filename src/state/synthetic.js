/**
 * VEPA4 — Synthetic Life (Set P.1 "Synthetic Life", RRP O·P·Q trilogy)
 *
 * The second build of the cosmic trilogy: intelligence outgrows DNA and the
 * dish gains a non-biological lineage layer. Where O made the cosmos, P
 * makes *life* in it — but life that isn't bound by the 64-parameter genome.
 *
 *   1. SYNTHETIC ORGANISMS (P.1) — non-DNA entities born from advanced K
 *      mega-structures (HUBs with high treasury + era). They evolve by
 *      program-like traits (a compact 8-param vector instead of the 64 DNA
 *      params), are immune to speciation (no slots consumed), and decay
 *      without upkeep energy.
 *   2. UPLOADED CONSCIOUSNESS (P.2) — species reaching an intelligence
 *      threshold (REGULATORY_DEPTH + SELECTION_SENSITIVITY + era gate) get
 *      a digital copy in a virtual layer — a parallel lineage that keeps
 *      evolving without the body's death risk.
 *   3. MACHINE GROUPS (P.3) — synthetic entities register in the F.1 group
 *      registry with their own roles; they trade, ally, and conflict with
 *      biological groups through the existing economy/relations machinery.
 *
 * Everything is deterministic — no PRNG.
 */
import { STRIDE_INDEXES, DNA_INDEXES } from '../constants.js';
import { writeField } from '../physics/fields.js';

export const SYNTHETIC_CADENCE = 30; // frames between passes

// ── Stride layout (Set P — uses reserved offsets 98-99) ──
export const OFFSET_SYNTHETIC_FLAGS = 98;
export const OFFSET_SYNTHETIC_TRAIT = 99;

// Synthetic flags bitfield (offset 98)
export const SYN_FLAG_SYNTHETIC = 1;  // spawned from HUB, non-DNA
export const SYN_FLAG_UPLOADED = 2;   // digital copy of a biological species
export const SYN_FLAG_MACHINE  = 4;   // registered in machine group

// Program-trait types (8 archetypes, stored in offset 99 high nibble)
export const SYN_PROGRAM_TYPES = ['SCOUT', 'WORKER', 'GUARD', 'COURIER', 'FARMER', 'CRAFTSMAN', 'ANALYST', 'SENTINEL'];
export const SYN_PROGRAM_COUNT = SYN_PROGRAM_TYPES.length;

// ── Defaults ──
const DEFAULT_UPLOAD_THRESHOLD = 1.2;   // intelligence = reg_depth × sel_sens × (1 + era * 0.1) must exceed
const DEFAULT_UPLOAD_RATE = 0.02;       // chance per qualifying species per pass
const DEFAULT_UPLOAD_PERSIST = 300;     // ticks an upload survives without refresh
const DEFAULT_SYNTHETIC_RATE = 0.3;     // spawn rate per qualifying HUB per pass
const DEFAULT_SYNTHETIC_MAX = 50;       // max synthetic organisms on the dish
const DEFAULT_SYNTHETIC_UPKEEP = 0.5;   // ENERGY cost per synthetic per pass
const DEFAULT_VIRTUAL_LAYER_MAX = 20;   // max uploaded consciousness copies
const HUB_MIN_TREASURY = 400;           // treasury threshold for HUB to spawn synthetics
const HUB_MIN_ERA = 2;                  // era threshold for HUB to spawn synthetics

function num(v, dflt) {
  return Number.isFinite(Number(v)) ? Number(v) : dflt;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Fresh synthetic state. The organism registry is the long-lived state;
 * uploads are separate (digital layer, not physical particles).
 */
export function createSyntheticState() {
  return {
    organisms: [],    // { id, parentId, program, traits[8], age, energy, groupId }
    uploads: [],      // { id, speciesId, sourceParticle, traits[8], age, persistLeft, active }
    nextOrganismId: 1,
    nextUploadId: 1,
  };
}

/**
 * One synthetic pass. Call from the intelligence loop while laws are active.
 * `opts.force` bypasses the cadence gate (tests).
 * @returns {{spawned:number, uploaded:number, decayed:number, upkepts:number, events:Array}}
 */
export function stepSynthetic(state, view, count, stride, fieldSystem, opts = {}) {
  const res = { spawned: 0, uploaded: 0, decayed: 0, upkepts: 0, events: [] };
  if (!state || !view || !fieldSystem) return res;
  if (!opts.force) {
    const tick = opts.tick ?? 0;
    if (tick % SYNTHETIC_CADENCE !== 0) return res;
  }
  const params = opts.worldParams || {};
  const synthRate = num(params.SYNTHETIC_RATE, DEFAULT_SYNTHETIC_RATE);
  const synthMax = clamp(Math.round(num(params.SYNTHETIC_MAX, DEFAULT_SYNTHETIC_MAX)), 0, 100);
  const synthUpkeep = num(params.SYNTHETIC_UPKEEP, DEFAULT_SYNTHETIC_UPKEEP);
  const uploadThreshold = num(params.UPLOAD_THRESHOLD, DEFAULT_UPLOAD_THRESHOLD);
  const uploadRate = num(params.UPLOAD_RATE, DEFAULT_UPLOAD_RATE);
  const uploadPersist = num(params.UPLOAD_PERSIST, DEFAULT_UPLOAD_PERSIST);
  const virtualMax = clamp(Math.round(num(params.VIRTUAL_LAYER_MAX, DEFAULT_VIRTUAL_LAYER_MAX)), 0, 100);
  const registry = opts.groupRegistry || null;
  const era = opts.era || 0;
  const S = STRIDE_INDEXES;

  // ── P.1 — Synthetic organisms from advanced HUBs ──
  if (synthRate > 0 && state.organisms.length < synthMax) {
    const groups = registry ? [...registry.groups.values()] : [];
    for (const g of groups) {
      if (state.organisms.length >= synthMax) break;
      // HUB gate: must have completed a HUB mega-structure, high treasury, advanced era
      const hasHUB = g.infra && g.infra.harvested > 0 && g.treasury >= HUB_MIN_TREASURY;
      if (!hasHUB || era < HUB_MIN_ERA) continue;
      // Deterministic spawn gate (hash-gated, no PRNG)
      const hash = ((g.id * 73856093) ^ (era * 19349663)) >>> 0;
      if ((hash % 1000) / 1000 > synthRate) continue;

      // Spawn synthetic organism
      const programIdx = hash % SYN_PROGRAM_COUNT;
      const traits = deriveTraits(programIdx, g, era);
      const organism = {
        id: state.nextOrganismId++,
        parentId: g.id,
        program: programIdx,
        traits,
        age: 0,
        energy: 100,
        groupId: g.id,
      };
      state.organisms.push(organism);

      // If there's room and the group has members, write a synthetic particle
      // into the stride buffer at the HUB centroid
      if (count < (opts.maxParticles || 100000)) {
        const idx = count;
        const base = idx * stride;
        const cx = g.cx || 0;
        const cy = g.cy || 0;
        const cz = g.cz || 0;
        view[base + S.POS_X] = cx;
        view[base + S.POS_Y] = cy;
        view[base + S.POS_Z] = cz;
        view[base + S.VEL_X] = 0;
        view[base + S.VEL_Y] = 0;
        view[base + S.VEL_Z] = 0;
        view[base + S.MASS] = 0.8;
        view[base + S.SPECIES_ID] = 0; // synthetic organisms don't consume species slots
        view[base + S.ENERGY] = 100;
        view[base + S.DEAD] = 0;
        view[base + S.AGE] = 0;
        view[base + S.ALPHA] = 0.7; // slightly translucent — synthetic
        view[base + S.RADIUS] = 0.4;
        // Color: teal-ish to distinguish from biological species
        view[base + S.COLOR_R] = 60;
        view[base + S.COLOR_G] = 200;
        view[base + S.COLOR_B] = 220;
        // Mark as synthetic
        view[base + OFFSET_SYNTHETIC_FLAGS] = SYN_FLAG_SYNTHETIC | SYN_FLAG_MACHINE;
        view[base + OFFSET_SYNTHETIC_TRAIT] = programIdx;
        // Register in group
        view[base + S.GROUP_ID] = g.id;
        res.spawned++;
        res.events.push({ type: 'synthetic:spawn', organism, group: g });
      }
    }
  }

  // ── P.2 — Uploaded consciousness ──
  if (uploadRate > 0 && state.uploads.length < virtualMax) {
    // Scan particles for qualifying species
    const seenSpecies = new Set();
    for (let i = 0; i < count; i++) {
      const base = i * stride;
      if (view[base + S.DEAD] >= 0.5) continue;
      if (view[base + OFFSET_SYNTHETIC_FLAGS] & SYN_FLAG_SYNTHETIC) continue; // skip synthetics
      const speciesId = view[base + S.SPECIES_ID] || 0;
      if (seenSpecies.has(speciesId)) continue;
      seenSpecies.add(speciesId);

      // Intelligence gate: REGULATORY_DEPTH × SELECTION_SENSITIVITY × (1 + era*0.1)
      const regDepth = view[base + S.DNA_CACHE_START + DNA_INDEXES.REGULATORY_DEPTH] || 0;
      const selSens = view[base + S.DNA_CACHE_START + DNA_INDEXES.SELECTION_SENSITIVITY] || 0;
      const intelligence = Math.abs(regDepth) * Math.abs(selSens) * (1 + era * 0.1);
      if (intelligence < uploadThreshold) continue;

      // Deterministic upload gate
      const hash = ((speciesId * 97531) ^ (Math.floor(view[base + S.AGE]) * 31)) >>> 0;
      if ((hash % 10000) / 10000 > uploadRate) continue;

      // Check if this species already has an active upload
      const existing = state.uploads.find(u => u.speciesId === speciesId && u.active);
      if (existing) {
        // Refresh persist timer
        existing.persistLeft = uploadPersist;
        continue;
      }

      // Create upload
      const traits = deriveUploadTraits(speciesId, view, base, stride);
      const upload = {
        id: state.nextUploadId++,
        speciesId,
        sourceParticle: i,
        traits,
        age: 0,
        persistLeft: uploadPersist,
        active: true,
      };
      state.uploads.push(upload);
      res.uploaded++;
      res.events.push({ type: 'synthetic:upload', upload, intelligence });
      break; // one upload per pass (bounded, design risk P.3)
    }
  }

  // ── Maintenance: age + decay synthetic organisms ──
  for (let s = state.organisms.length - 1; s >= 0; s--) {
    const org = state.organisms[s];
    org.age++;
    // Upkeep: ENERGY drain
    if (org.energy > 0) {
      org.energy -= synthUpkeep;
      res.upkepts++;
    }
    // Decay: no energy → mark for removal (their stride particle dies on next solver pass)
    if (org.energy <= 0) {
      state.organisms.splice(s, 1);
      res.decayed++;
      res.events.push({ type: 'synthetic:decay', organism: org });
    }
  }

  // ── Maintenance: age uploads, expire without refresh ──
  for (let u = state.uploads.length - 1; u >= 0; u--) {
    const upload = state.uploads[u];
    upload.age++;
    upload.persistLeft--;
    if (upload.persistLeft <= 0) {
      upload.active = false;
      state.uploads.splice(u, 1);
      res.events.push({ type: 'synthetic:upload-expire', upload });
    }
  }

  return res;
}

/**
 * Derive 8 program traits from the archetype + group state + era.
 * Traits are [speed, strength, efficiency, perception, coordination, adaptability, resilience, curiosity]
 * in range [0, 1].
 */
function deriveTraits(programIdx, group, era) {
  const traits = new Float32Array(8);
  const treasuryFactor = Math.min(1, (group.treasury || 0) / 800);
  const eraFactor = Math.min(1, era / 10);
  // Base archetype profiles (deterministic per program type)
  const profiles = [
    [0.9, 0.3, 0.5, 0.8, 0.4, 0.7, 0.3, 0.9], // SCOUT
    [0.4, 0.6, 0.8, 0.3, 0.5, 0.5, 0.6, 0.3], // WORKER
    [0.3, 0.9, 0.4, 0.5, 0.7, 0.3, 0.9, 0.2], // GUARD
    [0.7, 0.3, 0.6, 0.6, 0.8, 0.6, 0.4, 0.5], // COURIER
    [0.5, 0.4, 0.9, 0.4, 0.6, 0.4, 0.7, 0.3], // FARMER
    [0.3, 0.5, 0.7, 0.3, 0.9, 0.5, 0.5, 0.4], // CRAFTSMAN
    [0.4, 0.2, 0.6, 0.9, 0.5, 0.9, 0.3, 0.8], // ANALYST
    [0.5, 0.7, 0.5, 0.7, 0.6, 0.6, 0.8, 0.4], // SENTINEL
  ];
  const base = profiles[programIdx] || profiles[0];
  for (let i = 0; i < 8; i++) {
    traits[i] = clamp(base[i] + treasuryFactor * 0.1 + eraFactor * 0.05, 0, 1);
  }
  return traits;
}

/**
 * Derive 8 upload traits from the biological source particle's DNA.
 * Maps key DNA params into the compact trait vector.
 */
function deriveUploadTraits(speciesId, view, base, stride) {
  const traits = new Float32Array(8);
  const S = STRIDE_INDEXES;
  const cache = base + S.DNA_CACHE_START;
  // Map DNA params to upload traits (normalized 0-1):
  // [speed, strength, efficiency, perception, coordination, adaptability, resilience, curiosity]
  traits[0] = clamp((1 + (view[cache + DNA_INDEXES.FORCE] || 0)) / 2, 0, 1);
  traits[1] = clamp((view[cache + DNA_INDEXES.STIFFNESS] || 0), 0, 1);
  traits[2] = clamp((view[cache + DNA_INDEXES.ENERGY_EFFICIENCY] || 0), 0, 1);
  traits[3] = clamp((1 + (view[cache + DNA_INDEXES.SIGNAL_RESP] || 0)) / 2, 0, 1);
  traits[4] = clamp((view[cache + DNA_INDEXES.SPECIES_AFFINITY] || 0), 0, 1);
  traits[5] = clamp((view[cache + DNA_INDEXES.MUTATION] || 0), 0, 1);
  traits[6] = clamp((view[base + S.ARMOR] || 0), 0, 1);
  traits[7] = clamp((view[cache + DNA_INDEXES.JITTER] || 0), 0, 1);
  return traits;
}

/**
 * Summary for tests and analytics.
 */
export function syntheticSummary(state) {
  if (!state) return { organisms: 0, uploads: 0, programs: {}, activeUploads: 0 };
  const programs = {};
  for (const org of state.organisms) {
    const name = SYN_PROGRAM_TYPES[org.program] || 'UNKNOWN';
    programs[name] = (programs[name] || 0) + 1;
  }
  return {
    organisms: state.organisms.length,
    uploads: state.uploads.length,
    activeUploads: state.uploads.filter(u => u.active).length,
    programs,
  };
}
