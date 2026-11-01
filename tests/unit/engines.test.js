import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/eventBus.js';
import { PARTICLE_STRIDE, STRIDE_INDEXES } from '../../src/constants.js';
import { createInsightEngine, update as updateInsight, clusterTrend } from '../../src/engines/insightEngine.js';
import { createLineageTracker, trackBirth, trackDeath, getStats } from '../../src/engines/lineageTracker.js';
import { createTimelineEngine, snapshot as timelineSnapshot, scrub as timelineScrub, getTimeline, getLatest, clearTimeline } from '../../src/engines/timelineEngine.js';
import { createGoalEngine, update as updateGoal, setCurrentValue } from '../../src/engines/goalEngine.js';

describe('VEPA4 Insight Engine', () => {
    it('detects clusters of nearby particles', () => {
        const bus = new EventBus();
        const engine = createInsightEngine(bus, { scanInterval: 1, minClusterSize: 3, clusterRadius: 50 });
        const events = [];
        bus.on('cluster:detected', (data) => events.push(data));

        // 5 clustered particles + 1 isolated particle
        const view = new Float32Array(6 * PARTICLE_STRIDE);
        for (let i = 0; i < 5; i++) {
            const base = i * PARTICLE_STRIDE;
            view[base + STRIDE_INDEXES.POS_X] = 100 + i;
            view[base + STRIDE_INDEXES.POS_Y] = 100 + i;
            view[base + STRIDE_INDEXES.POS_Z] = 100;
            view[base + STRIDE_INDEXES.DEAD] = 0;
        }
        view[5 * PARTICLE_STRIDE + STRIDE_INDEXES.POS_X] = 500;
        view[5 * PARTICLE_STRIDE + STRIDE_INDEXES.POS_Y] = 500;
        view[5 * PARTICLE_STRIDE + STRIDE_INDEXES.POS_Z] = 500;

        updateInsight(engine, view, 6, PARTICLE_STRIDE, 1000);

        expect(events.length).toBe(1);
        const cluster = events[0].clusters[0];
        expect(cluster.count).toBeGreaterThanOrEqual(3);
        expect(cluster.center).toBeDefined();
    });

    it('tracks cluster growth trend', () => {
        const bus = new EventBus();
        const engine = createInsightEngine(bus, { scanInterval: 1, minClusterSize: 3, clusterRadius: 50 });
        const view = new Float32Array(6 * PARTICLE_STRIDE);
        for (let i = 0; i < 5; i++) {
            const base = i * PARTICLE_STRIDE;
            view[base + STRIDE_INDEXES.POS_X] = 100 + i;
            view[base + STRIDE_INDEXES.POS_Y] = 100 + i;
            view[base + STRIDE_INDEXES.POS_Z] = 100;
        }
        updateInsight(engine, view, 6, PARTICLE_STRIDE, 1000);
        updateInsight(engine, view, 6, PARTICLE_STRIDE, 1000);
        expect(clusterTrend(engine)).toBe(1);
    });
});

describe('VEPA4 Lineage Tracker', () => {
    it('records births, deaths, and lineage depth', () => {
        const bus = new EventBus();
        const engine = createLineageTracker(bus);
        const branches = [];
        bus.on('lineage:branch', (d) => branches.push(d));

        trackBirth(engine, -1, 0, 0, 0);   // seed
        trackBirth(engine, 0, 1, 0, 0);    // child of 0
        trackDeath(engine, 1, 'starvation');

        const stats = getStats(engine);
        expect(stats.totalBirths).toBe(2);
        expect(stats.totalDeaths).toBe(1);
        expect(stats.longestLineage).toBe(1);
        expect(branches.length).toBe(2);
    });
});

describe('VEPA4 Timeline Engine', () => {
    it('snapshots, lists, and scrubs state', () => {
        const bus = new EventBus();
        const engine = createTimelineEngine(bus, { maxSnapshots: 4 });
        const data = new Float32Array([1, 2, 3, 4]);

        timelineSnapshot(engine, data, { tick: 5, particleCount: 1 });
        timelineSnapshot(engine, new Float32Array([9, 9, 9, 9]), { tick: 10, particleCount: 1 });

        expect(getTimeline(engine)).toHaveLength(2);
        const entry = timelineScrub(engine, 0);
        expect(entry.data[0]).toBe(1);
        expect(getLatest(engine).metadata.tick).toBe(10);

        clearTimeline(engine);
        expect(getTimeline(engine)).toHaveLength(0);
    });
});

describe('VEPA4 Goal Engine', () => {
    it('emits adjustments toward complexity targets', () => {
        const bus = new EventBus();
        const engine = createGoalEngine(bus, { evaluationInterval: 1 });
        const adjustments = [];
        bus.on('goal:adjusted', (a) => adjustments.push(a));

        setCurrentValue(engine, 'maxForce', 50);
        updateGoal(engine, {
            populationAlive: 100,
            speciesAlive: 10,
            clusterCount: 2,
            avgEnergy: 50,
            frameDelta: 0,
            lawActiveCount: 10,
        });

        const maxForceAdj = adjustments.find((a) => a.parameter === 'maxForce');
        expect(maxForceAdj).toBeDefined();
        expect(maxForceAdj.newValue).toBeLessThan(maxForceAdj.oldValue);
    });
});
