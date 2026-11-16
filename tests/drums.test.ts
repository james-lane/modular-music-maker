import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDrumRuntime } from '../src/audio/drums';
import { createModule } from '../src/domain/project';
import { encodeSamplePcm } from '../src/domain/samples';
import { DRUM_SOUNDS } from '../src/domain/instruments';

/** A small ownership spy, not an audio implementation. Browser QA verifies actual sound. */
class Parameter {
  value = 0;
  events: { value: number; time: number; kind: string }[] = [];
  setValueAtTime(value: number, time = 0) {
    this.events.push({ value, time, kind: 'set' });
    assert.ok(Number.isFinite(value));
    this.value = value;
  }
  linearRampToValueAtTime(value: number, time = 0) {
    this.events.push({ value, time, kind: 'ramp' });
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number) {
    assert.ok(value > 0);
    this.setValueAtTime(value);
  }
  setTargetAtTime(value: number) {
    this.setValueAtTime(value);
  }
}
class Node {
  gain = new Parameter();
  frequency = new Parameter();
  Q = new Parameter();
  playbackRate = new Parameter();
  connections = new Set<Node>();
  stops: (number | undefined)[] = [];
  started = false;
  startTime = 0;
  offset = 0;
  onended?: () => void;
  connect(target: Node) {
    this.connections.add(target);
  }
  disconnect(target?: Node) {
    if (target) assert.ok(this.connections.delete(target), 'specific input connection must exist');
    else this.connections.clear();
  }
  start(time = 0, offset = 0) {
    this.startTime = time;
    this.offset = offset;
    this.started = true;
  }
  stop(time?: number) {
    this.stops.push(time);
    if (time === undefined) this.onended?.();
  }
}
function audioSpy() {
  const nodes: Node[] = [];
  const create = () => {
    const node = new Node();
    nodes.push(node);
    return node;
  };
  const context = {
    currentTime: 0,
    sampleRate: 48000,
    createGain: create,
    createOscillator: create,
    createBiquadFilter: create,
    createBufferSource: create,
    createBuffer: (_channels: number, length: number, rate = 48000) => ({
      duration: length / rate,
      getChannelData: () => new Float32Array(length),
      copyToChannel: () => {},
    }),
  };
  return { context: context as unknown as AudioContext, nodes };
}

test('all sixteen sounds create scheduled sources and release every connection on stop', () => {
  const { context, nodes } = audioSpy();
  const runtime = createDrumRuntime(context);
  runtime.update({ level: 0.7, tone: 0, decay: 0.8 });
  for (const sound of DRUM_SOUNDS) runtime.trigger!(sound.id, 0.8, 0);
  const sources = nodes.filter((node) => node.started);
  assert.ok(sources.length >= 16);
  assert.ok(
    sources.every((source) => source.stops.some((time) => typeof time === 'number' && time > 0)),
  );
  runtime.silence!();
  assert.ok(sources.every((source) => source.stops.includes(undefined)));
  assert.ok(nodes.every((node) => node.connections.size === 0));
  runtime.dispose();
});

test('a closed hat cuts an open hat short instead of leaving its source alive', () => {
  const { context, nodes } = audioSpy();
  const runtime = createDrumRuntime(context);
  runtime.trigger!('open-hat', 1, 0);
  const openHat = nodes.find((node) => node.started)!;
  assert.ok(!openHat.stops.includes(undefined));
  runtime.trigger!('closed-hat', 1, 0);
  assert.ok(openHat.stops.includes(undefined));
  runtime.dispose();
});

test('kit resolves lane sounds once, tunes samples, and leaves the other twelve pads unchanged', () => {
  const { context, nodes } = audioSpy();
  const runtime = createDrumRuntime(context);
  const kit = createModule('drum-kit', 0, 0);
  kit.parameters.kick = 'low-tom';
  kit.parameters.snare = 'kick';
  kit.parameters.clap = 'sample';
  kit.samples = { clap: { name: 'Test', pcm: encodeSamplePcm(new Float32Array([0, 1, -1, 0])) } };
  runtime.configureKit!(kit);
  runtime.trigger!('kick', 1, 0);
  assert.ok(nodes.some((node) => node.started && node.frequency.value === 75));
  const firstCount = nodes.length;
  runtime.trigger!('snare', 1, 0);
  assert.ok(
    nodes.slice(firstCount).some((node) => node.started && node.frequency.value === 42),
    'snare maps directly to kick, without remapping through voice 1',
  );
  runtime.update({ level: 0.7, tone: 12, decay: 1 });
  const beforeSample = nodes.length;
  runtime.trigger!('clap', 1, 0);
  assert.ok(
    nodes.slice(beforeSample).some((node) => node.started && node.playbackRate.value === 2),
  );
  const beforePad = nodes.length;
  runtime.trigger!('low-conga', 1, 0);
  assert.ok(nodes.slice(beforePad).some((node) => node.started && node.frequency.value === 340));
  runtime.configureKit!(undefined);
  const beforeDefault = nodes.length;
  runtime.trigger!('kick', 1, 0);
  assert.ok(nodes.slice(beforeDefault).some((node) => node.started && node.frequency.value === 84));
  runtime.dispose();
});

