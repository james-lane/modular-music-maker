import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXAMPLE_PATCHES } from '../src/domain/examples';
import { MODULES } from '../src/domain/modules';
import type { Project } from '../src/domain/types';
import { parseProject } from '../src/domain/validation';

// Compare musical structure without the fresh UUIDs that every editable copy must receive.
function routingSignature(project: Project) {
  const type = (id: string) => project.modules.find((module) => module.id === id)!.type;
  return JSON.stringify({
    modules: project.modules.map((module) => module.type).sort(),
    routes: project.cables
      .map(
        (cable) =>
          `${type(cable.from.moduleId)}:${cable.from.portId}>${type(cable.to.moduleId)}:${cable.to.portId}`,
      )
      .sort(),
  });
}

test('seven distinct examples are valid, fully connected and laid out without covering another module', () => {
  assert.equal(EXAMPLE_PATCHES.length, 7);
  assert.equal(new Set(EXAMPLE_PATCHES.map((example) => example.id)).size, 7);
  const signatures = new Set<string>();
  for (const example of EXAMPLE_PATCHES) {
    const project = example.create();
    assert.equal(project.name, example.name);
    assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))), project);
    signatures.add(routingSignature(project));
    const output = project.modules.find((module) => module.type === 'output')!;
    assert.ok(output && Number(output.parameters.level) > 0, example.name);
    const reachesOutput = (id: string): boolean =>
      id === output.id ||
      project.cables.some(
        (cable) => cable.from.moduleId === id && reachesOutput(cable.to.moduleId),
      );
    for (const module of project.modules) {
      assert.ok(reachesOutput(module.id), `${example.name}: ${module.type} contributes to output`);
      const size = MODULES[module.type];
      assert.ok(Number.isFinite(module.x + size.width));
      assert.ok(Number.isFinite(module.y + size.height));
      for (const other of project.modules.filter((other) => other.id !== module.id)) {
        const otherSize = MODULES[other.type];
        assert.ok(
          module.x + size.width <= other.x ||
            other.x + otherSize.width <= module.x ||
            module.y + size.height <= other.y ||
            other.y + otherSize.height <= module.y,
          `${example.name}: ${module.type} overlaps ${other.type}`,
        );
      }
    }
  }
  assert.equal(signatures.size, 7, 'Each example teaches a different routing arrangement');
});

test('opening and editing an example cannot change its recipe or another saved copy', () => {
  const allIds = new Set<string>();
  for (const example of EXAMPLE_PATCHES) {
    const original = example.create();
    const snapshot = structuredClone(original);
    const edited = example.create();
    for (const project of [original, edited]) {
      for (const id of [
        project.id,
        ...project.modules.map((module) => module.id),
        ...project.cables.map((cable) => cable.id),
      ]) {
        assert.ok(!allIds.has(id), `${example.name}: IDs must not be reused`);
        allIds.add(id);
      }
    }
    for (const module of edited.modules) {
      if ('level' in module.parameters) module.parameters.level = 0;
      if (module.steps) module.steps.fill(-1);
      if (module.drumPattern) Object.values(module.drumPattern).forEach((lane) => lane.fill(false));
    }
    edited.name = 'My own version';
    assert.deepEqual(original, snapshot);
    const next = example.create();
    assert.equal(next.name, example.name);
    assert.deepEqual(
      next.modules.map((module) => module.parameters),
      snapshot.modules.map((module) => module.parameters),
    );
    assert.deepEqual(
      next.modules.map((module) => module.steps),
      snapshot.modules.map((module) => module.steps),
    );
    assert.deepEqual(
      next.modules.map((module) => module.drumPattern),
      snapshot.modules.map((module) => module.drumPattern),
    );
  }
});

test('the ensemble layers a shared-pitch voice, independent rhythms, and separate effects before combining buses', () => {
  const project = EXAMPLE_PATCHES.find((example) => example.id === 'clockwork-garden')!.create();
  assert.equal(project.modules.length, 23);
  const modules = (type: string) => project.modules.filter((module) => module.type === type);
  assert.equal(modules('sequencer').length, 3);
  assert.equal(modules('oscillator').length, 4);
  for (const type of ['drum-machine', 'delay', 'lfo', 'mixer', 'merger'])
    assert.equal(modules(type).length, 2, type);
  assert.equal(new Set(modules('sequencer').map((module) => JSON.stringify(module.steps))).size, 3);
  assert.equal(
    new Set(modules('drum-machine').map((module) => JSON.stringify(module.drumPattern))).size,
    2,
  );
  const split = modules('sequencer').find(
    (module) => project.cables.filter((cable) => cable.from.moduleId === module.id).length === 2,
  )!;
  assert(split, 'one sequence controls both oscillators of a layered voice');
  const layeredIds = project.cables
    .filter((cable) => cable.from.moduleId === split.id)
    .map((cable) => cable.to.moduleId);
  assert(
    modules('mixer').some(
      (mixer) =>
        project.cables.filter(
          (cable) => cable.to.moduleId === mixer.id && layeredIds.includes(cable.from.moduleId),
        ).length === 2,
    ),
  );
  const times = modules('delay')
    .map((module) => Number(module.parameters.time))
    .sort();
  assert(
    Math.abs(times[1] / times[0] - 1.5) < 0.0001,
    'eighth and dotted-eighth echoes have different jobs',
  );
  assert.equal(
    project.modules.some((module) => module.type === 'mic-sampler'),
    false,
    'the example sounds on Play without microphone permission or a user recording',
  );
});
