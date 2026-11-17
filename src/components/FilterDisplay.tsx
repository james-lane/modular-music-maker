import { useEffect, useMemo, useRef } from 'react';
import type { AudioEngine } from '../audio/engine';
import { MODULES } from '../domain/modules';
import { CONFIG } from '../config';
import type { Endpoint, Parameters } from '../domain/types';
import { filterResponsePath } from './instrument-display';
import { useAnimation } from '../hooks/useAnimation';
import { refreshVisual } from './visual-refresh';

/** Response is a parameter view, not a scope of the incoming sound. Only a live
 * MOD input needs animation; ordinary knob edits update even with audio stopped.
 */
export function FilterDisplay({
  parameters,
  engine,
  active,
  modulation,
  resonanceModulation,
}: {
  parameters: Parameters;
  engine: AudioEngine;
  active: boolean;
  modulation?: Endpoint;
  resonanceModulation?: Endpoint;
}) {
  const { reduced, systemReduced } = useAnimation();
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
    if (!path.current) return;
    const draw = () => {
      const input =
        active && modulation && !systemReduced
          ? engine.readControl(modulation.moduleId, modulation.portId)
          : 0;
      const qControl = MODULES.filter.controls.find((control) => control.id === 'resonance');
      const q =
        active && resonanceModulation && !systemReduced && qControl
          ? qControl.min +
            Math.max(
              0,
              Math.min(
                1,
                engine.readControl(resonanceModulation.moduleId, resonanceModulation.portId) /
                  CONFIG.audio.modulation.reference,
              ),
            ) *
              (qControl.max - qControl.min)
          : resonance;
      const next = filterResponsePath(mode, cutoff + input, q, sampleRate);
      if (path.current?.getAttribute('d') !== next) path.current?.setAttribute('d', next);
    };
    return refreshVisual(
      path.current,
      draw,
      active && Boolean(modulation || resonanceModulation) && !systemReduced,
      reduced ? CONFIG.audio.reducedVisualizationIntervalMs : CONFIG.audio.visualizationIntervalMs,
    );
  }, [
    engine,
    active,
    modulation?.moduleId,
    modulation?.portId,
    resonanceModulation?.moduleId,
    resonanceModulation?.portId,
    mode,
    cutoff,
    resonance,
    sampleRate,
    reduced,
    systemReduced,
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
