import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createModuleDemo } from '../src/domain/module-demos';
import { MODULE_LIST, MODULES } from '../src/domain/modules';
import { MODULE_GUIDES } from '../src/domain/module-guides';
import { parseProject } from '../src/domain/validation';
import { isValidSamplePcm } from '../src/domain/samples';

/** These are the same factories used by Load demo patch, never testing-only recipes. */
test('every guide loads a valid, fully connected, non-overlapping demo containing its module', () => {
  for (const definition of MODULE_LIST) {
    const { project, instructions } = createModuleDemo(definition.type);
    assert.equal(project.name, `${definition.name} demo`);
    assert(project.modules.some((module) => module.type === definition.type));
    assert.equal(project.cables.length, MODULE_GUIDES[definition.type].example.connections.length);
    assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))), project);
    assert(instructions.length > 20);
    const output = project.modules.find((module) => module.type === 'output')!;
    assert(output);
    const reachesOutput = (id: string): boolean =>
      id === output.id ||
      project.cables.some(
        (cable) => cable.from.moduleId === id && reachesOutput(cable.to.moduleId),
      );
    for (const module of project.modules) {
      assert(reachesOutput(module.id), `${definition.name}: ${module.type} reaches Output`);
      const size = MODULES[module.type];
      for (const other of project.modules.filter((other) => other.id !== module.id)) {
        const otherSize = MODULES[other.type];
        assert(
          module.x + size.width <= other.x ||
            other.x + otherSize.width <= module.x ||
            module.y + size.height <= other.y ||
            other.y + otherSize.height <= module.y,
          `${definition.name}: ${module.type} overlaps ${other.type}`,
        );
      }
    }
  }
});

test('demo copies have fresh IDs and independent editable notes, parameters and sample maps', () => {
  const ids = new Set<string>();
  for (const definition of MODULE_LIST) {
    const first = createModuleDemo(definition.type).project;
    const second = createModuleDemo(definition.type).project;
    const snapshot = structuredClone(first);
    for (const project of [first, second])
      for (const id of [
        project.id,
        ...project.modules.map((module) => module.id),
        ...project.cables.map((cable) => cable.id),
      ]) {
        assert(!ids.has(id));
        ids.add(id);
      }
    for (const module of second.modules) {
      module.parameters.level = 0;
      module.steps?.fill(-1);
      if (module.drumPattern)
        Object.values(module.drumPattern).forEach((steps) => steps.fill(false));
      if (module.samples) for (const sample of Object.values(module.samples)) sample.pcm = 'AAAA';
    }
    assert.deepEqual(first, snapshot);
    const next = createModuleDemo(definition.type).project;
    assert.deepEqual(
      next.modules.map((module) => module.parameters),
      snapshot.modules.map((module) => module.parameters),
    );
    assert.deepEqual(
      next.modules.map((module) => module.samples),
      snapshot.modules.map((module) => module.samples),
    );
  }
});

test('demos select cabled kit voices, preload local sampler audio and declare their live gestures', () => {
  const kitDemo = createModuleDemo('drum-kit');
  assert.equal(
    kitDemo.project.modules.find((module) => module.type === 'drum-kit')!.parameters['closed-hat'],
    'input',
  );
  const sampler = createModuleDemo('mic-sampler');
  assert.equal(sampler.interaction, 'pads');
  const clip = sampler.project.modules.find((module) => module.type === 'mic-sampler')!.samples!
    .clip;
  assert(isValidSamplePcm(clip.pcm));
  assert.equal(createModuleDemo('envelope').interaction, 'keyboard');
  assert.equal(createModuleDemo('keyboard').interaction, 'keyboard');
  assert.equal(createModuleDemo('reverb').interaction, 'keyboard');
  for (const type of [
    'mod-sequencer',
    'random-mod',
    'xy-controller',
    'oscillator',
    'noise',
  ] as const)
    assert.equal(createModuleDemo(type).interaction, 'transport');
  const merger = createModuleDemo('merger');
  assert.equal(merger.project.modules.find((module) => module.type === 'delay')!.parameters.mix, 1);
});
