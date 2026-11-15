import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudioEngine } from '../src/audio/engine';
import { createModule, createProject, stepFrequency } from '../src/domain/project';
import { DRUM_LANES, midiFrequency } from '../src/domain/instruments';
import { encodeSamplePcm } from '../src/domain/samples';
import { AUDIO_FACTORIES } from '../src/audio/factories';

class Parameter {
  value = 0;
  values: { value: number; time: number }[] = [];
  ramps: { value: number; time: number }[] = [];
  setValueAtTime(value: number, time = 0) {
    this.value = value;
    this.values.push({ value, time });
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.ramps.push({ value, time });
  }
  setTargetAtTime(value: number) {
    this.value = value;
  }
  cancelScheduledValues() {}
}
class Node {
  gain = new Parameter();
  frequency = new Parameter();
  detune = new Parameter();
  playbackRate = new Parameter();
  buffer?: { duration: number };
  onended: (() => void) | null = null;
  starts: number[][] = [];
  stops: number[] = [];
  threshold = new Parameter();
  knee = new Parameter();
  ratio = new Parameter();
  attack = new Parameter();
  release = new Parameter();
  connections = new Set<Node>();
  connect(node: Node) {
    this.connections.add(node);
  }
  disconnect() {
    this.connections.clear();
  }
  start(...args: number[]) {
    this.starts.push(args);
  }
  stop(time = 0) {
    this.stops.push(time);
  }
}
class Context {
  currentTime = 0;
  sampleRate = 48000;
  state = 'suspended';
  destination = new Node();
  gains: Node[] = [];
  oscillators: Node[] = [];
  sources: Node[] = [];
  recording = new Node();
  createBuffer(_channels: number, length: number, rate: number) {
    return { duration: length / rate, copyToChannel() {} };
  }
  createBufferSource() {
    const source = new Node();
    this.sources.push(source);
    return source;
  }
  closeCount = 0;
  createGain() {
    const node = new Node();
    this.gains.push(node);
    return node;
  }
  createOscillator() {
    const node = new Node();
    this.oscillators.push(node);
    return node;
  }
  createDynamicsCompressor() {
    return new Node();
  }
  createAnalyser() {
    return new Node();
  }
  createMediaStreamDestination() {
    return this.recording;
  }
  async resume() {
    assert.notEqual(this.state, 'closed');
    this.state = 'running';
  }
  async suspend() {
    assert.notEqual(this.state, 'closed');
    this.state = 'suspended';
  }
  async close() {
    this.state = 'closed';
    this.closeCount++;
  }
  asAudioContext() {
    return this as unknown as AudioContext;
  }
}

test('a disposed engine can rebuild the same graph during development reload without stale nodes', async () => {
  const contexts: Context[] = [];
  const engine = new AudioEngine(() => {
    const context = new Context();
    contexts.push(context);
    return context.asAudioContext();
  });
  const project = createProject(true);
  await engine.activate(project);
  const closing = engine.dispose();
  // Fast Refresh re-runs setup before asynchronous cleanup has necessarily finished.
  await engine.activate(project);
  await closing;
  assert.equal(contexts.length, 2);
  assert.equal(contexts[0].closeCount, 1);
  assert.equal(engine.isActive, true);
  await engine.stop();
  await engine.dispose();
  await engine.dispose();
  assert.equal(contexts[1].closeCount, 1);
});

