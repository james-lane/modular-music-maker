import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createModuleDemo } from '../src/domain/module-demos';
import { MODULE_LIST, moduleDefinition } from '../src/domain/modules';
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
      const size = moduleDefinition(module);
      for (const other of project.modules.filter((other) => other.id !== module.id)) {
        const otherSize = moduleDefinition(other);
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
      if (module.switchCues) module.switchCues.forEach((cue) => (cue.input = 4));
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
  const midi = createModuleDemo('midi-input');
  assert.equal(midi.interaction, 'midi');
  assert.match(midi.instructions, /Test note/);
  assert(midi.project.cables.some((cable) => cable.from.portId === 'pitch'));
  assert(midi.project.cables.some((cable) => cable.from.portId === 'mod1'));
  const pads = createModuleDemo('pad-controller');
  assert.equal(pads.interaction, 'pads');
  assert.equal(
    pads.project.modules.find((module) => module.type === 'pad-controller')!.parameters.padCount,
    4,
  );
  assert(pads.project.cables.some((cable) => cable.from.portId === 'pad1'));
  assert(pads.project.cables.some((cable) => cable.from.portId === 'pad2'));
  assert(pads.project.modules.find((module) => module.type === 'mic-sampler')!.samples!.clip);
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

test('Sample & Hold compares independent clocked filter, pitch drift and pad-triggered sample paths', () => {
  const { project, interaction, instructions } = createModuleDemo('random-mod');
  const selector = project.modules.find((module) => module.type === 'switch')!;
  const modules = new Map(project.modules.map((module) => [module.id, module]));
  const source = (id: string, port: string) => {
    const cable = project.cables.find(
      (cable) => cable.to.moduleId === id && cable.to.portId === port,
    )!;
    return modules.get(cable.from.moduleId)!;
  };
  const filter = source(selector.id, 'in1'),
    tone = source(selector.id, 'in2'),
    sampler = source(selector.id, 'in3');
  const filterRandom = source(filter.id, 'cutoff'),
    pitchRandom = source(tone.id, 'pitchMod'),
    padRandom = source(sampler.id, 'rateMod');
  assert.equal(interaction, 'transport');
  assert.match(instructions, /Switch 1/);
  assert.equal(selector.parameters.automatic, false);
  assert.equal(selector.parameters.selected, 1);
  assert.equal(filter.type, 'filter');
  assert.equal(tone.type, 'oscillator');
  assert.equal(sampler.type, 'mic-sampler');
  assert(isValidSamplePcm(sampler.samples!.clip.pcm));
  assert.equal(new Set([filterRandom.id, pitchRandom.id, padRandom.id]).size, 3);
  assert([filterRandom, pitchRandom, padRandom].every((module) => module.type === 'random-mod'));
  assert(Number(pitchRandom.parameters.depth) < Number(filterRandom.parameters.depth) / 10);
  assert(Number(pitchRandom.parameters.glide) > Number(filterRandom.parameters.glide));
  assert.equal(source(padRandom.id, 'trigger').type, 'pad-controller');
  assert.equal(source(padRandom.id, 'trigger').parameters.padCount, 4);
  assert.equal(source(padRandom.id, 'trigger').id, source(sampler.id, 'trigger').id);
  assert(
    !project.cables.some(
      (cable) =>
        [filterRandom.id, pitchRandom.id].includes(cable.to.moduleId) &&
        cable.to.portId === 'trigger',
    ),
  );
  assert.equal(source(selector.id, 'in4').id, source(filter.id, 'in').id);
});
