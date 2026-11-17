import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUDIO_FACTORIES } from '../src/audio/factories';
import { PatchHistory } from '../src/domain/history';
import { MIXER_INPUT_COUNTS, moduleDefinition } from '../src/domain/modules';
import { setMixerInputCount } from '../src/domain/mixer';
import { connectionError, createModule, createProject } from '../src/domain/project';
import { parseProject } from '../src/domain/validation';

test('every Mixer channel count round-trips and exposes only its active audio sockets', () => {
  const mixer = createModule('mixer', 0, 0),
    source = createModule('noise', 900, 0);
  const project = { ...createProject(true), modules: [mixer, source] };
  for (const count of MIXER_INPUT_COUNTS) {
    const next = setMixerInputCount(project, mixer.id, count);
    assert.deepEqual(parseProject(next), next);
    const definition = moduleDefinition(next.modules[0]);
    assert.equal(definition.ports.length, count + 1);
    assert.equal(definition.controls.length, count);
    assert.equal(
      connectionError(
        next,
        { moduleId: source.id, portId: 'out' },
        { moduleId: mixer.id, portId: definition.controls[count - 1].id },
      ),
      null,
    );
  }
  assert.match(
    connectionError(
      project,
      { moduleId: source.id, portId: 'out' },
      { moduleId: mixer.id, portId: 'h' },
    )!,
    /no longer exists/,
  );
  for (const count of [1, 9, 2.5, '4', false]) {
    assert.equal(setMixerInputCount(project, mixer.id, count), project);
    assert.throws(() =>
      parseProject({
        ...project,
        modules: [{ ...mixer, parameters: { ...mixer.parameters, inputCount: count } }],
      }),
    );
  }
});

test('old Mixer patches keep A/B gains and positions; partial new configurations are rejected', () => {
  const mixer = { ...createModule('mixer', 40, 80), parameters: { a: 0.12, b: 0.83 } };
  const project = { ...createProject(true), modules: [mixer] },
    original = structuredClone(project);
  for (const version of [1, 2]) {
    const restored = parseProject({ ...project, version });
    assert.equal(restored.modules[0].parameters.inputCount, 2);
    assert.equal(restored.modules[0].parameters.a, 0.12);
    assert.equal(restored.modules[0].parameters.b, 0.83);
    assert.equal(restored.modules[0].x, 40);
    assert.deepEqual(parseProject(restored), restored);
  }
  assert.deepEqual(project, original);
  assert.throws(() =>
    parseProject({
      ...project,
      modules: [{ ...mixer, parameters: { ...mixer.parameters, c: 0.5 } }],
    }),
  );
  const configured = createModule('mixer', 0, 0);
  delete configured.parameters.h;
  assert.throws(() => parseProject({ ...project, modules: [configured] }));
});

test('Mixer resize removes only discarded input cables and Undo restores its routes and position', () => {
  const mixer = createModule('mixer', 0, 0),
    source = createModule('noise', 250, 0),
    output = createModule('output', 900, 0);
  const base = { ...createProject(true), modules: [mixer, source, output] };
  const expanded = setMixerInputCount(base, mixer.id, 8);
  assert.deepEqual(expanded.modules.slice(1), base.modules.slice(1));
  assert.notDeepEqual([expanded.modules[0].x, expanded.modules[0].y], [mixer.x, mixer.y]);
  const project = {
    ...expanded,
    cables: [
      {
        id: crypto.randomUUID(),
        from: { moduleId: source.id, portId: 'out' },
        to: { moduleId: mixer.id, portId: 'h' },
      },
      {
        id: crypto.randomUUID(),
        from: { moduleId: mixer.id, portId: 'out' },
        to: { moduleId: output.id, portId: 'in' },
      },
    ],
  };
  const history = new PatchHistory(project);
  history.commit((current) => setMixerInputCount(current, mixer.id, 2));
  assert.deepEqual(history.project.cables, project.cables.slice(1));
  assert.doesNotThrow(() => parseProject(history.project));
  history.undo();
  assert.deepEqual(history.project.modules, project.modules);
  assert.deepEqual(history.project.cables, project.cables);
});

test('Mixer gains stay independent, mute hidden channels, ramp changes and dispose all nodes', () => {
  const nodes: ReturnType<typeof node>[] = [];
  function node() {
    return {
      gain: {
        value: 1,
        ramps: [] as number[],
        setTargetAtTime(value: number) {
          this.value = value;
          this.ramps.push(value);
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
      const value = node();
      nodes.push(value);
      return value;
    },
  } as unknown as AudioContext;
  const runtime = AUDIO_FACTORIES.mixer(context, {} as AudioNode);
  const module = createModule('mixer', 0, 0);
  runtime.update({ ...module.parameters, inputCount: 8, c: 0.4, h: 0.9 });
  assert.equal(new Set(Object.values(runtime.inputs)).size, 8);
  assert.equal(nodes[3].gain.value, 0.4);
  assert.equal(nodes[8].gain.value, 0.9);
  runtime.update(module.parameters);
  assert.equal(nodes[1].gain.value, 0.7);
  assert.equal(nodes[2].gain.value, 0.7);
  assert(nodes.slice(3).every((input) => input.gain.value === 0 && input.gain.ramps.length === 2));
  runtime.dispose();
  assert(nodes.every((input) => input.connections.size === 0));
});