test('independent sequencer rates schedule notes, rests, gates and lights on the shared drum clock', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const context = new Context();
  const engine = new AudioEngine(() => context.asAudioContext());
  const project = createProject(true);
  project.tempo = 120;
  project.modules = [];
  const rates = ['1/4', '1/8', '1/16'];
  for (const rate of rates) {
    const sequencer = createModule('sequencer', 0, 0);
    sequencer.parameters = { gate: 0.5, rate };
    sequencer.steps = [0, -1, 2, 3, 4, 5, 6, 7];
    const oscillator = createModule('oscillator', 300, 0);
    project.modules.push(sequencer, oscillator);
    project.cables.push({
      id: crypto.randomUUID(),
      from: { moduleId: sequencer.id, portId: 'pitch' },
      to: { moduleId: oscillator.id, portId: 'pitch' },
    });
  }
  const drum = createModule('drum-machine', 600, 0);
  drum.drumPattern = Object.fromEntries(DRUM_LANES.map((lane) => [lane, Array(16).fill(false)]));
  drum.drumPattern.kick.fill(true);
  project.modules.push(drum);
  const hits: number[] = [];
  t.mock.method(AUDIO_FACTORIES, 'drum-machine', () => ({
    inputs: {},
    outputs: {},
    update() {},
    dispose() {},
    trigger(_sound: string, _velocity: number, time: number) {
      hits.push(time);
    },
  }));
  const visuals: number[][] = [];
  engine.onTick = (...state) => visuals.push(state);
  try {
    await engine.play(project);
    // Advance the audio clock and scheduler together through one slow eight-step loop.
    for (let index = 1; index <= 161; index++) {
      context.currentTime = index * 0.025;
      t.mock.timers.tick(25);
    }
    for (const [index, duration] of [0.5, 0.25, 0.125].entries()) {
      const frequency = context.oscillators[index].frequency.values;
      const envelope = context.gains[index + 1].gain;
      const expected = Array.from({ length: Math.ceil((4.145 - 0.03) / duration) }, (_, step) => ({
        time: 0.03 + step * duration,
        degree: [0, -1, 2, 3, 4, 5, 6, 7][step % 8],
      })).filter((note) => note.degree >= 0);
      assert.equal(frequency.length, expected.length);
      frequency.forEach((note, index) => {
        assert.equal(note.value, stepFrequency(project, expected[index].degree));
        assert.ok(Math.abs(note.time - expected[index].time) < 1e-9);
      });
      const holds = envelope.values.filter(({ value }) => value > 0);
      assert.equal(holds.length, frequency.length);
      holds.forEach((hold, note) =>
        assert.ok(Math.abs(hold.time - frequency[note].time - duration * 0.5) < 1e-9),
      );
      assert.ok(
        envelope.ramps
          .filter(({ value }) => value === 0)
          .every(
            ({ time }, note) =>
              Math.abs(time - frequency[note].time - duration * 0.5 - 0.035) < 1e-9,
          ),
      );
    }
    assert.ok(hits.length >= 32);
    hits.forEach((time, index) => assert.ok(Math.abs(time - 0.03 - index * 0.125) < 1e-9));
    assert.deepEqual(
      visuals.slice(0, 17),
      Array.from({ length: 17 }, (_, tick) => [tick, Math.floor(tick / 4) % 4, tick % 16]),
    );
    await engine.stop();
    assert.deepEqual(visuals.at(-1), [-1, 0, -1]);
    await engine.play(project);
    assert.equal(context.oscillators[0].frequency.values.at(-1)?.value, stepFrequency(project, 0));
    assert.equal(context.oscillators.length, 3, 'restart reuses the graph');
  } finally {
    await engine.dispose();
  }
});

test('live rate and tempo changes join the next grid boundary without rebuilding voices', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const context = new Context();
  const engine = new AudioEngine(() => context.asAudioContext());
  const sequencer = createModule('sequencer', 0, 0);
  sequencer.parameters.rate = '1/4';
  sequencer.steps = [0, 1, 2, 3, 4, 5, 6, 7];
  const oscillator = createModule('oscillator', 300, 0);
  const project = {
    ...createProject(true),
    tempo: 120,
    modules: [sequencer, oscillator],
    cables: [
      {
        id: crypto.randomUUID(),
        from: { moduleId: sequencer.id, portId: 'pitch' },
        to: { moduleId: oscillator.id, portId: 'pitch' },
      },
    ],
  };
  try {
    await engine.play(project);
    const notes = context.oscillators[0].frequency.values;
    assert.equal(notes.length, 1);
    sequencer.parameters.rate = '1/16';
    engine.update(project);
    context.currentTime = 0.1;
    t.mock.timers.tick(100);
    assert.deepEqual(notes[1], { value: stepFrequency(project, 1), time: 0.155 });
    project.tempo = 60;
    engine.update(project);
    context.currentTime = 0.25;
    t.mock.timers.tick(150);
    assert.deepEqual(notes[2], { value: stepFrequency(project, 2), time: 0.28 });
    context.currentTime = 0.5;
    t.mock.timers.tick(250);
    assert.deepEqual(notes[3], { value: stepFrequency(project, 3), time: 0.53 });
    assert.equal(context.oscillators.length, 1);
  } finally {
    await engine.dispose();
  }
});

