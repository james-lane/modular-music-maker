import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIG } from '../src/config';
import { historyShortcut, PatchHistory } from '../src/domain/history';
import { createModule, createProject } from '../src/domain/project';
import type { Project } from '../src/domain/types';
import { parseProject } from '../src/domain/validation';

const tempo = (value: number) => (project: Project) => ({ ...project, tempo: value });
const content = ({ updatedAt: _, ...project }: Project) => project;

test('undo and redo restore whole patches without modifying earlier snapshots', () => {
  const initial = createProject();
  const original = structuredClone(initial);
  const history = new PatchHistory(initial);
  assert.equal(history.undo(), false);
  assert.equal(history.redo(), false);
  history.commit(tempo(120));
  const second = history.project;
  history.commit((project) => ({ ...project, name: 'New title', masterVolume: 0.2 }));
  const third = history.project;
  assert.equal(history.canUndo, true);
  assert.equal(history.canRedo, false);
  history.undo();
  assert.deepEqual(content(history.project), content(second));
  history.undo();
  assert.deepEqual(content(history.project), content(initial));
  assert.equal(history.canUndo, false);
  history.redo();
  history.redo();
  assert.deepEqual(content(history.project), content(third));
  assert.deepEqual(initial, original);
  assert.equal(history.canRedo, false);
});

test('unchanged controls and equivalent nested data preserve both history and the redo branch', () => {
  const history = new PatchHistory(createProject());
  assert.equal(
    history.commit((project) => structuredClone(project)),
    false,
  );
  assert.equal(history.canUndo, false);
  history.commit(tempo(120));
  history.undo();
  const before = history.project;
  assert.equal(
    history.commit((project) => project),
    false,
  );
  assert.equal(
    history.commit((project) => ({ ...project, tempo: project.tempo })),
    false,
  );
  assert.equal(
    history.commit((project) => ({ ...project, modules: structuredClone(project.modules) })),
    false,
  );
  assert.equal(history.project, before);
  assert.equal(history.canRedo, true);
  history.redo();
  assert.equal(history.project.tempo, 120);
});

test('timed typing groups end after inactivity or another control changes', () => {
  const history = new PatchHistory(createProject());
  const initial = history.project;
  history.commit(tempo(110), 'tempo', 1000);
  history.endInteraction(); // Ordinary keyups must not break timed text grouping.
  history.commit(tempo(111), 'tempo', 1100);
  history.commit(tempo(112), 'tempo', 1101 + CONFIG.historyGroupDelayMs);
  history.commit((project) => ({ ...project, name: 'Separate field' }), 'name', 1900);
  history.undo();
  assert.equal(history.project.tempo, 112);
  history.undo();
  assert.equal(history.project.tempo, 111);
  history.undo();
  assert.deepEqual(content(history.project), content(initial));
});

test('one slow gesture is one undo step, and separate fast gestures remain independent', () => {
  const history = new PatchHistory(createProject());
  const initial = history.project;
  history.beginInteraction();
  history.commit(tempo(120), 'tempo', 1000);
  history.commit(tempo(140), 'tempo', 10000);
  history.endInteraction();
  history.beginInteraction();
  history.commit(tempo(150), 'tempo', 10001);
  history.endInteraction();
  history.undo();
  assert.equal(history.project.tempo, 140);
  history.undo();
  assert.deepEqual(content(history.project), content(initial));
  history.redo();
  assert.equal(history.project.tempo, 140);
});

test('native sliders and held adjustment keys group edits without an explicit control key', () => {
  const history = new PatchHistory(createProject());
  const initial = history.project.masterVolume;
  history.beginInteraction();
  for (const masterVolume of [0.4, 0.3, 0.2]) {
    history.commit((project) => ({ ...project, masterVolume }));
  }
  history.endInteraction();
  history.undo();
  assert.equal(history.project.masterVolume, initial);
  assert.equal(history.canUndo, false);
  history.redo();
  assert.equal(history.project.masterVolume, 0.2);
});

test('a fresh edit after undo or redo never joins the restored edit and discards abandoned redo', () => {
  const history = new PatchHistory(createProject());
  const initial = history.project.tempo;
  history.commit(tempo(120), 'tempo', 1000);
  history.commit(tempo(130), 'tempo', 1100 + CONFIG.historyGroupDelayMs);
  history.undo();
  history.redo();
  history.commit(tempo(140), 'tempo', 1101 + CONFIG.historyGroupDelayMs);
  history.undo();
  assert.equal(history.project.tempo, 130);
  history.undo();
  assert.equal(history.project.tempo, 120);
  history.commit(tempo(150), 'tempo');
  assert.equal(history.canRedo, false);
  history.undo();
  assert.equal(history.project.tempo, 120);
  history.undo();
  assert.equal(history.project.tempo, initial);
});

