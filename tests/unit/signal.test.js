import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES, DNA_INDEXES, LAW_INDEXES } from '../../src/constants.js';
import { createLawState, set } from '../../src/state/lawState.js';
import { setBuffer, applySignalDecay, applySignalExchange } from '../../src/physics/laws.js';

const S = STRIDE_INDEXES;
const D = DNA_INDEXES;

/** Build a particle with a full DNA cache, defaulting comm params. */
function makeParticle(view, index, comm) {
    const base = index * PARTICLE_STRIDE;
    const defaults = {
        SIGNAL_RESP: 0, PULSE_RATE: 0.2, NEIGHBORHOOD_RADIUS: 120, SIGNAL_STRENGTH: 0.5,
        SIGNAL_DECAY: 0.95, PROPAGATION_SPEED: 0.5, TUNING_CH1: 1, TUNING_CH2: 1,
        TUNING_CH3: 1, TUNING_CH4: 1, MEMORY_DECAY: 0.99,
    };
    const merged = { ...defaults, ...comm };
    const DNA_CACHE = S.DNA_CACHE_START;
    for (const [name, value] of Object.entries(merged)) {
        view[base + DNA_CACHE + D[name]] = value;
    }
    view[base + S.SIGNAL] = 0;
    view[base + S.MEMORY] = 0;
    view[base + S.ENERGY] = 50;
    view[base + S.AGE] = 0;
    view[base + S.DEAD] = 0;
}

describe('VEPA4 Signal System', () => {
    it('emits oscillator pulses and decays when idle', () => {
        const view = new Float32Array(1 * PARTICLE_STRIDE);
        makeParticle(view, 0, { PULSE_RATE: 0.5, SIGNAL_STRENGTH: 1.0, SIGNAL_DECAY: 0.95 });
        const lawState = createLawState();
        set(lawState, LAW_INDEXES.COMMS);
        setBuffer(view);

        const dna = [];
        for (let d = 0; d < 42; d++) dna.push(view[0 * PARTICLE_STRIDE + S.DNA_CACHE_START + d]);

        // After many ticks the signal accumulates above zero
        let signal = 0;
        for (let t = 0; t < 200; t++) {
            view[S.AGE] = t;
            applySignalDecay(lawState, view, 0, dna, 0.25);
            signal = view[S.SIGNAL];
        }
        expect(signal).toBeGreaterThan(0);
        expect(signal).toBeLessThanOrEqual(1);
    });

    it('propagates signal to a tuned receiver with response force', () => {
        const view = new Float32Array(2 * PARTICLE_STRIDE);
        makeParticle(view, 0, { SIGNAL_STRENGTH: 1.0 });        // sender
        makeParticle(view, 1, { SIGNAL_RESP: 2.0, PROPAGATION_SPEED: 0.5 }); // receiver
        const lawState = createLawState();
        set(lawState, LAW_INDEXES.COMMS);
        setBuffer(view);

        view[0 * PARTICLE_STRIDE + S.SIGNAL] = 0.8; // sender emits
        view[1 * PARTICLE_STRIDE + S.POS_X] = 10;   // receiver 10 units away

        const dnaI = [];
        const dnaJ = [];
        for (let d = 0; d < 42; d++) {
            dnaI.push(view[0 * PARTICLE_STRIDE + S.DNA_CACHE_START + d]);
            dnaJ.push(view[1 * PARTICLE_STRIDE + S.DNA_CACHE_START + d]);
        }

        const force = applySignalExchange(lawState, view, 0, 1 * PARTICLE_STRIDE, 10, 0, 0, 10, dnaI, dnaJ, 1.0);

        expect(force).not.toBeNull();
        expect(view[1 * PARTICLE_STRIDE + S.SIGNAL]).toBeGreaterThan(0);
        expect(view[1 * PARTICLE_STRIDE + S.MEMORY]).toBeGreaterThan(0);
        // Batch-14 confirmed: the sender pays the emission cost, receivers
        // gain no free energy.
        expect(view[0 * PARTICLE_STRIDE + S.ENERGY]).toBeLessThan(50);
        expect(view[1 * PARTICLE_STRIDE + S.ENERGY]).toBe(50);
    });

    it('filters signals that do not match tuning channels', () => {
        const view = new Float32Array(2 * PARTICLE_STRIDE);
        makeParticle(view, 0, { SIGNAL_STRENGTH: 1.0, TUNING_CH1: 0, TUNING_CH2: 1, TUNING_CH3: 1, TUNING_CH4: 1 });
        makeParticle(view, 1, { SIGNAL_RESP: 2.0, PROPAGATION_SPEED: 0.5, TUNING_CH1: 1, TUNING_CH2: 0, TUNING_CH3: 0, TUNING_CH4: 0 });
        const lawState = createLawState();
        set(lawState, LAW_INDEXES.COMMS);
        setBuffer(view);

        view[0 * PARTICLE_STRIDE + S.SIGNAL] = 0.8;
        view[1 * PARTICLE_STRIDE + S.POS_X] = 10;
        const before = view[1 * PARTICLE_STRIDE + S.SIGNAL];

        const dnaI = [];
        const dnaJ = [];
        for (let d = 0; d < 42; d++) {
            dnaI.push(view[0 * PARTICLE_STRIDE + S.DNA_CACHE_START + d]);
            dnaJ.push(view[1 * PARTICLE_STRIDE + S.DNA_CACHE_START + d]);
        }

        const force = applySignalExchange(lawState, view, 0, 1 * PARTICLE_STRIDE, 10, 0, 0, 10, dnaI, dnaJ, 1.0);

        expect(force).toBeNull();
        expect(view[1 * PARTICLE_STRIDE + S.SIGNAL]).toBe(before);
    });
});
