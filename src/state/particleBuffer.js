import { STRIDE_INDEXES } from '../constants.js';

/**
 * Create a particle storage buffer.
 * Uses SharedArrayBuffer when available (needs COOP/COEP headers);
 * falls back to regular ArrayBuffer for compatibility (e.g. GitHub Pages).
 * @param {number} maxParticles - Maximum number of particles
 * @param {number} stride - Floats per particle (must match PARTICLE_STRIDE)
 * @returns {{ buffer: ArrayBuffer|SharedArrayBuffer, view: Float32Array, isShared: boolean }}
 */
export function createParticleBuffer(maxParticles, stride) {
    const byteLength = maxParticles * stride * Float32Array.BYTES_PER_ELEMENT;
    let buffer;
    let isShared = false;
    try {
        buffer = new SharedArrayBuffer(byteLength);
        isShared = true;
    } catch {
        buffer = new ArrayBuffer(byteLength);
    }
    const view = new Float32Array(buffer);
    return { buffer, view, isShared };
}

export function getParticle(buffer, index, stride) {
    const view = new Float32Array(buffer);
    const base = index * stride;
    const S = STRIDE_INDEXES;
    return {
        x: view[base + S.POS_X],
        y: view[base + S.POS_Y],
        z: view[base + S.POS_Z],
        vx: view[base + S.VEL_X],
        vy: view[base + S.VEL_Y],
        vz: view[base + S.VEL_Z],
        mass: view[base + S.MASS],
        speciesId: view[base + S.SPECIES_ID],
        energy: view[base + S.ENERGY],
        age: view[base + S.AGE],
        dead: view[base + S.DEAD],
        colorR: view[base + S.COLOR_R],
        colorG: view[base + S.COLOR_G],
        colorB: view[base + S.COLOR_B],
        radius: view[base + S.RADIUS],
        signal: view[base + S.SIGNAL],
        bondCount: view[base + S.BOND_COUNT],
        bondPartner1: view[base + S.BOND_PARTNER_1],
        bondPartner2: view[base + S.BOND_PARTNER_2],
        bondPartner3: view[base + S.BOND_PARTNER_3],
        bondPartner4: view[base + S.BOND_PARTNER_4],
        bondPartner5: view[base + S.BOND_PARTNER_5],
        bondPartner6: view[base + S.BOND_PARTNER_6],
        memory: view[base + S.MEMORY],
        hunger: view[base + S.HUNGER],
        armor: view[base + S.ARMOR],
        electricEnergy: view[base + S.ELECTRIC_ENERGY],
        storedEnergy: view[base + S.STORED_ENERGY],
        reproDrive: view[base + S.REPRO_DRIVE],
        radiationExposure: view[base + S.RADIATION_EXPOSURE],
    };
}

export function setParticle(buffer, index, stride, data) {
    const view = new Float32Array(buffer);
    const base = index * stride;
    const S = STRIDE_INDEXES;
    if (data.x !== undefined) view[base + S.POS_X] = data.x;
    if (data.y !== undefined) view[base + S.POS_Y] = data.y;
    if (data.z !== undefined) view[base + S.POS_Z] = data.z;
    if (data.vx !== undefined) view[base + S.VEL_X] = data.vx;
    if (data.vy !== undefined) view[base + S.VEL_Y] = data.vy;
    if (data.vz !== undefined) view[base + S.VEL_Z] = data.vz;
    if (data.mass !== undefined) view[base + S.MASS] = data.mass;
    if (data.speciesId !== undefined) view[base + S.SPECIES_ID] = data.speciesId;
    if (data.energy !== undefined) view[base + S.ENERGY] = data.energy;
    if (data.age !== undefined) view[base + S.AGE] = data.age;
    if (data.dead !== undefined) view[base + S.DEAD] = data.dead;
    if (data.colorR !== undefined) view[base + S.COLOR_R] = data.colorR;
    if (data.colorG !== undefined) view[base + S.COLOR_G] = data.colorG;
    if (data.colorB !== undefined) view[base + S.COLOR_B] = data.colorB;
    if (data.radius !== undefined) view[base + S.RADIUS] = data.radius;
    if (data.signal !== undefined) view[base + S.SIGNAL] = data.signal;
    if (data.bondCount !== undefined) view[base + S.BOND_COUNT] = data.bondCount;
    if (data.bondPartner1 !== undefined) view[base + S.BOND_PARTNER_1] = data.bondPartner1;
    if (data.bondPartner2 !== undefined) view[base + S.BOND_PARTNER_2] = data.bondPartner2;
    if (data.bondPartner3 !== undefined) view[base + S.BOND_PARTNER_3] = data.bondPartner3;
    if (data.bondPartner4 !== undefined) view[base + S.BOND_PARTNER_4] = data.bondPartner4;
    if (data.bondPartner5 !== undefined) view[base + S.BOND_PARTNER_5] = data.bondPartner5;
    if (data.bondPartner6 !== undefined) view[base + S.BOND_PARTNER_6] = data.bondPartner6;
    if (data.memory !== undefined) view[base + S.MEMORY] = data.memory;
    if (data.hunger !== undefined) view[base + S.HUNGER] = data.hunger;
    if (data.armor !== undefined) view[base + S.ARMOR] = data.armor;
    if (data.electricEnergy !== undefined) view[base + S.ELECTRIC_ENERGY] = data.electricEnergy;
    if (data.storedEnergy !== undefined) view[base + S.STORED_ENERGY] = data.storedEnergy;
    if (data.reproDrive !== undefined) view[base + S.REPRO_DRIVE] = data.reproDrive;
    if (data.radiationExposure !== undefined) view[base + S.RADIATION_EXPOSURE] = data.radiationExposure;
}

