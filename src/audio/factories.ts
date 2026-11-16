import { CONFIG } from '../config';
import type { DrumSample, ModuleType, Parameters, PatchModule } from '../domain/types';
import type { DrumLane, DrumSound, KitSamplerSources } from '../domain/instruments';
import { createDrumRuntime } from './drums';
import { MODULES } from '../domain/modules';
import { createMicSampler } from './mic-sampler';
import { createXYEffects } from './xy-effects';

export interface AudioRuntime {
  inputs: Record<string, AudioNode | AudioParam>;
  outputs: Record<string, AudioNode>;
  update: (parameters: Parameters) => void;
  dispose: () => void;
  /** Only pitched voices expose an envelope and frequency for the note scheduler. */
  voice?: { frequency: AudioParam; envelope: AudioParam };
  trigger?: (sound: DrumSound, velocity: number, time: number) => void;
  silence?: () => void;
  remainingTailSeconds?: () => number;
  configureSample?: (sample: DrumSample | undefined) => void;
  configureKit?: (
    kit: PatchModule | undefined,
    samplers?: KitSamplerSources,
    effectInputs?: Partial<Record<DrumLane, AudioNode>>,
  ) => void;
}

type Factory = (context: AudioContext, masterBus: AudioNode) => AudioRuntime;
const value = (parameters: Parameters, key: string) => Number(parameters[key]);
const smooth = (parameter: AudioParam, target: number, context: AudioContext) => {
  parameter.setTargetAtTime(target, context.currentTime, CONFIG.audio.parameterRampSeconds);
};

/** Native Web Audio factories have no React or persistence dependencies.
 * Every owned source/node must be released in dispose(), including feedback connections.
 */
