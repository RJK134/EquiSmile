import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';
import {
  createSequenceGenerator,
  decideReplay,
  type QueuedRecord,
  type QueuedRequest,
} from '@/lib/offline/queue-replay';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// ---------------------------------------------------------------------------
// Offline request queue — store failed POST/PUT/PATCH requests in IndexedDB
// and replay them when the user is back online.
// ---------------------------------------------------------------------------

const QUEUE_DB_NAME = 'equismile-offline-queue';
const QUEUE_STORE_NAME = 'requests';

const nextSequence = createSequenceGenerator();

function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
        db.createObjectStore(QUEUE_STORE_NAME, { autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function enqueueRequest(url: string, options: RequestInit): Promise<void> {
  try {
    const db = await openQueueDB();
    const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const record: QueuedRequest = {
      url,
      method: options.method ?? 'POST',
      headers: Object.fromEntries(new Headers(options.headers).entries()),
      body: typeof options.body === 'string' ? options.body : null,
      sequence: nextSequence(),
      timestamp: Date.now(),
    };
    store.add(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('[SW] Failed to enqueue request', err);
  }
}

async function replayQueuedRequests(): Promise<void> {
  try {
    const db = await openQueueDB();
    const records = await readAllRecords(db);
    const decision = await decideReplay(records, async (req) =>
      fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body ?? undefined,
      }),
    );

    for (const key of decision.toDelete) {
      const deleteTx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
      deleteTx.objectStore(QUEUE_STORE_NAME).delete(key);
      await new Promise<void>((resolve, reject) => {
        deleteTx.oncomplete = () => resolve();
        deleteTx.onerror = () => reject(deleteTx.error);
      });
    }
  } catch (err) {
    console.error('[SW] Failed to replay queued requests', err);
  }
}

function readAllRecords(db: IDBDatabase): Promise<QueuedRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE_NAME, 'readonly');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const results: QueuedRecord[] = [];
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        results.push({ key: cursor.key, value: cursor.value as QueuedRequest });
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

// Listen for online event to replay queued requests
self.addEventListener('message', (event) => {
  if (event.data?.type === 'REPLAY_QUEUE') {
    replayQueuedRequests();
  }
});

// Intercept failed mutation requests and queue them for later
self.addEventListener('fetch', (event: FetchEvent) => {
  const { method } = event.request;
  // Only queue mutation requests
  if (!['POST', 'PUT', 'PATCH'].includes(method)) return;
  // Don't queue external API calls
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request.clone()).catch(async () => {
      const body = await event.request.text();
      await enqueueRequest(event.request.url, {
        method,
        headers: Object.fromEntries(event.request.headers.entries()),
        body,
      });
      return new Response(
        JSON.stringify({ queued: true, message: 'Request queued for when you are back online' }),
        { status: 202, headers: { 'Content-Type': 'application/json' } },
      );
    }),
  );
});