export function getX(buffer, index, stride) {
    return new Float32Array(buffer)[index * stride + STRIDE_INDEXES.POS_X];
}
export function getY(buffer, index, stride) {
    return new Float32Array(buffer)[index * stride + STRIDE_INDEXES.POS_Y];
}
export function getZ(buffer, index, stride) {
    return new Float32Array(buffer)[index * stride + STRIDE_INDEXES.POS_Z];
}
export function setX(buffer, index, stride, value) {
    new Float32Array(buffer)[index * stride + STRIDE_INDEXES.POS_X] = value;
}
export function setY(buffer, index, stride, value) {
    new Float32Array(buffer)[index * stride + STRIDE_INDEXES.POS_Y] = value;
}
export function setZ(buffer, index, stride, value) {
    new Float32Array(buffer)[index * stride + STRIDE_INDEXES.POS_Z] = value;
}

export function getVelocity(buffer, index, stride) {
    const view = new Float32Array(buffer);
    const base = index * stride;
    const S = STRIDE_INDEXES;
    return { vx: view[base + S.VEL_X], vy: view[base + S.VEL_Y], vz: view[base + S.VEL_Z] };
}
export function setVelocity(buffer, index, stride, vx, vy, vz) {
    const view = new Float32Array(buffer);
    view[index * stride + STRIDE_INDEXES.VEL_X] = vx;
    view[index * stride + STRIDE_INDEXES.VEL_Y] = vy;
    view[index * stride + STRIDE_INDEXES.VEL_Z] = vz;
}

export function getMass(buffer, index, stride) {
    return new Float32Array(buffer)[index * stride + STRIDE_INDEXES.MASS];
}
export function setMass(buffer, index, stride, mass) {
    new Float32Array(buffer)[index * stride + STRIDE_INDEXES.MASS] = mass;
}

export function getSpeciesId(buffer, index, stride) {
    return new Float32Array(buffer)[index * stride + STRIDE_INDEXES.SPECIES_ID];
}
export function setSpeciesId(buffer, index, stride, id) {
    new Float32Array(buffer)[index * stride + STRIDE_INDEXES.SPECIES_ID] = id;
}

export function isAlive(buffer, index, stride) {
    return new Float32Array(buffer)[index * stride + STRIDE_INDEXES.DEAD] < 0.5;
}
export function kill(buffer, index, stride) {
    new Float32Array(buffer)[index * stride + STRIDE_INDEXES.DEAD] = 1.0;
}

export function getEnergy(buffer, index, stride) {
    return new Float32Array(buffer)[index * stride + STRIDE_INDEXES.ENERGY];
}
export function setEnergy(buffer, index, stride, energy) {
    new Float32Array(buffer)[index * stride + STRIDE_INDEXES.ENERGY] = energy;
}

export function getDNA(buffer, index, stride) {
    const view = new Float32Array(buffer);
    const base = index * stride + STRIDE_INDEXES.DNA_CACHE_START;
    const dna = [];
    for (let i = 0; i < 42; i++) dna.push(view[base + i]);
    return dna;
}
export function setDNA(buffer, index, stride, dnaArray) {
    const view = new Float32Array(buffer);
    const base = index * stride + STRIDE_INDEXES.DNA_CACHE_START;
    for (let i = 0; i < 42 && i < dnaArray.length; i++) view[base + i] = dnaArray[i];
}
