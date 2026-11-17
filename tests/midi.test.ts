import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUDIO_FACTORIES } from '../src/audio/factories';
import type { LiveControls } from '../src/audio/live';
import { MidiDevices, type MidiState } from '../src/midi/devices';
import { MidiRouter, decodeMidi } from '../src/midi/router';
import { createModule, createProject } from '../src/domain/project';
import { createModuleDemo } from '../src/domain/module-demos';
import { MODULE_LIST, moduleDefinition } from '../src/domain/modules';
import { MODULE_GUIDES } from '../src/domain/module-guides';
import { parseProject } from '../src/domain/validation';
import { withParameterInputs } from '../src/audio/parameter-inputs';

function fixture() {
  const events: unknown[][] = [];
  const live: LiveControls = {
    noteOn: (...args) => {
      events.push(['on', ...args]);
    },
    noteOff: (...args) => {
      events.push(['off', ...args]);
    },
    releaseKeyboard() {},
    drumHit() {},
    sampleHit() {},
    padHit() {},
    midiHit: (...args) => {
      events.push(['hit', ...args]);
    },
    midiControl: (...args) => {
      events.push(['cc', ...args]);
    },
    resetMidi() {
      events.push(['reset']);
    },
  };
  const module = createModule('midi-input', 0, 0);
  const project = { ...createProject(true), modules: [module] };
  const router = new MidiRouter(() => live);
  router.sync(project, {});
  events.length = 0;
  return { project, module, router, events };
}

test('MIDI decoding rejects malformed/system messages and treats zero velocity as note off', () => {
  assert.deepEqual(decodeMidi([0x92, 60, 100]), { kind: 'on', channel: 3, number: 60, value: 100 });
  assert.equal(decodeMidi([0x90, 60, 0])?.kind, 'off');
  assert.equal(decodeMidi([0x8f, 60, 99])?.channel, 16);
  assert.equal(decodeMidi([0xb0, 74, 127])?.kind, 'cc');
  for (const bytes of [
    [],
    [0xf8],
    [0xf0, 1, 2],
    [0x90, 60],
    [0x90, 60, 128],
    [0x90, -1, 4],
    [0x90, 1.2, 5],
    [0xe0, 1, 2],
    [0x90, 60, 1, 0],
    [0x70, 60, 1],
  ])
    assert.equal(decodeMidi(bytes), null);
});

test('instances filter devices/channels/ranges and deliver CCs plus bounded drum-note assignments', () => {
  const { module, project, router, events } = fixture();
  Object.assign(module.parameters, { channel: 2, noteMin: 36, noteMax: 60 });
  const second = createModule('midi-input', 600, 0);
  Object.assign(second.parameters, { channel: 3 });
  project.modules.push(second);
  const devices = { [module.id]: 'keys', [second.id]: 'pads' };
  router.sync(project, devices);
  events.length = 0;
  router.receive(project, devices, 'keys', [0x90, 48, 80]);
  assert.equal(events.length, 0);
  router.receive(project, devices, 'keys', [0x91, 35, 80]);
  assert.equal(events.length, 0);
  router.receive(project, devices, 'pads', [0x91, 48, 80]);
  assert.equal(events.length, 0);
  router.receive(project, devices, 'keys', [0x91, 36, 64]);
  assert.equal(events.filter((row) => row[0] === 'on').length, 1);
  assert.deepEqual(events.find((row) => row[0] === 'hit')?.slice(1), [module.id, 0, 64 / 127]);
  router.receive(project, devices, 'keys', [0x91, 60, 127]);
  assert.equal(events.filter((row) => row[0] === 'on').length, 2);
  assert.equal(events.filter((row) => row[0] === 'hit').length, 1);
  router.receive(project, devices, 'pads', [0xb2, 74, 95]);
  assert.deepEqual(events.at(-1), ['cc', second.id, 3, 95]);
});

test('sustain, all-notes-off and disconnect preserve independently held device/channel owners', () => {
  const { module, project, router, events } = fixture();
  const send = (id: string, ...data: number[]) => router.receive(project, {}, id, data);
  send('a', 0x90, 60, 100);
  send('b', 0x90, 60, 100);
  send('a', 0x91, 60, 100);
  const sources = events.filter((row) => row[0] === 'on').map((row) => row[4]);
  assert.equal(new Set(sources).size, 3);
  send('a', 0xb0, 64, 127);
  send('a', 0x90, 60, 0);
  assert.equal(events.filter((row) => row[0] === 'off').length, 0);
  send('a', 0xb0, 64, 0);
  assert.equal(events.filter((row) => row[0] === 'off').length, 1);
  router.panic('a');
  assert.equal(events.filter((row) => row[0] === 'off').length, 2);
  send('b', 0xb0, 123, 0);
  assert.equal(events.filter((row) => row[0] === 'off').length, 3);
  assert(events.filter((row) => row[0] === 'off').every((row) => row[1] === module.id));
  const before = events.length;
  router.panic();
  assert.equal(events.length, before);
});

