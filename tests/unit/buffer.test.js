import { describe, it, expect } from 'vitest';
import { createParticleBuffer, getX, getY, getZ, setX, setY, getMass, setMass, getSpeciesId, setSpeciesId, isAlive, kill, getEnergy, setEnergy } from '../../src/state/particleBuffer.js';
import { PARTICLE_STRIDE, STRIDE_INDEXES } from '../../src/constants.js';

describe('ParticleBuffer', () => {
    it('creates buffer with correct size', () => {
        const { buffer, view } = createParticleBuffer(100, PARTICLE_STRIDE);
        expect(buffer).toBeInstanceOf(SharedArrayBuffer);
        expect(view).toBeInstanceOf(Float32Array);
        expect(view.length).toBe(100 * PARTICLE_STRIDE);
    });

    it('set/get position', () => {
        const { buffer } = createParticleBuffer(10, PARTICLE_STRIDE);
        setX(buffer, 0, PARTICLE_STRIDE, 123.45);
        setY(buffer, 0, PARTICLE_STRIDE, 678.90);
        expect(getX(buffer, 0, PARTICLE_STRIDE)).toBeCloseTo(123.45, 2);
        expect(getY(buffer, 0, PARTICLE_STRIDE)).toBeCloseTo(678.90, 2);
    });

    it('set/get mass', () => {
        const { buffer } = createParticleBuffer(10, PARTICLE_STRIDE);
        setMass(buffer, 2, PARTICLE_STRIDE, 5.5);
        expect(getMass(buffer, 2, PARTICLE_STRIDE)).toBeCloseTo(5.5, 2);
    });

    it('set/get species', () => {
        const { buffer } = createParticleBuffer(10, PARTICLE_STRIDE);
        setSpeciesId(buffer, 3, PARTICLE_STRIDE, 4);
        expect(getSpeciesId(buffer, 3, PARTICLE_STRIDE)).toBe(4);
    });

    it('isAlive/kill', () => {
        const { buffer, view } = createParticleBuffer(10, PARTICLE_STRIDE);
        // Default is 0 (alive)
        expect(isAlive(buffer, 0, PARTICLE_STRIDE)).toBe(true);
        kill(buffer, 0, PARTICLE_STRIDE);
        expect(isAlive(buffer, 0, PARTICLE_STRIDE)).toBe(false);
    });

    it('set/get energy', () => {
        const { buffer } = createParticleBuffer(10, PARTICLE_STRIDE);
        setEnergy(buffer, 5, PARTICLE_STRIDE, 75.0);
        expect(getEnergy(buffer, 5, PARTICLE_STRIDE)).toBeCloseTo(75.0, 2);
    });

    it('particle isolation', () => {
        const { buffer } = createParticleBuffer(10, PARTICLE_STRIDE);
        setX(buffer, 0, PARTICLE_STRIDE, 10);
        setX(buffer, 1, PARTICLE_STRIDE, 20);
        expect(getX(buffer, 0, PARTICLE_STRIDE)).toBeCloseTo(10, 2);
        expect(getX(buffer, 1, PARTICLE_STRIDE)).toBeCloseTo(20, 2);
    });
});
