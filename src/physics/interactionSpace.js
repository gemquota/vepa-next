/**
 * VEPA4 interaction space.
 *
 * Named laws are recipes over shared dimensions, not mutually exclusive
 * physical primitives.  The solver remains the executable source of behavior;
 * this registry makes the trigger, relationship, geometry, flows, identity,
 * persistence, failure, and lifecycle semantics explicit and inspectable.
 */

import { LAW_INDEXES } from '../constants.js';
import { deepFreeze as freeze } from '../core/numeric.js';

const mechanism = (name, category, lawKeys, semantics, implementation) => ({
  name,
  category,
  lawKeys,
  semantics,
  implementation,
});

const PRESETS = [
  mechanism('CONTACT', 'collision', ['CONTACT', 'COLL'], {
    trigger: ['overlap', 'collision'], participants: 'binary', direction: 'bilateral',
    relation: 'independent', geometry: ['overlapping', 'touching'],
    constraints: ['separation'], material: 'none', information: 'none',
    identity: 'unchanged', persistence: 'instantaneous', failure: ['none'],
    outcome: ['displacement', 'impulse'],
  }, ['src/physics/solver.js:contact phase', 'src/physics/lawgroups/mechanicsLaws.js:applyContactCorrection']),
  mechanism('ADHESION', 'attachment', ['ADHESION'], {
    trigger: ['proximity', 'touching'], participants: 'binary', direction: 'bilateral',
    relation: 'temporarily coupled', geometry: 'edge-to-edge',
    constraints: ['preferred distance', 'soft attraction'], material: 'none', information: 'none',
    identity: 'unchanged', persistence: 'contact-duration', failure: ['distance'],
    outcome: ['attachment-like attraction'],
  }, ['src/physics/lawgroups/mechanicsLaws.js:applyAdhesion']),
  mechanism('BOND', 'attachment', ['BOND'], {
    trigger: ['proximity', 'contact'], participants: 'binary', direction: 'bilateral',
    relation: 'permanently coupled', geometry: 'edge-to-edge',
    constraints: ['preferred distance', 'elastic spring'], material: 'none', information: 'none',
    identity: 'unchanged', persistence: 'conditional', failure: ['distance', 'force'],
    outcome: ['attachment', 'recoil'],
  }, ['src/physics/laws.js:applyBond', 'src/physics/solver.js:bond phase']),
  mechanism('ACCR', 'attachment', ['ACCR'], {
    trigger: ['proximity', 'persistent contact', 'collision', 'history'], participants: 'binary', direction: 'bilateral',
    relation: 'permanently coupled', geometry: 'edge-to-edge',
    constraints: ['fixed seam distance', 'rigid-ish translation', 'normal velocity removal'],
    material: 'none', information: 'none', identity: 'composite without identity merge',
    persistence: 'conditional', failure: ['force', 'death', 'slot exhaustion'],
    outcome: ['attachment', 'topology change'],
  }, ['src/physics/mergePhysics.js:adjoinParticles', 'src/physics/mergePhysics.js:maintainAdjoinedPair', 'src/physics/solver.js:ACCR phase']),
  mechanism('POLYMER', 'attachment', ['POLYMER'], {
    trigger: ['proximity', 'state compatibility', 'network topology'], participants: 'n-body', direction: 'bilateral',
    relation: 'permanently coupled', geometry: ['linear', 'branched'],
    constraints: ['elastic distance', 'limited valence'], material: 'none', information: 'none',
    identity: 'composite without identity merge', persistence: 'conditional', failure: ['distance', 'force', 'valence'],
    outcome: ['attachment', 'topology change'],
  }, ['src/physics/laws.js:applyPolymer', 'src/physics/solver.js:polymer phase']),
  mechanism('CRYSTALLIZATION', 'attachment', ['CRYSTALLIZATION'], {
    trigger: ['state compatibility', 'temperature', 'threshold', 'topology'], participants: 'n-body', direction: 'bilateral',
    relation: 'permanently coupled', geometry: ['lattice', 'radial', 'cluster'],
    constraints: ['preferred angle', 'rigid lattice spacing'], material: 'composite material', information: 'state',
    identity: 'composite without identity merge', persistence: 'conditional', failure: ['temperature', 'energy', 'damage'],
    outcome: ['attachment', 'topology change', 'phase change'],
  }, ['src/physics/laws.js:applyCrystallization', 'src/physics/solver.js:crystallization phase']),
  mechanism('ALLOY', 'fusion', ['ALLOY'], {
    trigger: ['overlap', 'collision', 'state compatibility'], participants: 'binary', direction: 'bilateral',
    relation: 'fused', geometry: 'coincident', constraints: ['centre of mass'],
    material: ['mass pooling', 'energy pooling'], information: ['DNA recombination', 'phenotype blend'],
    identity: 'A+B→C', persistence: 'irreversible', failure: ['overlap threshold'],
    outcome: ['fusion', 'death of absorbed body'],
  }, ['src/physics/mergePhysics.js:mergeParticles', 'src/physics/mergePhysics.js:applyAlloy']),
  mechanism('CONSTRAINT', 'interaction', ['CONSTRAINT'], {
    trigger: ['history', 'network topology'], participants: 'binary', direction: 'bilateral',
    relation: 'constrained', geometry: 'edge-to-edge', constraints: ['preferred distance'],
    material: 'none', information: 'none', identity: 'unchanged', persistence: 'conditional',
    failure: ['distance', 'force'], outcome: ['displacement'],
  }, ['src/physics/lawgroups/mechanicsLaws.js:applyConstraint', 'src/physics/solver.js:constraint phase']),
  mechanism('PREDATION', 'consumption', ['PREDATION'], {
    trigger: ['proximity', 'collision', 'state compatibility', 'hunger'], participants: 'binary', direction: 'A→B',
    relation: 'hierarchically coupled', geometry: 'free', constraints: ['pursuit'],
    material: ['mass transfer', 'energy transfer'], information: ['DNA absorption'],
    identity: 'B destroyed or weakened', persistence: 'conditional', failure: ['prey escape', 'predator bias'],
    outcome: ['damage', 'consumption', 'death'],
  }, ['src/physics/laws.js:applyPredation', 'src/physics/solver.js:predation phase']),
  mechanism('SINGULARITY', 'consumption', ['SINGULARITY', 'HORIZON'], {
    trigger: ['field influence', 'threshold'], participants: 'unary plus neighbors', direction: 'A→B',
    relation: 'hierarchically coupled', geometry: 'coincident at horizon', constraints: ['capture radius'],
    material: ['mass absorption', 'energy conversion'], information: 'none', identity: 'B absorbed',
    persistence: 'conditional', failure: ['horizon distance'], outcome: ['displacement', 'death', 'absorption'],
  }, ['src/physics/laws.js:applySingularityAbsorb', 'src/physics/solver.js:singularity phase']),
  mechanism('SYMBIOSIS', 'biological relationship', ['SYMBIOSIS'], {
    trigger: ['proximity', 'state compatibility'], participants: 'binary', direction: 'A↔B',
    relation: 'mutually coupled', geometry: 'free', constraints: ['none'],
    material: ['bidirectional energy exchange'], information: 'state', identity: 'unchanged',
    persistence: 'contact-duration', failure: ['distance'], outcome: ['energy transfer'],
  }, ['src/physics/lawgroups/biologyLaws.js:applySymbiosis', 'src/physics/solver.js:biology phase']),
  mechanism('PARASITE', 'biological relationship', ['PARASITE'], {
    trigger: ['proximity', 'state compatibility'], participants: 'binary', direction: 'A→B',
    relation: 'hierarchically coupled', geometry: 'free', constraints: ['host proximity'],
    material: ['one-way energy transfer'], information: 'none', identity: 'unchanged',
    persistence: 'conditional', failure: ['distance', 'host immunity'], outcome: ['energy transfer', 'damage'],
  }, ['src/physics/lawgroups/biologyLaws.js:applyParasite', 'src/physics/solver.js:biology phase']),
  mechanism('ENTANGLEMENT', 'information/state coupling', ['ENTANGLEMENT'], {
    trigger: ['state', 'history'], participants: 'binary', direction: 'A↔B',
    relation: 'shared state', geometry: 'free', constraints: ['none'], material: 'none',
    information: ['correlated phase/state'], identity: 'unchanged', persistence: 'conditional',
    failure: ['decoherence', 'distance'], outcome: ['state coupling'],
  }, ['src/physics/laws.js:applyEntanglePair', 'src/physics/laws.js:applyEntanglement']),
  mechanism('REPRODUCTION', 'creation', ['REPRO'], {
    trigger: ['state compatibility', 'contact', 'threshold', 'history'], participants: 'binary or unary', direction: 'A+B→A+B+C',
    relation: 'temporary composite', geometry: ['edge-to-edge', 'cluster'], constraints: ['energy threshold'],
    material: ['energy redistribution', 'mass redistribution'], information: ['recombination', 'mutation', 'inheritance'],
    identity: 'offspring', persistence: 'timed', failure: ['energy', 'age', 'probability'],
    outcome: ['creation', 'lineage transition'],
  }, ['src/physics/laws.js:applyReproduction', 'src/physics/solver.js:reproduction phase']),
];

export const INTERACTION_PRESETS = freeze(PRESETS);

export function getInteractionPreset(name) {
  return INTERACTION_PRESETS.find((preset) => preset.name === name) || null;
}

export function getInteractionLawIndexes(name) {
  const preset = getInteractionPreset(name);
  return preset ? preset.lawKeys.map((key) => LAW_INDEXES[key]).filter((index) => Number.isInteger(index)) : [];
}

export function listInteractionPresets(category) {
  return INTERACTION_PRESETS.filter((preset) => !category || preset.category === category);
}