test('routing, configuration and project switches retire held MIDI without touching saved patch data', () => {
  const { module, project, router, events } = fixture();
  router.receive(project, {}, 'keys', [0x90, 60, 100]);
  const snapshot = structuredClone(project);
  router.receive(project, {}, 'keys', [0xb0, 1, 50]);
  assert.deepEqual(project, snapshot);
  module.parameters.channel = 2;
  router.sync(project, {});
  assert.equal(events.filter((row) => row[0] === 'off').length, 1);
  router.receive(project, {}, 'keys', [0x91, 61, 100]);
  router.sync({ ...project, id: crypto.randomUUID() }, {});
  assert.equal(events.filter((row) => row[0] === 'off').length, 2);
});

class Input extends EventTarget {
  id = 'input';
  name = 'Test keys';
  state = 'connected';
  opens = 0;
  closes = 0;
  async open() {
    this.opens++;
    return this;
  }
  async close() {
    this.closes++;
    return this;
  }
  send(data: number[]) {
    const event = new Event('midimessage');
    Object.defineProperty(event, 'data', { value: new Uint8Array(data) });
    this.dispatchEvent(event);
  }
}
class Access extends EventTarget {
  inputs = new Map<string, Input>();
}
// These minimal native-boundary doubles intentionally implement only the API
// surface used by MidiDevices; routing/audio tests exercise the actual contracts.
function native(access: Access) {
  return access as unknown as MIDIAccess;
}

test('hardware access is explicit, denied/unsupported operation is safe, and late permission is cancelled', async () => {
  const states: MidiState[] = [];
  let requests = 0;
  const unsupported = new MidiDevices(
    undefined,
    (state) => states.push(state),
    () => {},
    () => {},
  );
  await unsupported.enable();
  assert.equal(unsupported.snapshot.phase, 'unsupported');
  const denied = new MidiDevices(
    async () => {
      requests++;
      throw Error('denied');
    },
    (state) => states.push(state),
    () => {},
    () => {},
  );
  assert.equal(requests, 0);
  await denied.enable();
  assert.equal(requests, 1);
  assert.equal(denied.snapshot.phase, 'error');
  let resolve!: (access: MIDIAccess) => void;
  const pending = new MidiDevices(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
    (state) => states.push(state),
    () => {},
    () => {},
  );
  const enabling = pending.enable();
  pending.disable();
  const access = new Access();
  access.inputs.set('input', new Input());
  resolve(native(access));
  await enabling;
  assert.equal(pending.snapshot.phase, 'off');
  assert.equal(access.inputs.get('input')!.opens, 0);
});

test('native input messages, hotplug and disable have one listener/close ownership path', async () => {
  const access = new Access(),
    input = new Input();
  access.inputs.set(input.id, input);
  const messages: unknown[][] = [],
    released: (string | undefined)[] = [];
  const manager = new MidiDevices(
    async () => native(access),
    () => {},
    (id, data) => messages.push([id, ...data]),
    (id) => released.push(id),
  );
  await manager.enable();
  assert.equal(input.opens, 1);
  input.send([0x90, 60, 100]);
  assert.equal(messages.length, 1);
  access.dispatchEvent(new Event('statechange'));
  input.send([0x90, 61, 100]);
  assert.equal(messages.length, 2);
  assert.equal(input.opens, 1);
  input.state = 'disconnected';
  access.dispatchEvent(new Event('statechange'));
  assert.deepEqual(released, ['input']);
  input.send([0x90, 62, 100]);
  assert.equal(messages.length, 2);
  assert.equal(input.closes, 1);
  input.state = 'connected';
  access.dispatchEvent(new Event('statechange'));
  assert.equal(input.opens, 2);
  manager.disable();
  assert.equal(input.closes, 2);
  input.send([0x90, 63, 100]);
  assert.equal(messages.length, 2);
  assert.equal(released.at(-1), undefined);
});

test('all module guides require honest MIDI guidance; MIDI demo is portable, wired and explicitly playable', () => {
  for (const definition of MODULE_LIST)
    assert(MODULE_GUIDES[definition.type].midi.length > 50, definition.name);
  const demo = createModuleDemo('midi-input');
  assert.equal(demo.interaction, 'midi');
  assert.match(demo.instructions, /Test note/);
  assert.deepEqual(parseProject(demo.project), demo.project);
  const midi = demo.project.modules.find((module) => module.type === 'midi-input')!;
  for (const invalid of [
    { noteMin: 100, noteMax: 10 },
    { channel: 17 },
    { cc1: 120 },
    { bipolar1: 'yes' },
    { velocity: 2 },
    { device: 'private' },
  ])
    assert.throws(() =>
      parseProject({
        ...demo.project,
        modules: demo.project.modules.map((module) =>
          module === midi
            ? { ...module, parameters: { ...module.parameters, ...invalid } }
            : module,
        ),
      }),
    );
});