export const AUDIO_FACTORIES: Record<ModuleType, Factory> = {
  'xy-effects': createXYEffects,
  'mic-sampler': createMicSampler,
  'drum-machine': createDrumRuntime,
  'drum-kit': (context) => {
    // Four independent buses carry external audio. The KIT route assigns their voices;
    // envelopes belong to each receiving drum machine, allowing independent fan-out.
    const buses = Object.fromEntries(
      MODULES['drum-kit'].ports
        .filter((port) => port.signal === 'audio')
        .map((port) => [port.id, context.createGain()]),
    );
    return {
      inputs: buses,
      outputs: buses,
      update() {},
      dispose() {
        Object.values(buses).forEach((node) => node.disconnect());
      },
    };
  },
  keyboard: () => ({ inputs: {}, outputs: {}, update() {}, dispose() {} }),
  'pad-controller': () => ({ inputs: {}, outputs: {}, update() {}, dispose() {} }),
  sequencer: () => ({ inputs: {}, outputs: {}, update() {}, dispose() {} }),

  oscillator(context) {
    const oscillator = context.createOscillator();
    const amplitude = context.createGain();
    amplitude.gain.value = 0;
    oscillator.connect(amplitude);
    oscillator.start();
    return {
      inputs: {},
      outputs: { out: amplitude },
      voice: { frequency: oscillator.frequency, envelope: amplitude.gain },
      update(parameters) {
        oscillator.type = parameters.waveform as OscillatorType;
        smooth(oscillator.detune, value(parameters, 'detune'), context);
      },
      dispose() {
        oscillator.stop();
        oscillator.disconnect();
        amplitude.disconnect();
      },
    };
  },

  noise(context) {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
    return {
      inputs: {},
      outputs: { out: gain },
      update(parameters) {
        smooth(gain.gain, value(parameters, 'level'), context);
      },
      dispose() {
        source.stop();
        source.disconnect();
        gain.disconnect();
      },
    };
  },

  lfo(context) {
    const oscillator = context.createOscillator();
    const depth = context.createGain();
    oscillator.type = 'sine';
    oscillator.connect(depth);
    oscillator.start();
    return {
      inputs: {},
      outputs: { out: depth },
      update(parameters) {
        smooth(oscillator.frequency, value(parameters, 'rate'), context);
        smooth(depth.gain, value(parameters, 'depth'), context);
      },
      dispose() {
        oscillator.stop();
        oscillator.disconnect();
        depth.disconnect();
      },
    };
  },

  filter(context) {
    const filter = context.createBiquadFilter();
    return {
      inputs: { in: filter, cutoff: filter.frequency },
      outputs: { out: filter },
      update(parameters) {
        filter.type = parameters.mode as BiquadFilterType;
        smooth(filter.frequency, value(parameters, 'cutoff'), context);
        smooth(filter.Q, value(parameters, 'resonance'), context);
      },
      dispose() {
        filter.disconnect();
      },
    };
  },

  delay(context) {
    const input = context.createGain();
    const delay = context.createDelay(2);
    const feedback = context.createGain();
    const wet = context.createGain();
    const dry = context.createGain();
    const output = context.createGain();
    input.connect(delay);
    input.connect(dry);
    dry.connect(output);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(output);
    return {
      inputs: { in: input },
      outputs: { out: output },
      update(parameters) {
        smooth(delay.delayTime, value(parameters, 'time'), context);
        smooth(feedback.gain, value(parameters, 'feedback'), context);
        smooth(wet.gain, value(parameters, 'mix'), context);
        smooth(dry.gain, 1 - value(parameters, 'mix'), context);
      },
      dispose() {
        [input, delay, feedback, wet, dry, output].forEach((node) => node.disconnect());
      },
    };
  },

  reverb(context) {
    const input = context.createGain();
    const convolver = context.createConvolver();
    const wet = context.createGain();
    const dry = context.createGain();
    const output = context.createGain();
    // A decaying stereo impulse is generated locally: no sample downloads or asset licenses.
    const impulse = context.createBuffer(2, context.sampleRate * 2.5, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let index = 0; index < data.length; index++)
        data[index] = (Math.random() * 2 - 1) * (1 - index / data.length) ** 3;
    }
    convolver.buffer = impulse;
    input.connect(convolver);
    convolver.connect(wet);
    wet.connect(output);
    input.connect(dry);
    dry.connect(output);
    return {
      inputs: { in: input },
      outputs: { out: output },
      update(parameters) {
        smooth(wet.gain, value(parameters, 'mix'), context);
        smooth(dry.gain, 1 - value(parameters, 'mix'), context);
      },
      dispose() {
        [input, convolver, wet, dry, output].forEach((node) => node.disconnect());
      },
    };
  },

  mixer(context) {
    const a = context.createGain();
    const b = context.createGain();
    const output = context.createGain();
    a.connect(output);
    b.connect(output);
    return {
      inputs: { a, b },
      outputs: { out: output },
      update(parameters) {
        smooth(a.gain, value(parameters, 'a'), context);
        smooth(b.gain, value(parameters, 'b'), context);
      },
      dispose() {
        [a, b, output].forEach((node) => node.disconnect());
      },
    };
  },

  merger(context) {
    const sum = context.createGain();
    sum.gain.value = 0;
    // Each socket gets its own node. Reusing one node for every input would collapse
    // two cables from the same source into a single Web Audio connection.
    const inputs = Object.fromEntries(
      MODULES.merger.ports
        .filter((port) => port.direction === 'input')
        .map((port) => {
          const input = context.createGain();
          input.connect(sum);
          return [port.id, input];
        }),
    );
    return {
      inputs,
      outputs: { out: sum },
      update(parameters) {
        for (const [id, input] of Object.entries(inputs)) {
          smooth(input.gain, value(parameters, id), context);
        }
        // A fixed level preserves existing balances when another input is plugged in.
        smooth(sum.gain, value(parameters, 'level'), context);
      },
      dispose() {
        Object.values(inputs).forEach((input) => input.disconnect());
        sum.disconnect();
      },
    };
  },

  switch(context) {
    const output = context.createGain();
    const inputs = Object.fromEntries(
      MODULES.switch.ports
        .filter((port) => port.direction === 'input')
        .map((port) => {
          const input = context.createGain();
          // Start closed: an inactive input must never leak on graph creation.
          input.gain.value = 0;
          input.connect(output);
          return [port.id, input];
        }),
    );
    return {
      inputs,
      outputs: { out: output },
      update(parameters) {
        // Retargeting these gains preserves the graph, source clocks and effect tails.
        // The shared smoothing time also keeps rapid changes continuous.
        for (const [id, input] of Object.entries(inputs))
          smooth(input.gain, id === `in${parameters.selected}` ? 1 : 0, context);
      },
      dispose() {
        Object.values(inputs).forEach((input) => input.disconnect());
        output.disconnect();
      },
    };
  },

  output(context, masterBus) {
    const gain = context.createGain();
    gain.connect(masterBus);
    return {
      inputs: { in: gain },
      outputs: {},
      update(parameters) {
        smooth(gain.gain, value(parameters, 'level'), context);
      },
      dispose() {
        gain.disconnect();
      },
    };
  },
};
