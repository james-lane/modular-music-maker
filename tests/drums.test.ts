import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDrumRuntime } from '../src/audio/drums';
import { createModule } from '../src/domain/project';
import { encodeSamplePcm } from '../src/domain/samples';
import { DRUM_SOUNDS } from '../src/domain/instruments';

/** A small ownership spy, not an audio implementation. Browser QA verifies actual sound. */
class Parameter {
  value = 0;
  setValueAtTime(value: number) {
    assert.ok(Number.isFinite(value));
    this.value = value;
  }
  linearRampToValueAtTime(value: number) {
    this.setValueAtTime(value);
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
  onended?: () => void;
  connect(target: Node) {
    this.connections.add(target);
  }
  disconnect(target?: Node) {
    if (target) assert.ok(this.connections.delete(target), 'specific input connection must exist');
    else this.connections.clear();
  }
  start() {
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
