import { CONFIG } from '../config';
import type { Parameters } from '../domain/types';
import { delayPreviewPath } from './instrument-display';

export function DelayDisplay({ parameters }: { parameters: Parameters }) {
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
          d={delayPreviewPath(time, feedback, mix)}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <strong>
        {Math.round(time * 1000)} <small>ms</small>
      </strong>
    </div>
  );
}
