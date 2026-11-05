import { describe, expect, it } from 'vitest';
import {
  analyzeSystems,
  closeSystemRecord,
  createSystemLifecycle,
  createSystemRecord,
  deriveSystemEvidence,
  getSystemPhaseStatus,
  recordSystemEvent,
  restoreSystemLifecycle,
  serializeSystemLifecycle,
  updateSystemRecord,
} from '../../src/state/systemLifecycle.js';

describe('system lifecycle substrate', () => {
  it('supports durable records and explicit causal events for every system', () => {
    const lifecycle = createSystemLifecycle({ eventCap: 8 });
    const record = createSystemRecord(lifecycle, 'family-kinship', 'family-a', { confidence: 0.8 });
    expect(record.id).toBe('family-kinship:1');
    expect(updateSystemRecord(lifecycle, record.id, { attributes: { members: 3 } }).attributes.members).toBe(3);
    expect(recordSystemEvent(lifecycle, record.id, 'care', { amount: 2 }).type).toBe('care');
    expect(getSystemPhaseStatus(lifecycle, 'family-kinship').phaseThree).toBe('complete');
  });

  it('derives emergence without changing the source implementation status', () => {
    const lifecycle = createSystemLifecycle();
    const record = createSystemRecord(lifecycle, 'civilization', 'civ-a', { confidence: 1 });
    recordSystemEvent(lifecycle, record.id, 'infrastructure');
    recordSystemEvent(lifecycle, record.id, 'trade');
    recordSystemEvent(lifecycle, record.id, 'epoch');
    const evidence = deriveSystemEvidence(lifecycle, 'civilization');
    expect(evidence.phase).toBe(4);
    expect(evidence.regime).toBe('stable-pattern');
    expect(analyzeSystems(lifecycle, 'civilization')[0].implementationEvidence).toBe('proxy');
  });

  it('closes records and round-trips bounded state', () => {
    const lifecycle = createSystemLifecycle();
    const record = createSystemRecord(lifecycle, 'species-lineage', 'species-a');
    closeSystemRecord(lifecycle, record.id, 'extinction');
    const restored = restoreSystemLifecycle(serializeSystemLifecycle(lifecycle));
    expect(restored.records.get(record.id).status).toBe('closed');
    expect(restored.events).toHaveLength(0);
    expect(analyzeSystems(restored)).toHaveLength(12);
  });

  it('rejects unknown systems and caps records/events', () => {
    const lifecycle = createSystemLifecycle({ recordCap: 1, eventCap: 1 });
    expect(() => createSystemRecord(lifecycle, 'unknown', 'x')).toThrow('Unknown system');
    const first = createSystemRecord(lifecycle, 'ecology', 'a');
    const second = createSystemRecord(lifecycle, 'ecology', 'b');
    recordSystemEvent(lifecycle, second.id, 'metric');
    recordSystemEvent(lifecycle, second.id, 'metric');
    expect(lifecycle.records.has(first.id)).toBe(false);
    expect(lifecycle.events).toHaveLength(1);
  });
});
