import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXAMPLE_PATCHES } from '../src/domain/examples';
import { createModuleDemo } from '../src/domain/module-demos';
import { MODULE_LIST } from '../src/domain/modules';
import { createProject } from '../src/domain/project';
import { ProjectPersistence } from '../src/domain/project-persistence';
import { loadActiveProject, loadProjects, saveLocally } from '../src/domain/storage';
import { parseProject } from '../src/domain/validation';

function storage() {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const entries = new Map<string, string>();
  const state = { fail: false, writes: 0 };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (state.fail) throw new Error('Storage unavailable');
        state.writes++;
        entries.set(key, value);
      },
    },
  });
  return {
    state,
    restore() {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    },
  };
}

test('all example and guide demos stay out of the library and active pointer through automatic flushes and edits', () => {
  const f = storage();
  try {
    const session = new ProjectPersistence(saveLocally);
    const original = createProject(true);
    session.open(original);
    assert(session.flush(original));
    const saved = loadProjects();
    const writes = f.state.writes;
    const demos = [
      createProject(),
      ...EXAMPLE_PATCHES.map((example) => example.create()),
      ...MODULE_LIST.map(({ type }) => createModuleDemo(type).project),
    ];
    for (const demo of demos) {
      session.open(demo, true);
      const edited = { ...demo, name: 'Edited demo', tempo: 123 };
      assert.equal(session.flush(demo), false);
      assert.equal(session.flush(edited), false, 'autosave, switches and pagehide share this gate');
      assert.deepEqual(loadProjects(), saved);
      assert.equal(loadActiveProject()?.id, original.id);
    }
    assert.equal(f.state.writes, writes, 'temporary editing never writes the browser library');
    session.open(original);
    session.flush({ ...original, name: 'My next edit' });
    assert.equal(loadActiveProject()?.name, 'My next edit');
  } finally {
    f.restore();
  }
});

test('explicit Save keeps the latest demo under its own identity and enables ordinary autosave/reload', () => {
  const f = storage();
  try {
    const session = new ProjectPersistence(saveLocally);
    const original = createProject(true);
    session.flush(original);
    const demo = createModuleDemo('mic-sampler').project;
    session.open(demo, true);
    const edited = { ...demo, name: 'My clap experiment', tempo: 137 };
    session.save(edited);
    assert.equal(session.isTemporary(edited), false);
    assert.deepEqual(loadActiveProject(), edited);
    assert(loadProjects().some((project) => project.id === original.id));
    assert(edited.modules.some((module) => module.samples?.clip));

    const furtherEdit = { ...edited, tempo: 142 };
    assert(session.flush(furtherEdit));
    const restored = loadActiveProject();
    assert(restored);
    assert.deepEqual(restored, parseProject(JSON.parse(JSON.stringify(furtherEdit))));
    const reopened = new ProjectPersistence(saveLocally);
    reopened.open(restored);
    assert.equal(reopened.isTemporary(restored), false);
    assert(reopened.flush(restored));
    assert.equal('temporary' in restored, false, 'session metadata never enters portable data');
  } finally {
    f.restore();
  }
});

test('a failed explicit Save leaves the demo temporary and a successful retry promotes it', () => {
  const f = storage();
  try {
    const session = new ProjectPersistence(saveLocally);
    const original = createProject(true);
    session.flush(original);
    const demo = EXAMPLE_PATCHES[0].create();
    session.open(demo, true);
    f.state.fail = true;
    assert.equal(
      session.flush(demo),
      false,
      'automatic demo saves do not touch unavailable storage',
    );
    assert.throws(() => session.save(demo), /Storage unavailable/);
    assert(session.isTemporary(demo));
    assert.equal(loadActiveProject()?.id, original.id);
    assert.deepEqual(
      loadProjects().map(({ id }) => id),
      [original.id],
    );
    f.state.fail = false;
    session.save(demo);
    assert.equal(session.isTemporary(demo), false);
    assert.equal(loadActiveProject()?.id, demo.id);
  } finally {
    f.restore();
  }
});
