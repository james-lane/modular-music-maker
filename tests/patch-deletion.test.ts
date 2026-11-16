import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIG } from '../src/config';
import { createProject } from '../src/domain/project';
import {
  deleteLocally,
  listAllProjects,
  loadActiveProject,
  loadProjects,
  saveLocally,
  saveToServer,
  syncDeletedProjects,
} from '../src/domain/storage';

function fixture() {
  const keys = ['localStorage', 'navigator', 'window', 'fetch'];
  const originals = new Map(
    keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const entries = new Map<string, string>();
  const requests: { url: string; method: string }[] = [];
  const state = {
    online: false,
    hostname: 'patchwork.example',
    failKey: '',
    maxBytes: Infinity,
    serverProject: createProject(),
    health: true,
  };
  Object.defineProperties(globalThis, {
    localStorage: {
      configurable: true,
      value: {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (key === state.failKey) throw new Error('Blocked storage');
          const bytes = [...entries].reduce(
            (sum, [name, stored]) => sum + (name === key ? 0 : stored.length),
            value.length,
          );
          if (bytes > state.maxBytes) throw new Error('Storage full');
          entries.set(key, value);
        },
        removeItem: (key: string) => entries.delete(key),
      },
    },
    navigator: {
      configurable: true,
      value: {
        get onLine() {
          return state.online;
        },
      },
    },
    window: {
      configurable: true,
      value: {
        location: {
          get hostname() {
            return state.hostname;
          },
        },
      },
    },
    fetch: {
      configurable: true,
      value: async (url: string, init?: RequestInit) => {
        requests.push({ url, method: init?.method ?? 'GET' });
        if (url === '/api/health')
          return Response.json({ application: state.health ? 'patchwork' : 'other' });
        if (init?.method === 'DELETE') return new Response(null, { status: 204 });
        return Response.json([state.serverProject]);
      },
    },
  });
  return {
    entries,
    requests,
    state,
    restore() {
      for (const [key, value] of originals)
        if (value) Object.defineProperty(globalThis, key, value);
        else Reflect.deleteProperty(globalThis, key);
    },
  };
}

test('deleting another patch keeps the active patch, removes embedded data and prevents stale saves from reviving it', async () => {
  const f = fixture();
  try {
    const removed = createProject(),
      active = createProject();
    saveLocally(removed);
    saveLocally(active);
    deleteLocally(removed.id);
    assert.deepEqual(loadProjects(), [active]);
    assert.equal(loadActiveProject()!.id, active.id);
    assert(!f.entries.get(CONFIG.storageKey)!.includes(removed.id));
    assert.throws(() => saveLocally(removed), /deleted/);
    assert.equal(await saveToServer(removed), false);
    await syncDeletedProjects();
    assert.equal(f.requests.length, 0);
  } finally {
    f.restore();
  }
});

test('deleting the open or not-yet-autosaved patch commits a fresh empty replacement and clears the deleted ID', () => {
  const f = fixture();
  try {
    const previous = createProject();
    saveLocally(previous);
    const notSaved = createProject(),
      replacement = createProject(true);
    deleteLocally(notSaved.id, replacement);
    assert.equal(loadActiveProject()!.id, replacement.id);
    assert(loadProjects().some((project) => project.id === previous.id));
    assert.throws(() => saveLocally(notSaved));
    deleteLocally(replacement.id);
    assert.equal(loadActiveProject(), undefined);
    assert.throws(() => deleteLocally(previous.id, previous));
  } finally {
    f.restore();
  }
});

test('failed deletion writes roll back the library, active pointer and deleted-ID set', () => {
  const f = fixture();
  try {
    const project = createProject();
    saveLocally(project);
    const before = new Map(f.entries);
    f.state.failKey = CONFIG.storageKey;
    assert.throws(() => deleteLocally(project.id, createProject(true)));
    assert.deepEqual(f.entries, before);
    assert.equal(loadActiveProject()!.id, project.id);
    f.state.failKey = CONFIG.deletedProjectsKey;
    assert.throws(() => deleteLocally(project.id));
    assert.deepEqual(f.entries, before);
    f.state.failKey = CONFIG.activeProjectKey;
    assert.throws(() => deleteLocally(project.id, createProject(true)));
    assert.deepEqual(f.entries, before);
  } finally {
    f.restore();
  }
});

test('offline/public deletion avoids APIs and later loopback sync removes file copies even if a stale server list returns them', async () => {
  const f = fixture();
  try {
    const project = f.state.serverProject;
    saveLocally(project);
    deleteLocally(project.id);
    f.state.online = true;
    await syncDeletedProjects();
    assert.equal(f.requests.length, 0);
    f.state.hostname = '127.0.0.1';
    f.state.health = false;
    await syncDeletedProjects();
    assert(f.requests.every((request) => request.url === '/api/health'));
    f.requests.length = 0;
    f.state.health = true;
    assert.deepEqual(await listAllProjects(), []);
    assert.deepEqual(f.requests, [
      { url: '/api/health', method: 'GET' },
      { url: `/api/projects/${project.id}`, method: 'DELETE' },
      { url: '/api/projects', method: 'GET' },
    ]);
    assert.deepEqual(loadProjects(), []);
    // A write from an older open app may ignore tombstones; the new app still hides it.
    f.entries.set(CONFIG.storageKey, JSON.stringify([project]));
    assert.deepEqual(loadProjects(), []);
  } finally {
    f.restore();
  }
});

test('deleting a full-library patch frees payload space before storing its tombstone and blank replacement', () => {
  const f = fixture();
  try {
    const project = createProject();
    saveLocally(project);
    f.state.maxBytes = [...f.entries.values()].reduce((sum, value) => sum + value.length, 0);
    const replacement = createProject(true);
    deleteLocally(project.id, replacement);
    assert.equal(loadActiveProject()!.id, replacement.id);
    assert.equal(loadProjects().length, 1);
    assert(f.entries.get(CONFIG.deletedProjectsKey)!.includes(project.id));
  } finally {
    f.restore();
  }
});
