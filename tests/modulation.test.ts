import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createEnvelope,
  createModSequencer,
  createRandomMod,
  createXYController,
  boundedModulation,
} from '../src/audio/modulation';
import { MODULES } from '../src/domain/modules';
import { createModule, createProject, connectionError } from '../src/domain/project';
import { parseProject } from '../src/domain/validation';
import type { ModuleType } from '../src/domain/types';
import { EXAMPLE_PATCHES } from '../src/domain/examples';

class Parameter {
  value = 0;
  events: { kind: string; value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: 'set', value, time });
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: 'ramp', value, time });
  }
  setTargetAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: 'target', value, time });
  }
  cancelAndHoldAtTime(time: number) {
    this.events.push({ kind: 'hold', value: this.value, time });
  }
  cancelScheduledValues(time: number) {
    this.events.push({ kind: 'cancel', value: this.value, time });
  }
}
class Node {
  offset = new Parameter();
  gain = new Parameter();
  curve?: Float32Array;
  connections = new Set<Node>();
  stopped = false;
  connect(target: Node) {
    this.connections.add(target);
  }
  disconnect() {
    this.connections.clear();
  }
  start() {}
  stop() {
    this.stopped = true;
  }
}
function fixture() {
  const nodes: Node[] = [];
  const create = () => {
    const node = new Node();
    nodes.push(node);
    return node;
  };
  const context = {
    currentTime: 0,
    createGain: create,
    createConstantSource: create,
    createWaveShaper: create,
  };
  return { nodes, context, audio: context as unknown as AudioContext };
}

test('envelopes anchor attack, hold and release on the audio clock, and retrigger from their actual scheduled value', () => {
  const f = fixture();
  const runtime = createEnvelope(f.audio);
  runtime.update({ attack: 0.1, release: 0.2, depth: 1 });
  runtime.gate!(true, 0.8, 1);
  runtime.gate!(false, 0, 1.5);
  const sets = f.nodes[0].offset.events.filter((event) => event.kind === 'set');
  assert.deepEqual(
    sets.map(({ value, time }) => [value, time]),
    [
      [0, 1],
      [1200, 1.5],
    ],
  );
  runtime.gate!(true, 1, 1.6);
  assert.ok(
    Math.abs(f.nodes[0].offset.events.filter((event) => event.kind === 'set').at(-1)!.value - 600) <
      1e-8,
  );
  f.context.currentTime = 2;
  runtime.trigger!('kick', 1, 2);
  assert.ok(Math.abs(runtime.remainingTailSeconds!() - 0.3) < 1e-9);
  runtime.silence!();
  assert.equal(f.nodes[0].offset.value, 0);
  runtime.dispose();
  assert.ok(f.nodes.every((node) => node.connections.size === 0 && node.stopped));
});

test('modulation patterns use shared ticks, keep eight signed values and accept live rate edits', () => {
  const f = fixture();
  const runtime = createModSequencer(f.audio);
  const parameters = createModule('mod-sequencer', 0, 0).parameters;
  runtime.update({ ...parameters, rate: '1/8', step1: -0.5, step2: 0.25 });
  for (let tick = 0; tick < 4; tick++) runtime.scheduleControl!(tick, 1 + tick * 0.125);
  assert.deepEqual(
    f.nodes[0].offset.events.map((event) => [event.time, event.value]),
    [
      [1, -750],
      [1.25, 375],
    ],
  );
  runtime.update({ ...parameters, rate: '1/16', step4: 0.9 });
  runtime.scheduleControl!(3, 1.375);
  assert.equal(f.nodes[0].offset.events.at(-1)!.value, 1350);
  runtime.silence!();
  assert.equal(f.nodes[0].offset.value, 0);
  runtime.dispose();
  assert.ok(f.nodes.every((node) => !node.connections.size));
});

test('Sample & Hold switches from transport to explicit triggers without becoming a second sampler', () => {
  const f = fixture();
  let next = 0;
  const runtime = createRandomMod(f.audio, () => [0, 1][next++ % 2]);
  runtime.update(createModule('random-mod', 0, 0).parameters);
  runtime.scheduleControl!(0, 1);
  runtime.configureConnections!(new Set(['trigger']));
  runtime.scheduleControl!(2, 1.25);
  assert.equal(next, 1);
  runtime.trigger!('snare', 1, 1.3);
  assert.deepEqual(
    f.nodes[0].offset.events.map((event) => event.value),
    [-1500, 1500],
  );
  runtime.configureConnections!(new Set());
  runtime.scheduleControl!(4, 1.5);
  assert.equal(next, 3);
  runtime.dispose();
  assert.ok(f.nodes.every((node) => !node.connections.size));
});

