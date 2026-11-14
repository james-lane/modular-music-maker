import type { PatchModule } from '../domain/types';
import { MODULES } from '../domain/modules';

/** Channel-strip faders use the same saved gain parameters as the former mixer knobs. */
export function MixerPanel({
  module,
  onParameter,
}: {
  module: PatchModule;
  onParameter: (id: string, value: number) => void;
}) {
  return (
    <div className="mixer-channel-strips">
      {MODULES.mixer.controls.map((control) => (
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
  );
}