test('v1/v2 geometry migration moves only enlarged overlaps, preserving sound/IDs and stable reloads', () => {
  const mixer = createModule('mixer', 0, 0),
    next = createModule('noise', 200, 0);
  const project = { ...createProject(true), version: 2, modules: [mixer, next] };
  const original = structuredClone(project),
    migrated = parseProject(project);
  assert.equal(migrated.version, 3);
  assert.deepEqual(project, original);
  assert.deepEqual(migrated.modules[1], next);
  assert.notEqual(migrated.modules[0].x, mixer.x);
  assert.deepEqual(migrated.modules[0].parameters, mixer.parameters);
  assert.deepEqual(parseProject(migrated), migrated);
  assert(moduleDefinition(migrated.modules[0]).ports.length === 5);
});

test('native parameter adapters allocate only for connected sockets and clamp full ranges/complementary mix', () => {
  class Parameter {
    value = 0;
    cancelScheduledValues() {}
    setValueAtTime(v: number) {
      this.value = v;
    }
  }
  class Node {
    gain = new Parameter();
    curve: Float32Array | null = null;
    connections: unknown[] = [];
    closed = false;
    connect(target: unknown) {
      this.connections.push(target);
    }
    disconnect() {
      this.connections = [];
      this.closed = true;
    }
  }
  const nodes: Node[] = [];
  const make = () => {
    const node = new Node();
    nodes.push(node);
    return node;
  };
  // Native endpoint spies verify actual curve values, offsets and ownership.
  const context = {
    currentTime: 2,
    createGain: make,
    createWaveShaper: make,
  } as unknown as AudioContext;
  const wet = new Parameter(),
    dry = new Parameter();
  const runtime = withParameterInputs(
    context,
    { ...MODULE_LIST.find((d) => d.type === 'reverb')! },
    {
      inputs: {},
      outputs: {},
      modulationTargets: {
        mix: [
          { parameter: wet as unknown as AudioParam },
          { parameter: dry as unknown as AudioParam, scale: -1, offset: 1 },
        ],
      },
      update() {
        wet.value = 0.3;
        dry.value = 0.7;
      },
      dispose() {},
    },
  );
  runtime.update({ mix: 0.3 });
  assert.equal(nodes.length, 0);
  assert.equal(wet.value, 0.3);
  const input = runtime.inputs.mixMod;
  assert.equal(runtime.inputs.mixMod, input);
  assert.equal(nodes.length, 3);
  const curve = nodes.find((node) => node.curve)!.curve!;
  assert.equal(curve[0], 0);
  assert.equal(curve.at(-1), 1);
  assert.equal(curve[Math.floor(curve.length / 2)], 0);
  runtime.update({ mix: 0.9 });
  assert.equal(wet.value, 0);
  assert.equal(dry.value, 1);
  runtime.dispose();
  assert(nodes.every((node) => node.closed));
});

test('drum MOD gain preserves the saved level for private sampler-effect returns', () => {
  class Node {
    gain = {
      value: 1,
      setTargetAtTime(value: number) {
        this.value = value;
      },
    };
    connections = new Set<unknown>();
    connect(target: unknown) {
      this.connections.add(target);
    }
    disconnect() {
      this.connections.clear();
    }
  }
  const nodes: Node[] = [];
  const context = {
    currentTime: 0,
    sampleRate: 10,
    createGain() {
      const node = new Node();
      nodes.push(node);
      return node;
    },
    createBuffer(_channels: number, length: number) {
      return {
        getChannelData() {
          return new Float32Array(length);
        },
      };
    },
  };
  // The factory only needs gains and local noise buffers until a hit is scheduled.
  const runtime = AUDIO_FACTORIES['drum-machine'](
    context as unknown as AudioContext,
    {} as AudioNode,
  );
  const savedLevel = nodes[0],
    modLevel = nodes.at(-1)!;
  assert.equal(runtime.kitEffectsReturn, savedLevel);
  assert.equal(runtime.outputs.out, modLevel);
  assert(savedLevel.connections.has(modLevel));
  runtime.update({ ...createModule('drum-machine', 0, 0).parameters, level: 0.37 });
  assert.equal(savedLevel.gain.value, 0.37);
  assert.equal(modLevel.gain.value, 1);
  runtime.dispose();
  assert(nodes.every((node) => node.connections.size === 0));
});
