/**
 * Pure helpers for the offline-mutation queue used by `app/sw.ts`.
 *
 * Kept free of IndexedDB / Service Worker globals so the ordering and
 * replay decisions can be unit-tested directly. The service worker
 * remains the only caller in production; tests exercise these
 * functions with plain arrays.
 */

export interface QueuedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  sequence: number;
  timestamp: number;
}

export interface QueuedRecord {
  /** IndexedDB key — opaque to the replay logic. */
  key: IDBValidKey;
  value: QueuedRequest;
}

export type ReplayFetcher = (req: QueuedRequest) => Promise<Response>;

export interface ReplayDecision {
  /** Records that completed successfully and should be deleted. */
  toDelete: IDBValidKey[];
  /** Records that should remain in the queue for the next replay. */
  toKeep: IDBValidKey[];
  /** True if the replay terminated because the network appears offline. */
  abortedOffline: boolean;
}

/**
 * Build a monotonic sequence generator. The high bits encode wall-clock
 * time so sequences stay roughly comparable across service-worker
 * restarts; the low bits resolve same-millisecond ties.
 *
 * Tests inject a deterministic clock; production callers pass `Date.now`.
 */
export function createSequenceGenerator(now: () => number = Date.now): () => number {
  let lastTick = 0;
  let counter = 0;
  return () => {
    const tick = now();
    if (tick === lastTick) {
      counter += 1;
    } else {
      lastTick = tick;
      counter = 0;
    }
    return tick * 1000 + (counter % 1000);
  };
}

/**
 * Order queued records by their explicit `sequence` field, falling
 * back to insertion order (IDB key) if a legacy record predates the
 * sequence rollout.
 */
export function sortBySequence(records: QueuedRecord[]): QueuedRecord[] {
  return [...records].sort((a, b) => {
    const aSeq = typeof a.value.sequence === 'number' ? a.value.sequence : Number.MAX_SAFE_INTEGER;
    const bSeq = typeof b.value.sequence === 'number' ? b.value.sequence : Number.MAX_SAFE_INTEGER;
    if (aSeq !== bSeq) return aSeq - bSeq;
    // Stable fallback: compare IDB keys when both have the same sequence
    // or both are legacy. IDB autoIncrement keys are numeric.
    if (typeof a.key === 'number' && typeof b.key === 'number') return a.key - b.key;
    return 0;
  });
}

/**
 * Replay queued mutations in submission order.
 *
 * Decision matrix:
 *  - `fetcher` resolves with a 2xx/3xx response → record is dropped.
 *  - `fetcher` resolves with a 4xx response → record is dropped (the
 *    server has rejected the payload; replaying will not change the
 *    outcome and a permanently-stuck record would block nothing else
 *    if we kept it, but it would burn cycles forever).
 *  - `fetcher` resolves with a 5xx response → record is kept and the
 *    loop continues to the next record (transient server error,
 *    retry on the next replay).
 *  - `fetcher` throws → assumed offline; loop aborts and every
 *    remaining record is kept with its sequence intact.
 */
export async function decideReplay(
  records: QueuedRecord[],
  fetcher: ReplayFetcher,
): Promise<ReplayDecision> {
  const ordered = sortBySequence(records);
  const toDelete: IDBValidKey[] = [];
  const toKeep: IDBValidKey[] = [];
  let abortedOffline = false;

  for (let i = 0; i < ordered.length; i += 1) {
    const { key, value } = ordered[i];
    if (abortedOffline) {
      toKeep.push(key);
      continue;
    }
    try {
      const response = await fetcher(value);
      if (response.status >= 500) {
        toKeep.push(key);
      } else {
        toDelete.push(key);
      }
    } catch {
      abortedOffline = true;
      toKeep.push(key);
    }
  }

  return { toDelete, toKeep, abortedOffline };
}
