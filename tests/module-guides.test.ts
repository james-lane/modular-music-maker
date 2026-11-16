import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MODULE_GUIDES, compatiblePorts } from '../src/domain/module-guides';
import { MODULE_LIST } from '../src/domain/modules';
import { connectionError, createModule, createProject } from '../src/domain/project';
import type { ModuleType } from '../src/domain/types';
import { parseProject } from '../src/domain/validation';

test('every guide explains the current controls without leaving stale or missing control IDs', () => {
  for (const definition of MODULE_LIST) {
    const guide = MODULE_GUIDES[definition.type];
    assert.ok(guide.overview && guide.steps.length && guide.tip, definition.name);
    assert.deepEqual(
      Object.keys(guide.controls).sort(),
      definition.controls.map((control) => control.id).sort(),
      definition.name,
    );
    assert.ok(Object.values(guide.controls).every((description) => description.trim().length > 0));
  }
});

test('compatibility guidance separates live pitch, drum triggers, modulation and audible sources', () => {
  const endpoints = (type: ModuleType, port: string) =>
    compatiblePorts(type, port).map((match) => `${match.module}:${match.port.id}`);
  assert.deepEqual(endpoints('keyboard', 'pitch'), ['oscillator:pitch', 'envelope:gate']);
  assert.deepEqual(endpoints('pad-controller', 'trigger'), [
    'drum-machine:trigger',
    'mic-sampler:trigger',
    'envelope:trigger',
    'random-mod:trigger',
  ]);
  assert.deepEqual(endpoints('lfo', 'out'), [
    'mic-sampler:rateMod',
    'mic-sampler:levelMod',
    'oscillator:pitchMod',
    'filter:cutoff',
  ]);
  const audioSources = endpoints('output', 'in');
  assert.ok(audioSources.includes('drum-machine:out'));
  assert.ok(audioSources.includes('oscillator:out'));
  assert.ok(!audioSources.some((endpoint) => /keyboard|pad-controller|lfo/.test(endpoint)));
  assert.deepEqual(endpoints('keyboard', 'missing-socket'), []);
});

test('every worked example contains its subject and forms a valid, saveable patch', () => {
  for (const definition of MODULE_LIST) {
    const example = MODULE_GUIDES[definition.type].example;
    const types = [
      ...new Set(
        example.connections.flatMap((connection) => [connection.from.module, connection.to.module]),
      ),
    ];
    assert.ok(types.includes(definition.type), definition.name);
    const modules = new Map(types.map((type) => [type, createModule(type, 40, 40)]));
    const project = { ...createProject(true), modules: [...modules.values()] };
    for (const connection of example.connections) {
      const from = {
        moduleId: modules.get(connection.from.module)!.id,
        portId: connection.from.port,
      };
      const to = { moduleId: modules.get(connection.to.module)!.id, portId: connection.to.port };
      assert.equal(
        connectionError(project, from, to),
        null,
        `${definition.name}: ${example.title}`,
      );
      project.cables.push({ id: crypto.randomUUID(), from, to });
    }
    assert.doesNotThrow(() => parseProject(project), definition.name);
  }
});