test('XY axes are independent, share depth and dispose both native sources', () => {
  const f = fixture();
  const runtime = createXYController(f.audio);
  runtime.update({ x: 0.8, y: -0.4, depth: 0.5 });
  assert.equal(f.nodes[0].offset.value, 600);
  assert.equal(f.nodes[1].offset.value, -300);
  assert.notEqual(runtime.outputs.x, runtime.outputs.y);
  runtime.dispose();
  assert.ok(f.nodes.every((node) => node.stopped && !node.connections.size));
});

test('receiver scaling bounds pitch to one octave and level to unity, with a silent zero for envelopes', () => {
  const f = fixture();
  const pitch = boundedModulation(f.audio, 1200);
  const level = boundedModulation(f.audio, 1, 1, true);
  const curves = f.nodes.filter((node) => node.curve).map((node) => node.curve!);
  assert.equal(curves[0][0], -1200);
  assert.equal(curves[0].at(-1), 1200);
  assert.equal(curves[1][0], 0);
  assert.equal(curves[1][1024], 0);
  assert.equal(curves[1].at(-1), 1);
  pitch.dispose();
  level.dispose();
  assert.ok(f.nodes.every((node) => !node.connections.size));
});

test('all control producers reach every MOD destination but cannot be audio, pitch, trigger or feedback cables', () => {
  const producers: [ModuleType, string][] = [
    ['lfo', 'out'],
    ['envelope', 'out'],
    ['mod-sequencer', 'out'],
    ['random-mod', 'out'],
    ['xy-controller', 'x'],
    ['xy-controller', 'y'],
  ];
  const destinations: [ModuleType, string][] = [
    ['filter', 'cutoff'],
    ['oscillator', 'pitchMod'],
    ['mic-sampler', 'rateMod'],
    ['mic-sampler', 'levelMod'],
  ];
  for (const [sourceType, output] of producers)
    for (const [targetType, input] of destinations) {
      const source = createModule(sourceType, 0, 0),
        target = createModule(targetType, 400, 0);
      const project = { ...createProject(true), modules: [source, target] };
      assert.equal(
        connectionError(
          project,
          { moduleId: source.id, portId: output },
          { moduleId: target.id, portId: input },
        ),
        null,
      );
      project.cables.push({
        id: crypto.randomUUID(),
        from: { moduleId: source.id, portId: output },
        to: { moduleId: target.id, portId: input },
      });
      assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))), project);
      const audio = createModule('output', 800, 0);
      project.modules.push(audio);
      assert.match(
        connectionError(
          project,
          { moduleId: source.id, portId: output },
          { moduleId: audio.id, portId: 'in' },
        )!,
        /Match socket types/,
      );
    }
  const envelope = createModule('envelope', 0, 0);
  assert.match(
    connectionError(
      { ...createProject(true), modules: [envelope] },
      { moduleId: envelope.id, portId: 'out' },
      { moduleId: envelope.id, portId: 'gate' },
    )!,
    /same module|Match socket/,
  );
});

test('new modules reject corrupt rate/axis/step values and old patches need no changed defaults', () => {
  for (const type of ['envelope', 'mod-sequencer', 'random-mod', 'xy-controller'] as const) {
    const module = createModule(type, 0, 0);
    const project = { ...createProject(true), modules: [module] };
    assert.deepEqual(parseProject(project), project);
    const key = MODULES[type].controls[0].id;
    module.parameters[key] = Infinity;
    assert.throws(() => parseProject(project));
  }
  for (const type of ['mod-sequencer', 'random-mod'] as const) {
    const module = createModule(type, 0, 0);
    module.parameters.rate = '1/64';
    assert.throws(() => parseProject({ ...createProject(true), modules: [module] }));
  }
  const project = EXAMPLE_PATCHES.find((example) => example.id === 'moving-parts')!.create();
  for (const type of ['envelope', 'mod-sequencer', 'random-mod', 'xy-controller'])
    assert(project.modules.some((module) => module.type === type));
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))), project);
  const original = EXAMPLE_PATCHES.find((example) => example.id === 'neon-chorus')!.create();
  assert.equal(original.modules.length, 38);
});