test('external voice hits own their input connections and Stop tolerates late source completion', () => {
  const { context, nodes } = audioSpy();
  const runtime = createDrumRuntime(context);
  const kit = createModule('drum-kit', 0, 0);
  kit.parameters.kick = 'input';
  runtime.configureKit!(kit);
  const input = runtime.inputs['kit-kick'] as unknown as Node;
  assert.equal(input.connections.size, 0);
  runtime.trigger!('kick', 1, 0.2);
  runtime.trigger!('kick', 1, 0.5);
  assert.equal(input.connections.size, 2);
  const sources = nodes.filter((node) => node.started);
  sources[0].onended?.();
  assert.equal(input.connections.size, 1, 'ending one hit preserves the other input envelope');
  runtime.silence!();
  sources.forEach((source) => source.onended?.());
  assert.equal(input.connections.size, 0);
  assert.ok(nodes.every((node) => node.connections.size === 0));
  runtime.dispose();
});

test('sampler kit inputs trigger eight complete overlapping hits without playing the sampler bus', () => {
  const { context, nodes } = audioSpy();
  const runtime = createDrumRuntime(context);
  const kit = createModule('drum-kit', 0, 0);
  kit.parameters.kick = 'input';
  kit.parameters.length = 0.03;
  const sampler = createModule('mic-sampler', 0, 0);
  sampler.samples = {
    clip: { name: 'Four seconds', pcm: encodeSamplePcm(new Float32Array(96000)) },
  };
  sampler.parameters.level = 0.5;
  runtime.update({ level: 0.5, tone: 0, decay: 1 });
  runtime.configureKit!(kit, { kick: sampler });
  for (let index = 0; index < 8; index++) runtime.trigger!('kick', 1, index / 4);
  const voices = nodes.filter((node) => node.started);
  assert.equal(voices.length, 8);
  assert.equal(new Set(voices).size, 8);
  for (const voice of voices) {
    assert.deepEqual(voice.stops, [voice.startTime + 4]);
    assert.equal(voice.offset, 0);
  }
  const input = runtime.inputs['kit-kick'] as unknown as Node;
  assert.equal(input.connections.size, 0, 'sampled hits do not gate the running input bus');
  assert.equal(runtime.remainingTailSeconds?.(), 5.75);
  runtime.silence!();
  assert(voices.every((voice) => voice.stops.includes(undefined)));
  assert.equal(runtime.remainingTailSeconds?.(), 0);
  runtime.dispose();
  assert(nodes.every((node) => !node.connections.size));
});

test('sample trim, speed, level and drum Tone apply per hit; Decay fades without truncating voices', () => {
  const { context, nodes } = audioSpy();
  const runtime = createDrumRuntime(context);
  const kit = createModule('drum-kit', 0, 0);
  kit.parameters.kick = 'input';
  const sampler = createModule('mic-sampler', 0, 0);
  sampler.samples = { clip: { name: 'Clip', pcm: encodeSamplePcm(new Float32Array(96000)) } };
  sampler.parameters = {
    ...sampler.parameters,
    trimStart: 0.25,
    trimEnd: 0.75,
    rate: 0.5,
    level: 0.4,
  };
  runtime.configureKit!(kit, { kick: sampler });
  runtime.update({ level: 0.7, tone: -12, decay: 0.3 });
  const before = nodes.length;
  runtime.trigger!('kick', 0.5, 1);
  const hit = nodes.slice(before),
    player = hit.find((node) => node.started)!;
  assert.equal(player.offset, 1);
  assert.equal(player.playbackRate.value, 0.25);
  assert.deepEqual(player.stops, [9]);
  const envelope = hit.find((node) =>
    node.gain.events.some((event) => event.kind === 'ramp' && event.value === 0.2),
  )!;
  assert(envelope);
  const lowDecayHold = envelope.gain.events
    .filter((event) => event.value === 0.2 && event.kind === 'set')
    .at(-1)!.time;
  runtime.update({ level: 0.7, tone: -12, decay: 1 });
  const next = nodes.length;
  runtime.trigger!('kick', 0.5, 1);
  const natural = nodes.slice(next);
  assert.deepEqual(natural.find((node) => node.started)!.stops, [9]);
  assert(
    natural
      .find((node) => !node.started)!
      .gain.events.some(
        (event) => event.value === 0.2 && event.kind === 'set' && event.time > lowDecayHold,
      ),
  );
  assert.deepEqual(player.stops, [9], 'the later hit leaves the earlier one playing');
  const callbacks = nodes.filter((node) => node.started).map((node) => node.onended);
  runtime.dispose();
  callbacks.forEach((callback) => callback?.());
  assert(nodes.every((node) => !node.connections.size));
});

