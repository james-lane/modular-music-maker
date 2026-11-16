import { ControlScope } from './ControlScope';
import type { AudioEngine } from '../audio/engine';
import { useEffect, useId, useRef, type CSSProperties, type PointerEvent } from 'react';
import { CONFIG } from '../config';
import { MODULES } from '../domain/modules';
import type { Parameters, PatchModule } from '../domain/types';
import { Knob } from './Knob';

export function XYControllerPanel({
  module,
  onParameters,
  engine,
  audioActive,
}: {
  engine: AudioEngine;
  audioActive: boolean;
  module: PatchModule;
  onParameters: (values: Parameters, group?: string) => void;
}) {
  const helpId = useId();
  const gesture = useRef<{ pointerId: number; group: string } | null>(null);
  const x = Number(module.parameters.x);
  const y = Number(module.parameters.y);
  const controls = MODULES['xy-controller'].controls;
  useEffect(() => {
    const cancel = () => {
      gesture.current = null;
    };
    const visibility = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const bounded = (value: number) => Math.max(-1, Math.min(1, Number(value.toFixed(2))));
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onParameters(
      {
        x: bounded(((event.clientX - rect.left) / rect.width) * 2 - 1),
        y: bounded(1 - ((event.clientY - rect.top) / rect.height) * 2),
      },
      gesture.current.group,
    );
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId === event.pointerId) gesture.current = null;
  };
  return (
    <div className="xy-instrument">
      <div className="instrument-caption">TWO AXIS MODULATION · X / Y</div>
      <div
        className="xy-pad"
        role="group"
        tabIndex={0}
        aria-label="XY modulation pad"
        aria-describedby={helpId}
        style={{ '--xy-x': `${(x + 1) * 50}%`, '--xy-y': `${(1 - y) * 50}%` } as CSSProperties}
        onPointerDown={(event) => {
          if (event.button !== 0 || gesture.current) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          gesture.current = {
            pointerId: event.pointerId,
            group: `xy:${event.pointerId}:${event.timeStamp}`,
          };
          move(event);
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          move(event);
          end(event);
        }}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onBlur={() => {
          gesture.current = null;
        }}
        onKeyDown={(event) => {
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          if (event.key === 'Home') {
            event.preventDefault();
            onParameters({ x: 0, y: 0 });
          }
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          const step = event.shiftKey ? CONFIG.xyPad.fineKeyboardStep : CONFIG.xyPad.keyboardStep;
          onParameters(
            {
              x: bounded(
                x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
              ),
              y: bounded(
                y + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0),
              ),
            },
            'xy:keys',
          );
        }}
      >
        <span className="xy-quadrant q1">01</span>
        <span className="xy-quadrant q2">02</span>
        <span className="xy-quadrant q3">03</span>
        <span className="xy-quadrant q4">04</span>
        <span className="xy-centre-label">ZERO</span>
        <i className="xy-crosshair horizontal" />
        <i className="xy-crosshair vertical" />
        <i className="xy-point" />
      </div>

      <ControlScope engine={engine} moduleId={module.id} ports="x,y" active={audioActive} />
      <div className="xy-lower">
        <div className="xy-position">
          <div className="xy-axes">
            {controls
              .filter((control) => control.id !== 'depth')
              .map((control) => (
                <label key={control.id}>
                  <span>{control.id.toUpperCase()}</span>
                  <input
                    type="range"
                    aria-label={control.label}
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={Number(module.parameters[control.id])}
                    onChange={(event) =>
                      onParameters({ [control.id]: Number(event.target.value) }, `xy:${control.id}`)
                    }
                  />
                  <output>{Number(module.parameters[control.id]).toFixed(2)}</output>
                </label>
              ))}
          </div>
          <button className="xy-reset" onClick={() => onParameters({ x: 0, y: 0 })}>
            Centre
          </button>
          <p id={helpId}>
            Slide to modulate · Centre is zero
            <br />
            Arrow keys move · Shift for fine control
          </p>
        </div>
        <Knob
          control={controls[2]}
          value={Number(module.parameters.depth)}
          onChange={(depth) => onParameters({ depth }, 'depth')}
        />
      </div>
    </div>
  );
}
