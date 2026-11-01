import { describe, it, expect } from 'vitest';
import { createGrid, clear, insert, getNeighbors } from '../../src/physics/spatialGrid.js';
import { computeSynergy } from '../../src/physics/synergy.js';
import { createLawState, set } from '../../src/state/lawState.js';
import { LAW_INDEXES } from '../../src/constants.js';

describe('SpatialGrid', () => {
    it('creates grid with correct structure', () => {
        const grid = createGrid();
        expect(grid).toHaveProperty('cellSize');
        expect(grid).toHaveProperty('cells');
    });

    it('insert and retrieve neighbors', () => {
        const grid = createGrid();
        const worldSize = 800;
        insert(grid, 0, 100, 100, 0, worldSize);
        insert(grid, 1, 110, 110, 0, worldSize);
        insert(grid, 2, 700, 700, 0, worldSize);
        const out = new Int32Array(100);
        const count = getNeighbors(grid, 100, 100, 0, worldSize, out);
        const found = Array.from(out.slice(0, count));
        expect(found).toContain(0);
        expect(found).toContain(1);
    });

    it('clear empties all cells', () => {
        const grid = createGrid();
        insert(grid, 0, 100, 100, 0, 800);
        clear(grid);
        const out = new Int32Array(100);
        const count = getNeighbors(grid, 100, 100, 0, 800, out);
        expect(count).toBe(0);
    });
});

describe('Synergy', () => {
    it('returns 1.0 when no laws active', () => {
        const state = createLawState();
        const mult = computeSynergy(state, LAW_INDEXES.GRAV);
        expect(mult).toBe(1.0);
    });

    it('GRAV + PLANETARY synergy', () => {
        const state = createLawState();
        set(state, LAW_INDEXES.GRAV);
        set(state, LAW_INDEXES.PLANETARY);
        const mult = computeSynergy(state, LAW_INDEXES.GRAV);
        expect(mult).toBeGreaterThan(1.0);
    });

    it('CHAOS + ORDER cancel each other', () => {
        const state = createLawState();
        set(state, LAW_INDEXES.CHAOS);
        set(state, LAW_INDEXES.ORDER);
        const chaosMult = computeSynergy(state, LAW_INDEXES.CHAOS);
        expect(chaosMult).toBeLessThan(1.0);
    });
});
