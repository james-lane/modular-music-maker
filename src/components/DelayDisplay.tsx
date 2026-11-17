import { useEffect, useRef } from 'react';
import type { AudioEngine } from '../audio/engine';
import { MODULES } from '../domain/modules';
import { CONFIG } from '../config';
import type { Endpoint, Parameters } from '../domain/types';
import { delayPreviewPath } from './instrument-display';

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
  const path = useRef<SVGPathElement>(null),
    readout = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      previous = -Infinity;
    const draw = (now: number) => {
      if (active && Object.keys(modulation).length && !reduced.matches)
        frame = requestAnimationFrame(draw);
      if (now - previous < CONFIG.audio.visualizationIntervalMs) return;
      previous = now;
      const value = (id: 'time' | 'feedback' | 'mix') => {
        const source = modulation[id],
          control = MODULES.delay.controls.find((control) => control.id === id);
        if (!active || reduced.matches || !source || !control) return Number(parameters[id]);
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
      path.current?.setAttribute('d', delayPreviewPath(time, value('feedback'), value('mix')));
      if (readout.current) readout.current.textContent = String(Math.round(time * 1000));
    };
    const changed = () => {
      cancelAnimationFrame(frame);
      previous = -Infinity;
      draw(0);
    };
    reduced.addEventListener('change', changed);
    draw(0);
    return () => {
      cancelAnimationFrame(frame);
      reduced.removeEventListener('change', changed);
    };
  }, [
    parameters,
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
