import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PatchHistory } from '../src/domain/history';
import { setKeyboardKeyCount } from '../src/domain/keyboard';
import { KEYBOARD_KEY_COUNTS, moduleDefinition } from '../src/domain/modules';
import { createModule, createProject } from '../src/domain/project';
import { parseProject } from '../src/domain/validation';

test('Keyboard sizes validate and widen without narrowing keys or changing sockets', () => {
  const keyboard = createModule('keyboard', 0, 0);
  const project = { ...createProject(true), modules: [keyboard] };
  const original = moduleDefinition(keyboard);
  for (const count of KEYBOARD_KEY_COUNTS) {
    const next = setKeyboardKeyCount(project, keyboard.id, count);
    assert.deepEqual(parseProject(next), next);
    const definition = moduleDefinition(next.modules[0]);
    assert.equal(definition.width, original.width + ((count - 25) / 12) * 182);
    assert.equal(definition.height, original.height);
    assert.deepEqual(definition.ports, original.ports);
  }
  for (const count of [0, 24, 26, 36, 62, 25.5, '37', true]) {
    assert.equal(setKeyboardKeyCount(project, keyboard.id, count), project);
    assert.throws(() =>
      parseProject({
        ...project,
        modules: [{ ...keyboard, parameters: { ...keyboard.parameters, keyCount: count } }],
      }),
    );
  }
});

test('legacy Keyboards keep their keys, pitch settings and saved positions', () => {
  const keyboard = {
    ...createModule('keyboard', -400, 300),
    parameters: { octave: -1, velocity: 0.6 },
  };
  const project = { ...createProject(true), modules: [keyboard] },
    source = structuredClone(project);
  for (const version of [1, 2]) {
    const migrated = parseProject({ ...project, version });
    assert.deepEqual(migrated.modules[0], {
      ...keyboard,
      parameters: { ...keyboard.parameters, keyCount: 25 },
    });
    assert.deepEqual(parseProject(migrated), migrated);
  }
  assert.deepEqual(project, source);
});

test('Keyboard resize clears neighbours and Undo restores size/position while keeping pitch cables', () => {
  const keyboard = createModule('keyboard', 0, 0),
    oscillator = createModule('oscillator', 480, 0);
  const project = {
    ...createProject(true),
    modules: [keyboard, oscillator],
    cables: [
      {
        id: crypto.randomUUID(),
        from: { moduleId: keyboard.id, portId: 'pitch' },
        to: { moduleId: oscillator.id, portId: 'pitch' },
      },
    ],
  };
  const history = new PatchHistory(project);
  history.commit((current) => setKeyboardKeyCount(current, keyboard.id, 61));
  const resized = history.project.modules[0],
    size = moduleDefinition(resized),
    other = moduleDefinition(oscillator);
  assert(
    resized.x + size.width <= oscillator.x ||
      oscillator.x + other.width <= resized.x ||
      resized.y + size.height <= oscillator.y ||
      oscillator.y + other.height <= resized.y,
  );
  assert.deepEqual(history.project.modules[1], oscillator);
  assert.deepEqual(history.project.cables, project.cables);
  history.undo();
  assert.deepEqual(history.project.modules, project.modules);
  history.redo();
  assert.equal(history.project.modules[0].parameters.keyCount, 61);
  assert.deepEqual(parseProject(history.project), history.project);
});
