import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createModule, createProject } from '../src/domain/project';
import { parseProject } from '../src/domain/validation';

test('sequencer rates default to eighth notes and round-trip independently', () => {
  const project = createProject(true);
  for (const rate of ['1/4', '1/8', '1/16']) {
    const sequencer = createModule('sequencer', 0, 0);
    assert.equal(sequencer.parameters.rate, '1/8');
    sequencer.parameters.rate = rate;
    project.modules.push(sequencer);
  }
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))), project);
});

test('legacy v1/v2 sequencers migrate to eighth notes without changing the saved object', () => {
  for (const version of [1, 2]) {
    const sequencer = createModule('sequencer', 0, 0);
    delete sequencer.parameters.rate;
    const saved = { ...createProject(true), version, modules: [sequencer] };
    const original = structuredClone(saved);
    const restored = parseProject(saved);
    assert.equal(restored.version, 3);
    assert.deepEqual(restored.modules[0], {
      ...sequencer,
      parameters: { ...sequencer.parameters, rate: '1/8' },
    });
    assert.deepEqual(saved, original);
  }
});

test('explicit invalid sequencer rates are rejected rather than silently defaulted', () => {
  const sequencer = createModule('sequencer', 0, 0);
  for (const rate of ['1/2', '1/32', 'eighth', '', 8, true, null, undefined]) {
    assert.throws(() =>
      parseProject({
        ...createProject(true),
        modules: [
          {
            ...sequencer,
            parameters: { ...sequencer.parameters, rate },
          },
        ],
      }),
    );
  }
});
