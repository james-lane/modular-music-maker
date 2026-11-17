import { CONFIG } from '../config';
import type { ModuleDefinition } from '../domain/types';
import type { AudioRuntime } from './factories';

export interface ParameterTarget {
  parameter: AudioParam;
  scale?: number;
  offset?: number;
}

/** A MOD cable takes over the named setting over its registry range. Nodes are
 * allocated lazily: old/unpatched graphs keep their original native signal path.
 * The intrinsic parameter is cleared so a saved knob value cannot be added twice.
 */
export function withParameterInputs(
  context: AudioContext,
  definition: ModuleDefinition,
  runtime: AudioRuntime,
): AudioRuntime {
  const inputs = { ...runtime.inputs };
  const active = new Map<string, { dispose: () => void; reset: () => void }>();
  for (const input of definition.modulationInputs ?? []) {
    const targets = runtime.modulationTargets?.[input.control];
    const control = definition.controls.find((control) => control.id === input.control);
    if (!targets || !control)
      throw new Error(`Missing MOD implementation: ${definition.type}.${input.id}`);
    Object.defineProperty(inputs, input.id, {
      enumerable: true,
      get() {
        let connected = active.get(input.id);
        if (!connected) {
          const normalizer = context.createGain();
          normalizer.gain.value = 1 / CONFIG.audio.modulation.reference;
          const curve = context.createWaveShaper();
          const min = input.multiplier ? 0 : control.min;
          const max = input.multiplier ? 1 : control.max;
          curve.curve = Float32Array.from(
            { length: CONFIG.audio.modulation.curveSamples },
            (_, index) => {
              const unit = Math.max(
                0,
                Math.min(1, (index * 2) / (CONFIG.audio.modulation.curveSamples - 1) - 1),
              );
              return min + unit * (max - min);
            },
          );
          normalizer.connect(curve);
          const scalers: GainNode[] = [];
          for (const target of targets) {
            if (target.scale !== undefined) {
              const gain = context.createGain();
              gain.gain.value = target.scale;
              curve.connect(gain);
              gain.connect(target.parameter);
              scalers.push(gain);
            } else curve.connect(target.parameter);
          }
          const reset = () => {
            for (const target of targets) {
              target.parameter.cancelScheduledValues(context.currentTime);
              target.parameter.setValueAtTime(target.offset ?? 0, context.currentTime);
            }
          };
          connected = {
            reset,
            dispose() {
              normalizer.disconnect();
              curve.disconnect();
              scalers.forEach((node) => node.disconnect());
            },
          };
          active.set(input.id, connected);
          // Cache the native endpoint, rather than allocating on subsequent lookups.
          Object.defineProperty(inputs, input.id, {
            value: normalizer,
            enumerable: true,
            configurable: true,
          });
          reset();
          return normalizer;
        }
        throw new Error('MOD endpoint was not cached');
      },
      configurable: true,
    });
  }
  return {
    ...runtime,
    inputs,
    update(parameters) {
      runtime.update(parameters);
      active.forEach((input) => input.reset());
    },
    dispose() {
      active.forEach((input) => input.dispose());
      runtime.dispose();
    },
  };
}
