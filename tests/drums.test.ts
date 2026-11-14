import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDrumRuntime } from '../src/audio/drums';
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
  connections = new Set<Node>();
  stops: (number | undefined)[] = [];
  started = false;
  onended?: () => void;
  connect(target: Node) {
    this.connections.add(target);
  }
  disconnect() {
    this.connections.clear();
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
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
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
