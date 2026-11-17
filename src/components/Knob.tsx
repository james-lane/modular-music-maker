import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { ControlDefinition } from '../domain/types';

export function formatValue(value: number, control: ControlDefinition): string {
  if (control.unit === '%') return `${Math.round(value * 100)}%`;
  if (control.unit === 'Hz' && value >= 1000) return `${(value / 1000).toFixed(1)}k Hz`;
  return `${control.step < 1 ? value.toFixed(control.step < 0.1 ? 2 : 1) : value}${control.unit ? ` ${control.unit}` : ''}`;
}

/** Drag vertically like a hardware knob, use arrows for precise control, double-click to reset. */
export function Knob({
  control,
  value,
  onChange,
  large = false,
}: {
  control: ControlDefinition;
  value: number;
  onChange: (value: number) => void;
  large?: boolean;
}) {
  const drag = useRef<{ pointerId: number; startY: number; ratio: number } | null>(null);
  const ratio = control.logarithmic
    ? Math.log(value / control.min) / Math.log(control.max / control.min)
    : (value - control.min) / (control.max - control.min);
  const changeRatio = (next: number) => {
    const fraction = Math.max(0, Math.min(1, next));
    const raw = control.logarithmic
      ? control.min * (control.max / control.min) ** fraction
      : control.min + fraction * (control.max - control.min);
    const snapped = Math.round(raw / control.step) * control.step;
    onChange(Math.max(control.min, Math.min(control.max, Number(snapped.toFixed(4)))));
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || drag.current) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startY: event.clientY, ratio };
  };
  const keyDown = (event: KeyboardEvent) => {
    const direction = ['ArrowUp', 'ArrowRight'].includes(event.key)
      ? 1
      : ['ArrowDown', 'ArrowLeft'].includes(event.key)
        ? -1
        : 0;
    if (direction) {
      event.preventDefault();
      onChange(
        Math.min(
          control.max,
          Math.max(control.min, value + control.step * direction * (event.shiftKey ? 10 : 1)),
        ),
      );
    }
    if (event.key === 'Home') {
      event.preventDefault();
      onChange(control.min);
    }
    if (event.key === 'End') {
      event.preventDefault();
      onChange(control.max);
    }
  };
  return (
    <div className={`knob-control ${large ? 'large' : ''}`}>
      <div
        className="knob-assembly"
        role="slider"
        tabIndex={0}
        aria-label={control.label}
        aria-valuemin={control.min}
        aria-valuemax={control.max}
        aria-valuenow={value}
        aria-valuetext={formatValue(value, control)}
        title="Drag up or down · Arrow keys to adjust · Double-click to reset"
        onPointerDown={pointerDown}
        onPointerMove={(event) => {
          if (drag.current?.pointerId === event.pointerId)
            changeRatio(
              drag.current.ratio +
                (drag.current.startY - event.clientY) / (event.shiftKey ? 900 : 180),
            );
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointerId === event.pointerId) drag.current = null;
        }}
        onPointerCancel={(event) => {
          if (drag.current?.pointerId === event.pointerId) drag.current = null;
        }}
        onLostPointerCapture={(event) => {
          if (drag.current?.pointerId === event.pointerId) drag.current = null;
        }}
        onDoubleClick={() => onChange(control.default)}
        onKeyDown={keyDown}
        style={{ '--rotation': `${-135 + ratio * 270}deg` } as CSSProperties}
      >
        <div className="knob-ticks" />
        <div className="knob-dial">
          <i />
        </div>
      </div>
      <span className="control-label">{control.label}</span>
      <span className="control-value">{formatValue(value, control)}</span>
    </div>
  );
}
