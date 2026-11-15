import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUDIO_FACTORIES } from '../src/audio/factories';
import { compatiblePorts } from '../src/domain/module-guides';
import { createModule, createProject, connectionError } from '../src/domain/project';
import { parseProject } from '../src/domain/validation';
import type { Endpoint, Project } from '../src/domain/types';

function connect(project: Project, from: Endpoint, to: Endpoint) {
  assert.equal(connectionError(project, from, to), null);
  project.cables.push({ id: crypto.randomUUID(), from, to });
}

test('a merger accepts four independent audio cables, chains, and preserves gains through saving', () => {
  const merger = createModule('merger', 700, 60);
  const next = createModule('merger', 1060, 60);
  const sources = (['oscillator', 'noise', 'drum-machine', 'delay'] as const).map((type) =>
    createModule(type, 40, 40),
  );
  const project = createProject(true);
  project.modules.push(merger, next, ...sources);
  const input = (portId: string) => ({ moduleId: merger.id, portId });
  sources.forEach((source, index) =>
    connect(project, { moduleId: source.id, portId: 'out' }, input(`in${index + 1}`)),
  );
  connect(project, { moduleId: merger.id, portId: 'out' }, { moduleId: next.id, portId: 'in4' });
  connect(
    project,
    { moduleId: next.id, portId: 'out' },
    { moduleId: project.modules[0].id, portId: 'in' },
  );
  merger.parameters.level = 0.37;
  Object.assign(merger.parameters, { in1: 0, in2: 0.25, in3: 0.6, in4: 1 });
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))), project);
  assert.match(
    connectionError(project, { moduleId: sources[0].id, portId: 'out' }, input('in1'))!,
    /already has a cable/,
  );
  assert.match(
    connectionError(project, { moduleId: next.id, portId: 'out' }, input('in5'))!,
    /no longer exists/,
  );
  project.cables = project.cables.filter(
    (cable) => cable.to.moduleId !== merger.id || cable.to.portId !== 'in1',
  );
  assert.match(
    connectionError(project, { moduleId: next.id, portId: 'out' }, input('in1'))!,
    /feedback loop/,
  );
  assert.ok(compatiblePorts('merger', 'in1').every((match) => match.port.signal === 'audio'));
  const keyboard = createModule('keyboard', 40, 40);
  project.modules.push(keyboard);
  assert.match(
    connectionError(project, { moduleId: keyboard.id, portId: 'pitch' }, input('in1'))!,
    /Match socket types/,
  );
});

test('legacy mergers retain their mix without mutating saved v1/v2 patches', () => {
  for (const version of [1, 2]) {
    const project = createProject(true);
    const merger = createModule('merger', 40, 40);
    merger.parameters = { level: 0.37 };
    project.modules.push(merger);
    const saved = { ...project, version };
    const original = structuredClone(saved);
    const restored = parseProject(saved);
    assert.deepEqual(restored.modules[1].parameters, {
      level: 0.37,
      in1: 1,
      in2: 1,
      in3: 1,
      in4: 1,
    });
    assert.deepEqual(saved, original);
  }
});

test('merger validation rejects incomplete or invalid input levels', () => {
  const project = createProject(true);
  const merger = createModule('merger', 40, 40);
  project.modules.push(merger);
  for (const input of ['in1', 'in2', 'in3', 'in4']) {
    for (const value of [-0.01, 1.01, Number.NaN, '0.5', undefined]) {
      const parameters = { ...merger.parameters, [input]: value };
      if (value === undefined) delete parameters[input];
      assert.throws(() =>
        parseProject({
          ...project,
          modules: [project.modules[0], { ...merger, parameters }],
        }),
      );
    }
  }
});

test('merger inputs and sum ramp independently and disposal releases every node', () => {
  // Only spy on ownership and endpoints; live browser checks verify real audible summing.
  const nodes: ReturnType<typeof makeNode>[] = [];
  function makeNode() {
    return {
      gain: {
        value: 1,
        ramps: [] as number[],
        setTargetAtTime(target: number) {
          this.value = target;
          this.ramps.push(target);
        },
      },
      connections: new Set<unknown>(),
      connect(target: unknown) {
        this.connections.add(target);
      },
      disconnect() {
        this.connections.clear();
      },
    };
  }
  const context = {
    currentTime: 0,
    createGain() {
      const node = makeNode();
      nodes.push(node);
      return node;
    },
  } as unknown as AudioContext;
  const runtime = AUDIO_FACTORIES.merger(context, {} as AudioNode);
  assert.deepEqual(Object.keys(runtime.inputs), ['in1', 'in2', 'in3', 'in4']);
  assert.equal(new Set(Object.values(runtime.inputs)).size, 4);
  assert.ok(Object.values(runtime.inputs).every((input) => input !== runtime.outputs.out));
  const output = runtime.outputs.out as unknown as ReturnType<typeof makeNode>;
  for (const input of Object.values(runtime.inputs)) {
    assert.ok((input as unknown as ReturnType<typeof makeNode>).connections.has(output));
  }
  runtime.update({ in1: 1, in2: 0.75, in3: 0.5, in4: 0.25, level: 0.5 });
  assert.equal(output.gain.value, 0.5);
  const inputs = Object.values(runtime.inputs) as unknown as ReturnType<typeof makeNode>[];
  assert.deepEqual(
    inputs.map((input) => input.gain.value),
    [1, 0.75, 0.5, 0.25],
  );
  runtime.update({ in1: 0, in2: 0.75, in3: 0.5, in4: 0.25, level: 0.5 });
  assert.deepEqual(
    inputs.map((input) => input.gain.value),
    [0, 0.75, 0.5, 0.25],
  );
  assert.equal(output.gain.value, 0.5, 'muting one input does not change the sum or other inputs');
  runtime.update({ in1: 0, in2: 0.75, in3: 0.5, in4: 0.25, level: 0 });
  assert.equal(output.gain.value, 0);
  assert.deepEqual(output.gain.ramps, [0.5, 0.5, 0]);
  assert.deepEqual(
    inputs.map((input) => input.gain.ramps),
    [
      [1, 0, 0],
      [0.75, 0.75, 0.75],
      [0.5, 0.5, 0.5],
      [0.25, 0.25, 0.25],
    ],
  );
  runtime.dispose();
  assert.ok(nodes.every((node) => node.connections.size === 0));
});
