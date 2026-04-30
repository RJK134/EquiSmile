import { describe, it, expect } from 'vitest';
import {
  createSequenceGenerator,
  decideReplay,
  sortBySequence,
  type QueuedRecord,
  type QueuedRequest,
} from '@/lib/offline/queue-replay';

function record(key: number, sequence: number, overrides: Partial<QueuedRequest> = {}): QueuedRecord {
  return {
    key,
    value: {
      url: '/api/visit-requests',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      sequence,
      timestamp: 1700000000000,
      ...overrides,
    },
  };
}

function jsonResponse(status: number): Response {
  return new Response(null, { status });
}

describe('createSequenceGenerator', () => {
  it('issues strictly monotonic numbers within the same millisecond', () => {
    const next = createSequenceGenerator(() => 1700000000000);
    const a = next();
    const b = next();
    const c = next();
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('rolls forward when the clock advances', () => {
    let tick = 1700000000000;
    const next = createSequenceGenerator(() => tick);
    const first = next();
    tick = 1700000000001;
    const second = next();
    expect(second).toBeGreaterThan(first);
  });

  it('keeps sequences unique across rapid same-millisecond enqueues', () => {
    const next = createSequenceGenerator(() => 1700000000000);
    const seen = new Set<number>();
    for (let i = 0; i < 100; i += 1) seen.add(next());
    expect(seen.size).toBe(100);
  });
});

describe('sortBySequence', () => {
  it('orders records by explicit sequence ascending', () => {
    const out = sortBySequence([record(3, 30), record(1, 10), record(2, 20)]);
    expect(out.map((r) => r.value.sequence)).toEqual([10, 20, 30]);
  });

  it('puts legacy records (missing sequence) after sequenced ones', () => {
    const legacy: QueuedRecord = { key: 1, value: { ...record(1, 10).value, sequence: undefined as unknown as number } };
    const fresh = record(2, 20);
    const out = sortBySequence([legacy, fresh]);
    expect(out[0]).toBe(fresh);
    expect(out[1]).toBe(legacy);
  });

  it('falls back to IDB key for stable ordering on equal sequences', () => {
    const out = sortBySequence([record(7, 5), record(3, 5), record(5, 5)]);
    expect(out.map((r) => r.key)).toEqual([3, 5, 7]);
  });

  it('does not mutate its input', () => {
    const input = [record(2, 20), record(1, 10)];
    const snapshot = input.map((r) => r.key);
    sortBySequence(input);
    expect(input.map((r) => r.key)).toEqual(snapshot);
  });
});

describe('decideReplay', () => {
  it('drops successful records and continues through the queue', async () => {
    const records = [record(1, 10), record(2, 20), record(3, 30)];
    const decision = await decideReplay(records, async () => jsonResponse(201));
    expect(decision.toDelete).toEqual([1, 2, 3]);
    expect(decision.toKeep).toEqual([]);
    expect(decision.abortedOffline).toBe(false);
  });

  it('aborts the loop when fetcher throws (assumed offline) and keeps every record', async () => {
    const records = [record(1, 10), record(2, 20), record(3, 30)];
    const decision = await decideReplay(records, async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(decision.toDelete).toEqual([]);
    expect(decision.toKeep).toEqual([1, 2, 3]);
    expect(decision.abortedOffline).toBe(true);
  });

  it('continues past 5xx errors but keeps the failed record for retry', async () => {
    const records = [record(1, 10), record(2, 20), record(3, 30)];
    let call = 0;
    const decision = await decideReplay(records, async () => {
      call += 1;
      return call === 2 ? jsonResponse(503) : jsonResponse(200);
    });
    expect(decision.toDelete).toEqual([1, 3]);
    expect(decision.toKeep).toEqual([2]);
    expect(decision.abortedOffline).toBe(false);
  });

  it('drops 4xx responses (server has rejected; replay will not change outcome)', async () => {
    const records = [record(1, 10), record(2, 20)];
    const decision = await decideReplay(records, async () => jsonResponse(400));
    expect(decision.toDelete).toEqual([1, 2]);
    expect(decision.toKeep).toEqual([]);
    expect(decision.abortedOffline).toBe(false);
  });

  it('replays in submission order even if records arrive out of insertion order', async () => {
    const records = [record(3, 30), record(1, 10), record(2, 20)];
    const seenSequences: number[] = [];
    await decideReplay(records, async (req) => {
      seenSequences.push(req.sequence);
      return jsonResponse(201);
    });
    expect(seenSequences).toEqual([10, 20, 30]);
  });

  it('keeps trailing records after a fetch throw without attempting them', async () => {
    const records = [record(1, 10), record(2, 20), record(3, 30)];
    const attempts: number[] = [];
    let call = 0;
    const decision = await decideReplay(records, async (req) => {
      call += 1;
      attempts.push(req.sequence);
      if (call === 2) throw new Error('network down');
      return jsonResponse(200);
    });
    expect(attempts).toEqual([10, 20]);
    expect(decision.toDelete).toEqual([1]);
    expect(decision.toKeep).toEqual([2, 3]);
    expect(decision.abortedOffline).toBe(true);
  });
});
