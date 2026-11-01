export const MECHANICS_PARAMETERS = {
  CONTACT: ['RADIUS (Stride 56)', 'MASS (Stride 6)', 'STIFFNESS (DNA 8)'],
  MOMENTUM: ['MASS (Stride 6)', 'VEL_X/Y/Z (Stride 3-5)', 'MOMENTUM_GAIN (World)'],
  INERTIA: ['MASS (Stride 6)', 'INERTIA (DNA 26)', 'FORCE (DNA 0)'],
  TORQUE: ['TORQUE (DNA 2)', 'VEL_X/Y/Z (Stride 3-5)', 'POS_X/Y/Z (Stride 0-2)'],
  CONSTRAINT: ['RADIUS (Stride 56)', 'BOND_COUNT (Stride 58)', 'CONSTRAINT_STRENGTH (World)'],
  FRAGMENTATION: ['VEL_X/Y/Z (Stride 3-5)', 'ARMOR (Stride 63)', 'MASS (Stride 6)'],
  TOPOLOGY: ['BOND_COUNT (Stride 58)', 'BOND_PARTNER_1-6 (Stride 59-84)', 'TOPOLOGY_GAIN (World)'],
  ADHESION: ['RADIUS (Stride 56)', 'BOND_COUNT (Stride 58)', 'ADHESION_RANGE (World)'],
};

export const MECHANICS_HELP = {
  CONTACT: { hint: 'Hard contact prevents particle overlap.', explanation: 'Contact resolves interpenetration using radii and mass.', system: 'Overlap produces a bounded separating acceleration.', advanced: 'The local contact primitive complements ELASTICITY.' },
  MOMENTUM: { hint: 'Momentum transfers motion between neighbors.', explanation: 'Relative velocity is shared according to partner mass.', system: 'Velocity difference produces a mass-weighted impulse.', advanced: 'Bounded relaxation avoids numerical energy injection.' },
  INERTIA: { hint: 'Inertia resists acceleration.', explanation: 'Mass scales how strongly accumulated acceleration changes motion.', system: 'Force response is divided by mass.', advanced: 'It does not add particle stride state.' },
  TORQUE: { hint: 'Torque turns relative motion around a contact vector.', explanation: 'Tangential relative motion becomes a bounded rotational impulse.', system: 'The cross product of separation and relative velocity supplies the impulse.', advanced: 'It complements the world-centre ROTATION law.' },
  CONSTRAINT: { hint: 'Constraints maintain a separation target.', explanation: 'Neighbor pairs are softly driven toward their combined-radius target distance.', system: 'Distance error becomes a spring-like bounded force.', advanced: 'Use with BOND for persistent composite structures.' },
  FRAGMENTATION: { hint: 'High-speed impacts can separate structures.', explanation: 'Large relative velocity generates a separating impulse when armor cannot absorb it.', system: 'Relative speed above the armor threshold produces repulsion.', advanced: 'It does not delete particles.' },
  TOPOLOGY: { hint: 'Topology balances local composite connectivity.', explanation: 'Bond-count imbalance produces a small structural correction between neighbors.', system: 'The bond-count gradient biases pair separation.', advanced: 'It is graph geometry and never invents bonds.' },
  ADHESION: { hint: 'Adhesion lets nearby surfaces remain joined.', explanation: 'Close particles receive a bounded attractive force supporting adjoined structures.', system: 'Near-contact distance error becomes attraction.', advanced: 'Unlike ACCR, it does not merge mass.' },
};
