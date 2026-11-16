import { useEffect, useMemo, useRef } from 'react';
import type { AudioEngine } from '../audio/engine';
import { CONFIG } from '../config';
import type { Endpoint, Parameters } from '../domain/types';
import { filterResponsePath } from './instrument-display';

/** Response is a parameter view, not a scope of the incoming sound. Only a live
 * MOD input needs animation; ordinary knob edits update even with audio stopped.
 */
export function FilterDisplay({
  parameters,
  engine,
  active,
  modulation,
}: {
  parameters: Parameters;
  engine: AudioEngine;
  active: boolean;
  modulation?: Endpoint;
}) {
  const path = useRef<SVGPathElement>(null);
  const cutoff = Number(parameters.cutoff),
    resonance = Number(parameters.resonance),
    mode = String(parameters.mode);
  const sampleRate = engine.sampleRate;
  const basePath = useMemo(
    () => filterResponsePath(mode, cutoff, resonance, sampleRate),
    [mode, cutoff, resonance, sampleRate],
  );
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      previous = -Infinity;
    const draw = (now: number) => {
      if (active && modulation && !reduced.matches) frame = requestAnimationFrame(draw);
      if (now - previous < CONFIG.audio.visualizationIntervalMs) return;
      previous = now;
      const input =
        active && modulation && !reduced.matches
          ? engine.readControl(modulation.moduleId, modulation.portId)
          : 0;
      path.current?.setAttribute(
        'd',
        filterResponsePath(mode, cutoff + input, resonance, sampleRate),
      );
    };
    const motionChanged = () => {
      cancelAnimationFrame(frame);
      previous = -Infinity;
      draw(0);
    };
    reduced.addEventListener('change', motionChanged);
    draw(0);
    return () => {
      cancelAnimationFrame(frame);
      reduced.removeEventListener('change', motionChanged);
    };
  }, [
    engine,
    active,
    modulation?.moduleId,
    modulation?.portId,
    mode,
    cutoff,
    resonance,
    sampleRate,
  ]);
  return (
    <div className="trace-display filter-trace filter-response">
      <svg
        viewBox={`0 0 ${CONFIG.audio.displays.width} ${CONFIG.audio.displays.height}`}
        role="img"
        aria-label={`Filter frequency response: ${mode}, cutoff ${cutoff} Hz, resonance ${resonance}`}
      >
        <path
          ref={path}
          d={basePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