test('the fastest rate keeps attack, hold and release ordered at both gate extremes', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const context = new Context();
  const engine = new AudioEngine(() => context.asAudioContext());
  const sequencer = createModule('sequencer', 0, 0);
  sequencer.parameters = { rate: '1/16', gate: 0.95 };
  const oscillator = createModule('oscillator', 300, 0);
  const project = {
    ...createProject(true),
    tempo: 240,
    modules: [sequencer, oscillator],
    cables: [
      {
        id: crypto.randomUUID(),
        from: { moduleId: sequencer.id, portId: 'pitch' },
        to: { moduleId: oscillator.id, portId: 'pitch' },
      },
    ],
  };
  try {
    for (const gate of [0.1, 0.95]) {
      sequencer.parameters.gate = gate;
      await engine.play(project);
      const envelope = context.gains[1].gain;
      const hold = envelope.values.filter(({ value }) => value > 0).at(-1)!;
      const attack = envelope.ramps.filter(({ value }) => value > 0).at(-1)!;
      const release = envelope.ramps.filter(({ value }) => value === 0).at(-1)!;
      assert.ok(attack.time < hold.time);
      assert.ok(release.time > hold.time);
      assert.ok(release.time < context.oscillators[0].frequency.values.at(-1)!.time + 0.0625);
      await engine.stop();
    }
  } finally {
    await engine.dispose();
  }
});

test('keyboard last-note priority, held octave edits, release and Stop control the real voice parameters', async () => {
  const context = new Context();
  const engine = new AudioEngine(() => context.asAudioContext());
  const keyboard = createModule('keyboard', 40, 40);
  const oscillator = createModule('oscillator', 600, 40);
  const project = {
    ...createProject(true),
    modules: [keyboard, oscillator],
    cables: [
      {
        id: crypto.randomUUID(),
        from: { moduleId: keyboard.id, portId: 'pitch' },
        to: { moduleId: oscillator.id, portId: 'pitch' },
      },
    ],
  };
  try {
    await engine.activate(project);
    const voice = context.oscillators[0];
    const envelope = context.gains[1].gain;
    engine.noteOn(keyboard.id, 48, 0.8);
    assert.equal(voice.frequency.value, midiFrequency(48));
    assert.ok(envelope.value > 0);
    engine.noteOn(keyboard.id, 52, 0.6);
    assert.equal(voice.frequency.value, midiFrequency(52));
    engine.noteOff(keyboard.id, 52);
    assert.equal(voice.frequency.value, midiFrequency(48));
    keyboard.parameters.octave = 1;
    engine.update(project);
    assert.equal(voice.frequency.value, midiFrequency(60));
    engine.noteOff(keyboard.id, 48);
    assert.equal(envelope.value, 0);
    engine.noteOn(keyboard.id, 55, 1);
    await engine.stop();
    assert.equal(envelope.value, 0);
  } finally {
    await engine.dispose();
  }
});

