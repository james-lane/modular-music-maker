import { useRef } from 'react';
import { SAMPLER_TRIM } from '../domain/modules';
import type { Parameters } from '../domain/types';

/** Native sliders retain touch/keyboard access. Both ends share the original recording’s
 * timeline; clamping prevents a handle from crossing the other or creating an empty hit.
 */
export function SampleTrimControls({
  parameters,
  duration,
  disabled,
  onParameters,
}: {
  parameters: Parameters;
  duration: number;
  disabled: boolean;
  onParameters: (values: Parameters, group?: string) => void;
}) {
  const group = useRef('');
  const start = Number(parameters.trimStart);
  const end = Number(parameters.trimEnd);
  return (
    <div className="mic-trim-controls">
      {(['trimStart', 'trimEnd'] as const).map((id) => {
        const value = id === 'trimStart' ? start : end;
        return (
          <label key={id}>
            <span>
              {id === 'trimStart' ? 'Start' : 'End'}{' '}
              <output>{(value * duration).toFixed(2)}s</output>
            </span>
            <input
              type="range"
              aria-label={id === 'trimStart' ? 'Trim start' : 'Trim end'}
              aria-valuetext={`${(value * duration).toFixed(2)} seconds`}
              min={0}
              max={1}
              step={SAMPLER_TRIM.step}
              value={value}
              disabled={disabled}
              onPointerDown={() => {
                group.current = `trim:${crypto.randomUUID()}`;
              }}
              onKeyDown={(event) => {
                if (!event.repeat) group.current = `trim:${crypto.randomUUID()}`;
              }}
              onChange={(event) => {
                const next = Number(event.target.value);
                const bounded =
                  id === 'trimStart'
                    ? Math.max(0, Math.min(end - SAMPLER_TRIM.step, next))
                    : Math.min(1, Math.max(start + SAMPLER_TRIM.step, next));
                onParameters({ [id]: bounded }, group.current);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}
