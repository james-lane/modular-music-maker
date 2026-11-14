import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MODULE_LIST } from '../src/domain/modules';
import {
  connectionError,
  createModule,
  createProject,
  noteLabel,
  stepFrequency,
} from '../src/domain/project';
import { parseProject } from '../src/domain/validation';

test('the starter patch survives a JSON round trip and is fully routed to output', () => {
  const project = createProject();
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))), project);
  assert.equal(project.cables.length, 4);
  const output = project.modules.find((module) => module.type === 'output')!;
  assert.ok(project.cables.some((cable) => cable.to.moduleId === output.id));
});

test('every catalog module has valid defaults and globally unique port IDs', () => {
  for (const definition of MODULE_LIST) {
    const project = createProject(true);
    project.modules = [createModule(definition.type, 40, 40)];
    assert.doesNotThrow(() => parseProject(project), definition.name);
    assert.equal(new Set(definition.ports.map((port) => port.id)).size, definition.ports.length);
  }
});

test('connection validation rejects type mismatches, occupied inputs and feedback cycles', () => {
  const project = createProject();
  const oscillator = project.modules.find((module) => module.type === 'oscillator')!;
  const filter = project.modules.find((module) => module.type === 'filter')!;
  const delay = project.modules.find((module) => module.type === 'delay')!;
  assert.match(
    connectionError(
      project,
      { moduleId: oscillator.id, portId: 'out' },
      { moduleId: filter.id, portId: 'cutoff' },
    )!,
    /Match socket types/,
  );
  assert.match(
    connectionError(
      project,
      { moduleId: oscillator.id, portId: 'out' },
      { moduleId: filter.id, portId: 'in' },
    )!,
    /already has a cable/,
  );
  const graph = {
    ...project,
    cables: project.cables.filter((cable) => cable.to.moduleId !== filter.id),
  };
  assert.match(
    connectionError(
      graph,
      { moduleId: delay.id, portId: 'out' },
      { moduleId: filter.id, portId: 'in' },
    )!,
    /feedback loop/,
  );
});

test('untrusted patch files cannot supply unknown modules, dangerous parameter ranges or duplicate IDs', () => {
  const project = createProject();
  const outOfRange = structuredClone(project);
  outOfRange.modules.find((module) => module.type === 'delay')!.parameters.feedback = 100;
  assert.throws(() => parseProject(outOfRange));
  assert.throws(() =>
    parseProject({ ...project, modules: [...project.modules, project.modules[0]] }),
  );
  assert.throws(() => parseProject({ ...project, tempo: Number.NaN }));
  assert.throws(() => parseProject({ ...project, version: 2 }));
  assert.throws(() =>
    parseProject({ ...project, modules: [{ ...project.modules[0], type: 'untrusted-plugin' }] }),
  );
});

test('import validation also checks dangling cables and graph cycles', () => {
  const project = createProject();
  project.cables[0].to.moduleId = crypto.randomUUID();
  assert.throws(() => parseProject(project));
  const cycle = createProject();
  const filter = cycle.modules.find((module) => module.type === 'filter')!;
  const delay = cycle.modules.find((module) => module.type === 'delay')!;
  cycle.cables = [
    {
      id: crypto.randomUUID(),
      from: { moduleId: filter.id, portId: 'out' },
      to: { moduleId: delay.id, portId: 'in' },
    },
    {
      id: crypto.randomUUID(),
      from: { moduleId: delay.id, portId: 'out' },
      to: { moduleId: filter.id, portId: 'in' },
    },
  ];
  assert.throws(() => parseProject(cycle));
});

test('scale degrees produce musical notes, octave changes, and named rests', () => {
  const project = createProject();
  assert.equal(noteLabel(project, 0), 'C3');
  assert.equal(noteLabel(project, 2), 'D♯3');
  assert.equal(noteLabel(project, 7), 'C4');
  assert.equal(noteLabel(project, -1), '—');
  assert.ok(Math.abs(stepFrequency(project, 0, 1) / stepFrequency(project, 0) - 2) < 0.0001);
  assert.equal(noteLabel({ ...project, scale: 'major' }, 2), 'E3');
});
