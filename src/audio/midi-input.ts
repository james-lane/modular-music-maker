import { CONFIG } from '../config';
import type { Parameters } from '../domain/types';
import type { AudioRuntime } from './factories';

/** CC outputs are ordinary native control signals; no MIDI device is opened here. */
export function createMidiInput(context: AudioContext): AudioRuntime {
  const sources = Object.fromEntries(
    [1, 2, 3, 4].map((index) => {
      const source = context.createConstantSource();
      source.offset.value = 0;
      source.start();
      return [`mod${index}`, source];
    }),
  );
  let parameters: Parameters = {};
  const silence = () =>
    Object.values(sources).forEach((source) => {
      source.offset.cancelScheduledValues(context.currentTime);
      source.offset.setTargetAtTime(0, context.currentTime, CONFIG.audio.parameterRampSeconds);
    });
  return {
    inputs: {},
    outputs: sources,
    update(next) {
      parameters = next;
    },
    setControl(index, value) {
      const source = sources[`mod${index}`];
      if (!source || !Number.isFinite(value)) return;
      const unit = Math.max(0, Math.min(127, value)) / 127;
      source.offset.setTargetAtTime(
        (parameters[`bipolar${index}`] ? unit * 2 - 1 : unit) * CONFIG.audio.modulation.reference,
        context.currentTime,
        CONFIG.audio.parameterRampSeconds,
      );
    },
    silence,
    dispose() {
      Object.values(sources).forEach((source) => {
        source.stop();
        source.disconnect();
      });
    },
  };
}
