import { useMemo, type CSSProperties } from 'react';
import { MODULES } from '../domain/modules';
import type { CableStyle } from '../domain/preferences';
import type { PatchModule, SignalType } from '../domain/types';
import { braidedCablePaths, cablePath } from './cable-geometry';

interface Props {
  from: { x: number; y: number };
  to: { x: number; y: number };
  fromModule: PatchModule;
  toModule: PatchModule;
  signal: SignalType;
  cableStyle: CableStyle;
  onUnplug: () => void;
}

export function PatchCable({
  from,
  to,
  fromModule,
  toModule,
  signal,
  cableStyle,
  onUnplug,
}: Props) {
  const sourceColor = MODULES[fromModule.type].color;
  const targetColor = MODULES[toModule.type].color;
  const classicColor =
    signal === 'pitch'
      ? 'var(--cable-pitch-color)'
      : signal === 'control'
        ? 'var(--cable-control-color)'
        : signal === 'trigger'
          ? 'var(--cable-trigger-color)'
          : signal === 'kit'
            ? 'var(--cable-kit-color)'
            : sourceColor;
  const braided = cableStyle === 'braided';
  const path = cablePath(from, to);
  const strands = useMemo(
    () => (braided ? braidedCablePaths(from, to) : null),
    [braided, from.x, from.y, to.x, to.y],
  );

  return (
    <g
      className={`patch-cable signal-${signal}${braided ? ' braided' : ''}`}
      style={
        {
          '--cable-color': braided ? sourceColor : classicColor,
          '--cable-source-color': `var(--enclosure-${fromModule.type})`,
          '--cable-target-color': `var(--enclosure-${toModule.type})`,
          '--cable-target-plug-color': targetColor,
        } as CSSProperties
      }
    >
      <path className="cable-hit" d={path} onDoubleClick={onUnplug}>
        <title>
          {MODULES[fromModule.type].name} → {MODULES[toModule.type].name} · {signal} · Double-click
          to unplug this cable
        </title>
      </path>
      <path className="cable-body" d={path} />
      {strands && (
        <g className="cable-braid" aria-hidden="true">
          <path className="braid-source braid-under" d={strands.source.under} />
          <path className="braid-target braid-under" d={strands.target.under} />
          <path className="braid-source" d={strands.source.over} />
          <path className="braid-target" d={strands.target.over} />
        </g>
      )}
      <path className="cable-highlight" d={path} />
      {[from, to].map((position, index) => (
        <g
          key={index}
          className={`cable-plug${braided && index === 1 ? ' cable-plug-target' : ''}`}
          transform={`translate(${position.x},${position.y})`}
        >
          <rect x="-6" y="-9" width="12" height="23" rx="4" />
          <path d="M-4 4H4M-4 7H4" />
        </g>
      ))}
    </g>
  );
}