test('history retains the configured number of edits and can redo the retained range', () => {
  const history = new PatchHistory(createProject());
  for (let index = 1; index <= CONFIG.historyLimit + 5; index++) {
    history.commit((project) => ({ ...project, name: `Edit ${index}` }));
  }
  let undos = 0;
  while (history.undo()) undos++;
  assert.equal(undos, CONFIG.historyLimit);
  assert.equal(history.project.name, 'Edit 5');
  let redos = 0;
  while (history.redo()) redos++;
  assert.equal(redos, CONFIG.historyLimit);
  assert.equal(history.project.name, `Edit ${CONFIG.historyLimit + 5}`);
});

test('opening a patch resets both stacks and grouping, including during a drag', () => {
  const history = new PatchHistory(createProject());
  history.beginInteraction();
  history.commit(tempo(120), 'tempo', 1000);
  history.commit((project) => ({ ...project, name: 'Another edit' }));
  history.undo();
  const next = createProject(true);
  history.open(next);
  assert.equal(history.project, next);
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
  history.commit(tempo(130), 'tempo', 1001);
  history.undo();
  assert.deepEqual(content(history.project), content(next));
});

test('module removal restores its settings, position and attached cables atomically', () => {
  const initial = createProject();
  const removed = initial.modules.find((module) => module.type === 'filter')!;
  const history = new PatchHistory(initial);
  history.commit((project) => ({
    ...project,
    modules: project.modules.filter((module) => module.id !== removed.id),
    cables: project.cables.filter(
      (cable) => cable.from.moduleId !== removed.id && cable.to.moduleId !== removed.id,
    ),
  }));
  assert.doesNotThrow(() => parseProject(history.project));
  history.undo();
  assert.deepEqual(content(history.project), content(initial));
  assert.doesNotThrow(() => parseProject(history.project));
  history.redo();
  assert.equal(
    history.project.modules.some((module) => module.id === removed.id),
    false,
  );
});

test('sample replacement and trim return together while PCM stays in immutable snapshots', () => {
  const sampler = createModule('mic-sampler', -40, 200);
  sampler.samples = { clip: { name: 'Original', pcm: 'AAAAAA==' } };
  sampler.parameters.trimStart = 0.25;
  sampler.parameters.trimEnd = 0.75;
  const initial = { ...createProject(true), modules: [sampler] };
  const history = new PatchHistory(initial);
  history.commit((project) => ({
    ...project,
    modules: project.modules.map((module) => ({
      ...module,
      samples: { clip: { name: 'Replacement', pcm: 'AQABAA==' } },
      parameters: { ...module.parameters, trimStart: 0, trimEnd: 1 },
    })),
  }));
  history.undo();
  assert.equal(history.project.modules[0], sampler);
  assert.deepEqual(content(history.project), content(initial));
  history.redo();
  assert.equal(history.project.modules[0].samples?.clip.name, 'Replacement');
  assert.equal(history.project.modules[0].parameters.trimStart, 0);
  assert.equal(sampler.samples.clip.name, 'Original');
});

test('history shortcuts support Cmd/Ctrl Z, Shift Z and Ctrl Y without intercepting composition', () => {
  const base = {
    key: 'z',
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    isComposing: false,
  };
  assert.equal(historyShortcut(base), null);
  assert.equal(historyShortcut({ ...base, metaKey: true }), 'undo');
  assert.equal(historyShortcut({ ...base, ctrlKey: true }), 'undo');
  assert.equal(historyShortcut({ ...base, key: 'Z', metaKey: true, shiftKey: true }), 'redo');
  assert.equal(historyShortcut({ ...base, ctrlKey: true, shiftKey: true }), 'redo');
  assert.equal(historyShortcut({ ...base, ctrlKey: true, key: 'y' }), 'redo');
  assert.equal(historyShortcut({ ...base, metaKey: true, key: 'y' }), null);
  assert.equal(historyShortcut({ ...base, ctrlKey: true, altKey: true }), null);
  assert.equal(historyShortcut({ ...base, ctrlKey: true, isComposing: true }), null);
});
