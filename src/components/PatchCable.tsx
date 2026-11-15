import { memo, useMemo, type CSSProperties } from 'react';
import { MODULES } from '../domain/modules';
import { CONFIG } from '../config';
import type { CableStyle } from '../domain/preferences';
import type { PatchModule, SignalType } from '../domain/types';
import { braidedCablePaths, cablePath } from './cable-geometry';

interface Props {
  id: string;
  from: { x: number; y: number };
  span: { x: number; y: number };
  fromModule: PatchModule;
  toModule: PatchModule;
  signal: SignalType;
  cableStyle: CableStyle;
  cableOpacity: number;
  onUnplug: (id: string) => void;
}

export const PatchCable = memo(function PatchCable({
  id,
  from,
  span,
  fromModule,
  toModule,
  signal,
  cableStyle,
  cableOpacity,
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
  // Geometry is relative to its first socket, so camera movement only translates
  // the cable and does not regenerate the detailed braid on every pan frame.
  const start = { x: 0, y: 0 };
  const end = span;
  const path = cablePath(start, end);
  // Avoid asking SVG for an enormous offscreen filter surface on distant links.
  const shadow = Math.hypot(end.x, end.y) <= CONFIG.cables.maxShadowLength;
  const strands = useMemo(
    () => (braided ? braidedCablePaths(start, end) : null),
    [braided, end.x, end.y],
  );

  return (
    <g
      transform={`translate(${from.x},${from.y})`}
      className={`patch-cable signal-${signal}${braided ? ' braided' : ''}`}
      style={
        {
          opacity: cableOpacity,
          '--cable-color': braided ? sourceColor : classicColor,
          '--cable-source-color': `var(--enclosure-${fromModule.type})`,
          '--cable-target-color': `var(--enclosure-${toModule.type})`,
          '--cable-target-plug-color': targetColor,
        } as CSSProperties
      }
    >
      <path
        className="cable-hit"
        d={path}
        // Hidden cables must not intercept controls underneath their hit areas.
        style={cableOpacity === 0 ? { pointerEvents: 'none' } : undefined}
        onDoubleClick={() => onUnplug(id)}
      >
        <title>
          {MODULES[fromModule.type].name} → {MODULES[toModule.type].name} · {signal} · Double-click
          to unplug this cable
        </title>
      </path>
      <path className="cable-body" d={path} style={shadow ? undefined : { filter: 'none' }} />
      {strands && (
        <g className="cable-braid" aria-hidden="true">
          <path className="braid-source braid-under" d={strands.source.under} />
          <path className="braid-target braid-under" d={strands.target.under} />
          <path className="braid-source" d={strands.source.over} />
          <path className="braid-target" d={strands.target.over} />
        </g>
      )}
      <path className="cable-highlight" d={path} />
      {[start, end].map((position, index) => (
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
});
