import assert from 'node:assert/strict';
import test from 'node:test';
import { CONFIG } from '../src/config';
import { createProject } from '../src/domain/project';
import { listAllProjects, saveLocally, saveToServer } from '../src/domain/storage';

test('offline and public installs save and list patches without any API requests', async () => {
  const originals = new Map(
    ['localStorage', 'navigator', 'window', 'fetch'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const entries = new Map<string, string>();
  const project = createProject();
  let online = false;
  let hostname = '127.0.0.1';
  const requests: string[] = [];
  let healthApplication = 'not-patchwork';
  try {
    Object.defineProperties(globalThis, {
      localStorage: {
        configurable: true,
        value: {
          getItem: (key: string) => entries.get(key) ?? null,
          setItem: (key: string, value: string) => entries.set(key, value),
        },
      },
      navigator: {
        configurable: true,
        value: {
          get onLine() {
            return online;
          },
        },
      },
      window: {
        configurable: true,
        value: {
          location: {
            get hostname() {
              return hostname;
            },
          },
        },
      },
      fetch: {
        configurable: true,
        value: async (url: string) => {
          requests.push(url);
          return Response.json(
            url === '/api/health'
              ? { application: healthApplication }
              : url === '/api/projects'
                ? []
                : project,
          );
        },
      },
    });
    saveLocally(project);
    assert.equal(await saveToServer(project), false);
    assert.deepEqual(await listAllProjects(), [project]);
    online = true;
    hostname = 'patchwork.example';
    assert.equal(await saveToServer(project), false);
    assert.deepEqual(await listAllProjects(), [project]);
    assert.deepEqual(requests, []);
    assert.equal(entries.get(CONFIG.activeProjectKey), project.id);

    hostname = 'localhost';
    assert.equal(await saveToServer(project), false);
    assert.deepEqual(requests, ['/api/health']);
    healthApplication = 'patchwork';
    assert.equal(await saveToServer(project), true);
    assert.deepEqual(await listAllProjects(), [project]);
    assert.deepEqual(requests.slice(1), [
      '/api/health',
      `/api/projects/${project.id}`,
      '/api/health',
      '/api/projects',
    ]);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