test('empty linked samplers stay silent and imported samples also keep full source duration', () => {
  const { context, nodes } = audioSpy();
  const runtime = createDrumRuntime(context);
  const kit = createModule('drum-kit', 0, 0);
  kit.parameters.kick = 'input';
  runtime.configureKit!(kit, { kick: createModule('mic-sampler', 0, 0) });
  runtime.trigger!('kick', 1, 0);
  assert.equal(nodes.filter((node) => node.started).length, 0);
  kit.parameters.kick = 'sample';
  kit.samples = { kick: { name: 'Imported', pcm: encodeSamplePcm(new Float32Array(96000)) } };
  runtime.configureKit!(kit);
  runtime.update({ level: 0.7, tone: 0, decay: 0.3 });
  runtime.trigger!('kick', 1, 0);
  assert.deepEqual(nodes.find((node) => node.started)!.stops, [4]);
  runtime.dispose();
});

test('processed sampler hits use private effect racks and preserve overlapping sources and rack ownership', async () => {
  const { KitEffects } = await import('../src/audio/kit-effects');
  const { kitSamplerSources } = await import('../src/domain/instruments');
  const { createProject } = await import('../src/domain/project');
  const { context, nodes } = audioSpy();
  const sampler = createModule('mic-sampler', 0, 0);
  sampler.samples = { clip: { name: 'Tone', pcm: encodeSamplePcm(new Float32Array(24000)) } };
  const filter = createModule('filter', 350, 0);
  const kit = createModule('drum-kit', 700, 0);
  kit.parameters.kick = 'input';
  const machine = createModule('drum-machine', 1000, 0);
  const second = createModule('drum-machine', 1000, 500);
  const project = createProject(true);
  project.modules = [sampler, filter, kit, machine, second];
  project.cables = [
    {
      id: crypto.randomUUID(),
      from: { moduleId: sampler.id, portId: 'out' },
      to: { moduleId: filter.id, portId: 'in' },
    },
    {
      id: crypto.randomUUID(),
      from: { moduleId: filter.id, portId: 'out' },
      to: { moduleId: kit.id, portId: 'kick' },
    },
    ...[machine, second].map((m) => ({
      id: crypto.randomUUID(),
      from: { moduleId: kit.id, portId: 'kit' },
      to: { moduleId: m.id, portId: 'kit' },
    })),
  ];
  const firstRuntime = createDrumRuntime(context);
  const secondRuntime = createDrumRuntime(context);
  const previousNode = Object.getOwnPropertyDescriptor(globalThis, 'AudioNode');
  Object.defineProperty(globalThis, 'AudioNode', { value: Node, configurable: true });
  try {
    const racks = new KitEffects(
      context,
      project,
      new Map([
        [machine.id, firstRuntime],
        [second.id, secondRuntime],
      ]),
    );
    const firstInput = racks.inputs.get(machine.id)!.kick as unknown as Node;
    const secondInput = racks.inputs.get(second.id)!.kick as unknown as Node;
    assert.notEqual(firstInput, secondInput);
    firstRuntime.configureKit!(kit, kitSamplerSources(project, kit), racks.inputs.get(machine.id));
    firstRuntime.trigger!('kick', 1, 0.1);
    firstRuntime.trigger!('kick', 1, 0.2);
    const players = nodes.filter((n) => n.started);
    assert.equal(players.length, 2);
    for (const player of players) {
      const gain = [...player.connections][0];
      assert.deepEqual([...gain.connections], [firstInput]);
      assert.equal(player.stops[0], player.startTime + 1);
      assert.equal(player.stops.length, 1);
    }
    filter.parameters.cutoff = 500;
    racks.update(project);
    assert.equal(firstInput.frequency.value, 500);
    assert.equal(secondInput.frequency.value, 500);
    // Finishing one source leaves the shared effect tail connected for later hits.
    players[0].onended?.();
    assert.ok(firstInput.connections.has(firstRuntime.outputs.out as unknown as Node));
    firstRuntime.dispose();
    secondRuntime.dispose();
    racks.dispose();
    assert.ok(nodes.every((n) => n.connections.size === 0));
  } finally {
    if (previousNode) Object.defineProperty(globalThis, 'AudioNode', previousNode);
    else Reflect.deleteProperty(globalThis, 'AudioNode');
  }
});
