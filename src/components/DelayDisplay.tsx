import { useEffect, useRef } from 'react';
import type { AudioEngine } from '../audio/engine';
import { MODULES } from '../domain/modules';
import { CONFIG } from '../config';
import type { Endpoint, Parameters } from '../domain/types';
import { delayPreviewPath } from './instrument-display';
import { useAnimation } from '../hooks/useAnimation';
import { refreshVisual } from './visual-refresh';

export function DelayDisplay({
  parameters,
  engine,
  active,
  modulation = {},
}: {
  parameters: Parameters;
  engine: AudioEngine;
  active: boolean;
  modulation?: Partial<Record<'time' | 'feedback' | 'mix', Endpoint>>;
}) {
  const { reduced, systemReduced } = useAnimation();
  const path = useRef<SVGPathElement>(null),
    readout = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!path.current) return;
    const draw = () => {
      const value = (id: 'time' | 'feedback' | 'mix') => {
        const source = modulation[id],
          control = MODULES.delay.controls.find((control) => control.id === id);
        if (!active || systemReduced || !source || !control) return Number(parameters[id]);
        const unit = Math.max(
          0,
          Math.min(
            1,
            engine.readControl(source.moduleId, source.portId) / CONFIG.audio.modulation.reference,
          ),
        );
        return control.min + unit * (control.max - control.min);
      };
      const time = value('time');
      const next = delayPreviewPath(time, value('feedback'), value('mix'));
      if (path.current?.getAttribute('d') !== next) path.current?.setAttribute('d', next);
      const text = String(Math.round(time * 1000));
      if (readout.current && readout.current.textContent !== text)
        readout.current.textContent = text;
    };
    return refreshVisual(
      path.current,
      draw,
      active && Object.keys(modulation).length > 0 && !systemReduced,
      reduced ? CONFIG.audio.reducedVisualizationIntervalMs : CONFIG.audio.visualizationIntervalMs,
    );
  }, [
    parameters,
    reduced,
    systemReduced,
    engine,
    active,
    modulation.time?.moduleId,
    modulation.time?.portId,
    modulation.feedback?.moduleId,
    modulation.feedback?.portId,
    modulation.mix?.moduleId,
    modulation.mix?.portId,
  ]);
  const time = Number(parameters.time),
    feedback = Number(parameters.feedback),
    mix = Number(parameters.mix);
  return (
    <div className="delay-display">
      <svg
        viewBox={`0 0 ${CONFIG.audio.displays.width} ${CONFIG.audio.displays.height}`}
        role="img"
        aria-label={`Delay echo preview: ${time} seconds, feedback ${Math.round(feedback * 100)}%, mix ${Math.round(mix * 100)}%`}
      >
        <path
          ref={path}
          d={delayPreviewPath(time, feedback, mix)}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <strong>
        <span ref={readout}>{Math.round(time * 1000)}</span> <small>ms</small>
      </strong>
    </div>
  );
}
