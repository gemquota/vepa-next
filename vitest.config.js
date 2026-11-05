import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        environment: 'node',
        testTimeout: 15000,
        // Physics tests share guarded world-parameter state; serial files make
        // ordering explicit and prevent cross-file races from changing results.
        fileParallelism: false,
        sequence: { shuffle: false },
    },
});
