import type { PlaybackPosition } from '../audio/playback-position';
import { usePlaybackStep } from '../hooks/usePlaybackStep';
import type { LiveControls } from '../audio/live';
import {
  connectedDrumKit,
  drumVoiceLabel,
  DRUM_LANES,
  DRUM_STEP_COUNT,
  type DrumSound,
} from '../domain/instruments';
import type { PatchModule, Project } from '../domain/types';

export function DrumMachinePanel({
  module,
  project,
  live,
  playing,
  position,
  onToggle,
  onEnabled,
}: {
  module: PatchModule;
  project: Project;
  live: LiveControls;
  playing: boolean;
  position: PlaybackPosition;
  onToggle: (sound: DrumSound, step: number) => void;
  onEnabled: () => void;
}) {
  const kit = connectedDrumKit(project, module.id);
  const step = usePlaybackStep(position, 1, DRUM_STEP_COUNT);
  return (
    <div className="drum-instrument">
      <div className="drum-toolbar">
        <span>16-STEP RHYTHM COMPOSER</span>
        <button
          className={module.parameters.enabled ? 'enabled' : ''}
          aria-pressed={Boolean(module.parameters.enabled)}
          onClick={onEnabled}
        >
          <i />
          {module.parameters.enabled ? 'PATTERN ON' : 'PATTERN OFF'}
        </button>
      </div>
      <div className="drum-pattern" role="group" aria-label="Drum step sequencer">
        <div className="drum-step-labels">
          <span>VOICE</span>
          {Array.from({ length: 16 }, (_, index) => (
            <small key={index}>{index + 1}</small>
          ))}
        </div>
        {DRUM_LANES.map((sound) => (
          <div className="drum-lane" key={sound}>
            <button
              className="drum-voice"
              aria-label={`Audition ${drumVoiceLabel(kit, sound)}`}
              title={`Voice ${DRUM_LANES.indexOf(sound) + 1}: ${drumVoiceLabel(kit, sound)} · Click to audition`}
              onClick={() => live.drumHit(module.id, sound)}
            >
              <small>{String(DRUM_LANES.indexOf(sound) + 1).padStart(2, '0')}</small>
              <span>{drumVoiceLabel(kit, sound)}</span>
            </button>
            {module.drumPattern?.[sound]?.map((on, index) => (
              <button
                key={index}
                className={`drum-step ${on ? 'on' : ''} ${playing && module.parameters.enabled && index === step ? 'current' : ''} ${index % 4 === 0 ? 'beat-start' : ''}`}
                aria-label={`${drumVoiceLabel(kit, sound)} (voice ${DRUM_LANES.indexOf(sound) + 1}) step ${index + 1}`}
                aria-pressed={on}
                onClick={() => onToggle(sound, index)}
              >
                <i />
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="drum-caption">
        <span>{kit ? '● EXTERNAL KIT · VOICES 1–4' : '● INTERNAL KIT · VOICES 1–4'}</span>
        <span>1/16 · SYNC TO TEMPO</span>
      </div>
    </div>
  );
}
