import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { transformWithEsbuild } from 'vite';

interface WorkerMessage {
  data: { type: string };
  source: { id: string };
  ports: { postMessage: (value: unknown) => void }[];
  waitUntil: (promise: Promise<unknown>) => void;
}

async function workerHarness(clientIds: string[], complete = true) {
  const listeners = new Map<string, (event: WorkerMessage) => void>();
  let activations = 0;
  const source = await readFile(new URL('../src/offline/worker.ts', import.meta.url), 'utf8');
  const compiled = await transformWithEsbuild(source, 'worker.ts', { format: 'iife' });
  vm.runInNewContext(compiled.code, {
    URL,
    PRECACHE_ASSETS: ['/', '/assets/studio.js'],
    CACHE_NAME: 'patchwork-shell-test',
    caches: { open: async () => ({ match: async () => (complete ? {} : undefined) }) },
    self: {
      location: { origin: 'https://patchwork.test' },
      addEventListener: (name: string, listener: (event: WorkerMessage) => void) =>
        listeners.set(name, listener),
      clients: { matchAll: async () => clientIds.map((id) => ({ id })) },
      skipWaiting: async () => {
        activations++;
      },
    },
  });
  return {
    activations: () => activations,
    send: async (type: string, source = 'requesting-window') => {
      let reply: unknown;
      let pending: Promise<unknown> | undefined;
      listeners.get('message')?.({
        data: { type },
        source: { id: source },
        ports: [
          {
            postMessage: (value) => {
              reply = value;
            },
          },
        ],
        waitUntil: (promise) => {
          pending = promise;
        },
      });
      await pending;
      return JSON.parse(JSON.stringify(reply)) as unknown;
    },
  };
}

test('updates activate only on explicit request from the sole studio window', async () => {
  const worker = await workerHarness(['requesting-window']);
  assert.deepEqual(await worker.send('PATCHWORK_OFFLINE_STATUS'), { ready: true });
  assert.equal(worker.activations(), 0);
  assert.deepEqual(await worker.send('PATCHWORK_APPLY_UPDATE'), { ready: true });
  assert.equal(worker.activations(), 1);
});

test('updating cannot replace another open window’s worker or an incomplete release', async () => {
  for (const clients of [['requesting-window', 'performing-window'], ['other-window'], []]) {
    const worker = await workerHarness(clients);
    assert.deepEqual(await worker.send('PATCHWORK_APPLY_UPDATE'), {
      ready: false,
      reason: 'other-windows',
    });
    assert.equal(worker.activations(), 0);
  }
  const incomplete = await workerHarness(['requesting-window'], false);
  assert.deepEqual(await incomplete.send('PATCHWORK_APPLY_UPDATE'), {
    ready: false,
    reason: 'incomplete',
  });
  assert.equal(incomplete.activations(), 0);
});