test('Play snippet restarts direct dry audio stopped or playing, bypassing Output and recording', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const context = new Context();
  const engine = new AudioEngine(() => context.asAudioContext());
  const sampler = createModule('mic-sampler', 0, 0);
  sampler.samples = { clip: { name: 'Tone', pcm: encodeSamplePcm(new Float32Array(96000)) } };
  sampler.parameters = { ...sampler.parameters, trimStart: 0.25, trimEnd: 0.75, rate: 0.5 };
  const output = createModule('output', 400, 0);
  output.parameters.level = 0;
  const project = { ...createProject(true), masterVolume: 0, modules: [sampler, output] };
  const reaches = (source: Node, target: Node, seen = new Set<Node>()): boolean => {
    if (source === target) return true;
    if (seen.has(source)) return false;
    seen.add(source);
    return [...source.connections].some((node) => reaches(node, target, seen));
  };
  try {
    await engine.activate(project);
    engine.hitSample(sampler.id);
    assert.equal(engine.isPlaying, false, 'preview does not start transport');
    assert.equal(context.sources.length, 1, 'one dry hit, with no routed duplicate');
    const first = context.sources[0];
    assert.deepEqual(first.starts, [[0, 1]]);
    assert.equal(first.playbackRate.value, 0.5);
    assert.equal(first.stops.at(-1), 4);
    assert(reaches(first, context.destination), 'unpatched preview reaches speakers');
    assert(!reaches(first, context.recording), 'preview stays out of studio recording');
    // Later trim/speed changes must not make idle protection cut short the current hit.
    sampler.parameters.trimEnd = 0.3;
    sampler.parameters.rate = 2;
    engine.update(project);
    assert.equal(engine.remainingTailSeconds(), 4);
    context.currentTime = 0.1;
    engine.hitSample(sampler.id);
    assert.equal(context.sources.length, 2, 'each press creates a fresh playback');
    assert(first.stops.at(-1)! < 0.12, 'retrigger retires the previous preview');
    await engine.play(project);
    engine.hitSample(sampler.id);
    assert.equal(engine.isPlaying, true);
    assert.equal(context.sources.length, 3);
    assert(reaches(context.sources[2], context.destination), 'muted Output cannot mute preview');
    assert(!reaches(context.sources[2], context.recording));
    await engine.stop();
    assert.equal(context.sources[2].connections.size, 0, 'Stop releases preview voices');
    await engine.activate(project);
    engine.hitSample(sampler.id);
    assert.equal(context.sources.length, 4, 'preview works again after Stop');
    sampler.samples = {};
    engine.update(project);
    assert.equal(context.sources[3].connections.size, 0, 'Clear releases preview voices');
    engine.hitSample(sampler.id);
    assert.equal(context.sources.length, 4, 'empty sampler stays silent');
  } finally {
    await engine.dispose();
  }
  assert(context.sources.every((node) => node.connections.size === 0));
  assert.equal(context.state, 'closed');
});

test('sampler preview cleanup follows module/project lifetime while pad hits retain patch routing', async () => {
  const context = new Context();
  const engine = new AudioEngine(() => context.asAudioContext());
  const sampler = createModule('mic-sampler', 0, 0);
  sampler.samples = { clip: { name: 'Tone', pcm: encodeSamplePcm(new Float32Array(24000)) } };
  const project = { ...createProject(true), modules: [sampler] };
  try {
    await engine.activate(project);
    engine.hitSample(sampler.id);
    engine.hitDrum(sampler.id, 'kick', 1);
    const [preview, pad] = context.sources;
    const previewOutput = [...[...preview.connections][0].connections][0];
    assert(previewOutput.connections.has(context.destination));
    const routedOutput = [...[...pad.connections][0].connections][0];
    assert.equal(routedOutput.connections.size, 0, 'pad hit remains at the unpatched AUDIO OUT');
    engine.update({ ...project, modules: [] });
    assert.equal(preview.connections.size, 0, 'removing module stops preview');
    engine.update(project);
    engine.hitSample(sampler.id);
    engine.update({ ...project, id: crypto.randomUUID() });
    assert.equal(context.sources[2].connections.size, 0, 'switching project stops preview');
    engine.hitSample(sampler.id);
    await engine.dispose();
    assert.equal(context.sources[3].connections.size, 0, 'disposal stops preview');
  } finally {
    await engine.dispose();
  }
});
