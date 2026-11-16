import { CONFIG } from '../config';
import { sequencerRate } from '../domain/modules';
import type { Parameters } from '../domain/types';
import type { AudioRuntime } from './factories';

const reference = CONFIG.audio.modulation.reference;
const ramp = CONFIG.audio.parameterRampSeconds;

/** Existing control cables carry cutoff-Hz-sized values. Receivers normalize and
 * clamp locally, preserving old LFO/filter patches without allowing runaway pitch.
 */
export function boundedModulation(
  context: AudioContext,
  scale: number,
  base = 0,
  unipolar = false,
) {
  const input = context.createGain();
  input.gain.value = 1 / reference;
  const bias = context.createConstantSource();
  bias.offset.value = base;
  const clamp = context.createWaveShaper();
  clamp.curve = Float32Array.from({ length: CONFIG.audio.modulation.curveSamples }, (_, index) => {
    const value = (index * 2) / (CONFIG.audio.modulation.curveSamples - 1) - 1;
    return (unipolar ? Math.max(0, value) : value) * scale;
  });
  input.connect(clamp);
  bias.connect(clamp);
  bias.start();
  return {
    input,
    output: clamp,
    setBase(value: number) {
      bias.offset.setTargetAtTime(value, context.currentTime, ramp);
    },
    dispose() {
      bias.stop();
      bias.disconnect();
      input.disconnect();
      clamp.disconnect();
    },
  };
}

export function createEnvelope(context: AudioContext): AudioRuntime {
  const source = context.createConstantSource();
  source.offset.value = 0;
  source.start();
  let parameters: Parameters = { attack: 0.05, release: 0.4, depth: 0.5 };
  let end = 0;
  let points = [{ time: context.currentTime, value: 0 }];
  const gate = (on: boolean, velocity: number, when: number) => {
    const start = Math.max(context.currentTime, when);
    // Anchor both ends explicitly: cancelAndHold alone does not insert a hold
    // after the final scheduled event on every browser, shortening the peak.
    const nextIndex = points.findIndex((point) => point.time > start);
    const before =
      nextIndex === 0
        ? points[0]
        : nextIndex < 0
          ? points[points.length - 1]
          : points[nextIndex - 1];
    const after = nextIndex < 0 ? undefined : points[nextIndex];
    const value =
      after && after.time > before.time
        ? before.value +
          ((after.value - before.value) * (start - before.time)) / (after.time - before.time)
        : before.value;
    source.offset.cancelAndHoldAtTime(start);
    source.offset.setValueAtTime(value, start);
    const duration = Number(parameters[on ? 'attack' : 'release']);
    source.offset.linearRampToValueAtTime(
      on ? velocity * Number(parameters.depth) * reference : 0,
      start + duration,
    );
    const target = on ? velocity * Number(parameters.depth) * reference : 0;
    points = points.filter((point) => point.time < start);
    points.push({ time: start, value }, { time: start + duration, value: target });
    // Retain the segment spanning now, plus future events, without accumulating history.
    let current = 0;
    points.forEach((point, index) => {
      if (point.time <= context.currentTime) current = index;
    });
    if (current > 0) points = points.slice(current);
    end = start + duration;
  };
  const silence = () => {
    source.offset.cancelScheduledValues(context.currentTime);
    source.offset.setValueAtTime(0, context.currentTime);
    end = 0;
    points = [{ time: context.currentTime, value: 0 }];
  };
  return {
    inputs: {},
    outputs: { out: source },
    update(next) {
      parameters = next;
    },
    gate,
    trigger(_sound, velocity, when) {
      gate(true, velocity, when);
      gate(false, velocity, Math.max(context.currentTime, when) + Number(parameters.attack));
    },
    remainingTailSeconds: () => Math.max(0, end - context.currentTime),
    silence,
    dispose() {
      silence();
      source.stop();
      source.disconnect();
    },
  };
}

function steppedControl(context: AudioContext, random?: () => number): AudioRuntime {
  const source = context.createConstantSource();
  const depth = context.createGain();
  source.offset.value = 0;
  depth.gain.value = 0;
  source.connect(depth);
  source.start();
  let parameters: Parameters = {};
  let externallyTriggered = false;
  const set = (value: number, time: number) => {
    // A tiny dezipper remains at zero Glide, without using a visual timer as a clock.
    source.offset.setTargetAtTime(
      value * reference,
      time,
      Math.max(0.001, Number(parameters.glide)),
    );
  };
  const nextRandom = (time: number) => {
    if (random) set(random() * 2 - 1, time);
  };
  const silence = () => {
    source.offset.cancelScheduledValues(context.currentTime);
    source.offset.setValueAtTime(0, context.currentTime);
  };
  return {
    inputs: {},
    outputs: { out: depth },
    update(next) {
      parameters = next;
      depth.gain.setTargetAtTime(Number(next.depth), context.currentTime, ramp);
    },
    configureConnections(ports) {
      externallyTriggered = ports.has('trigger');
    },
    scheduleControl(tick, time) {
      if (random && externallyTriggered) return;
      const ticks = sequencerRate(parameters.rate).ticks;
      if (tick % ticks !== 0) return;
      if (random) nextRandom(time);
      else set(Number(parameters[`step${(Math.floor(tick / ticks) % 8) + 1}`]), time);
    },
    ...(random
      ? ({
          trigger: (_sound, _velocity, when) => nextRandom(Math.max(context.currentTime, when)),
        } satisfies Pick<AudioRuntime, 'trigger'>)
      : {}),
    silence,
    dispose() {
      silence();
      source.stop();
      source.disconnect();
      depth.disconnect();
    },
  };
}

export const createModSequencer = (context: AudioContext) => steppedControl(context);
export const createRandomMod = (context: AudioContext, random: () => number = Math.random) =>
  steppedControl(context, random);

export function createXYController(context: AudioContext): AudioRuntime {
  const x = context.createConstantSource();
  const y = context.createConstantSource();
  x.offset.value = y.offset.value = 0;
  x.start();
  y.start();
  return {
    inputs: {},
    outputs: { x, y },
    update(parameters) {
      const depth = Number(parameters.depth) * reference;
      x.offset.setTargetAtTime(Number(parameters.x) * depth, context.currentTime, ramp);
      y.offset.setTargetAtTime(Number(parameters.y) * depth, context.currentTime, ramp);
    },
    dispose() {
      x.stop();
      y.stop();
      x.disconnect();
      y.disconnect();
    },
  };
}
