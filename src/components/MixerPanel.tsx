import { useRef, type PointerEvent } from 'react';
import type { ControlDefinition, PatchModule } from '../domain/types';
import { MIXER_INPUT_COUNTS, moduleDefinition, mixerInputCount } from '../domain/modules';

/** Native keyboard semantics, with a captured pointer so touch drags survive the rail's edge. */
function MixerFader({
  control,
  value,
  onChange,
}: {
  control: ControlDefinition;
  value: number;
  onChange: (value: number) => void;
}) {
  const pointer = useRef<number | null>(null);
  const move = (event: PointerEvent<HTMLInputElement>) => {
    if (pointer.current !== event.pointerId) return;
    const input = event.currentTarget,
      rect = input.getBoundingClientRect();
    // The CSS thumb and its travel scale with the workspace, including during zoom.
    const thumb =
      (parseFloat(getComputedStyle(input).getPropertyValue('--fader-thumb-height')) * rect.height) /
      input.offsetHeight;
    const fraction = Math.max(
      0,
      Math.min(1, (rect.bottom - thumb / 2 - event.clientY) / (rect.height - thumb)),
    );
    const next = control.min + fraction * (control.max - control.min);
    onChange(Number((Math.round(next / control.step) * control.step).toFixed(4)));
  };
  const end = (event: PointerEvent<HTMLInputElement>) => {
    if (pointer.current === event.pointerId) pointer.current = null;
  };
  return (
    <input
      type="range"
      aria-label={control.label}
      aria-valuetext={`${Math.round(value * 100)}%`}
      min={control.min}
      max={control.max}
      step={control.step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      onPointerDown={(event) => {
        if (event.button !== 0 || pointer.current !== null) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        pointer.current = event.pointerId;
        move(event);
      }}
      onPointerMove={move}
      onPointerUp={(event) => {
        move(event);
        end(event);
      }}
      onPointerCancel={end}
      onLostPointerCapture={end}
    />
  );
}

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
              <MixerFader
                control={control}
                value={Number(module.parameters[control.id])}
                onChange={(value) => onParameter(control.id, value)}
              />
            </div>
            <output>{Math.round(Number(module.parameters[control.id]) * 100)}%</output>
          </label>
        ))}
      </div>
    </>
  );
}
