import type { AudioEngine } from '../audio/engine';
import { CONFIG } from '../config';
import type { PatchModule } from '../domain/types';
import { ControlScope } from './ControlScope';
import { lfoPreviewPath } from './instrument-display';

export function LfoDisplay({
  module,
  engine,
  active,
}: {
  module: PatchModule;
  engine: AudioEngine;
  active: boolean;
}) {
  const rate = Number(module.parameters.rate),
    depth = Number(module.parameters.depth);
  return active ? (
    <div className="lfo-display">
      <ControlScope engine={engine} moduleId={module.id} active={active} showReadout={false} />
    </div>
  ) : (
    <div className="trace-display lfo-display">
      <svg
        viewBox={`0 0 ${CONFIG.audio.displays.width} ${CONFIG.audio.displays.height}`}
        role="img"
        aria-label={`LFO preview: ${rate} Hz, depth ${depth} Hz`}
      >
        <path d={lfoPreviewPath(rate, depth)} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
}
