import type { PatchModule } from '../domain/types';
import { MIXER_INPUT_COUNTS, moduleDefinition, mixerInputCount } from '../domain/modules';

/** Channel-strip faders use the same saved gain parameters as the former mixer knobs. */
export function MixerPanel({
  module,
  onParameter,
}: {
  module: PatchModule;
  onParameter: (id: string, value: number) => void;
}) {
  return (
    <>
      <label className="mixer-toolbar">
        Inputs
        <select
          aria-label="Mixer input count"
          title="Fewer inputs unplug removed cables. Undo restores them."
          value={mixerInputCount(module.parameters.inputCount)}
          onChange={(event) => onParameter('inputCount', Number(event.target.value))}
        >
          {MIXER_INPUT_COUNTS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </label>
      <div className="mixer-channel-strips">
        {moduleDefinition(module).controls.map((control) => (
          <label className="mixer-channel" key={control.id}>
            <span>{control.label}</span>
            <div className="fader-well">
              <div className="fader-scale" aria-hidden="true">
                <i>0</i>
                <i>−6</i>
                <i>−12</i>
                <i>∞</i>
              </div>
              <input
                type="range"
                aria-label={control.label}
                aria-valuetext={`${Math.round(Number(module.parameters[control.id]) * 100)}%`}
                min={control.min}
                max={control.max}
                step={control.step}
                value={Number(module.parameters[control.id])}
                onChange={(event) => onParameter(control.id, Number(event.target.value))}
              />
            </div>
            <output>{Math.round(Number(module.parameters[control.id]) * 100)}%</output>
          </label>
        ))}
      </div>
    </>
  );
}
