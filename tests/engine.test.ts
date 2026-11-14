import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudioEngine } from '../src/audio/engine';
import { createModule, createProject } from '../src/domain/project';
import { midiFrequency } from '../src/domain/instruments';

class Parameter {
  value = 0;
  setValueAtTime(value: number) {
    this.value = value;
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
  start() {}
  stop() {}
}
class Context {
  currentTime = 0;
  sampleRate = 48000;
  state = 'suspended';
  destination = new Node();
  gains: Node[] = [];
  oscillators: Node[] = [];
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
    return new Node();
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
