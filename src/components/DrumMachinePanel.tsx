import type { LiveControls } from '../audio/live';
import { DRUM_LANES, DRUM_SOUNDS, type DrumSound } from '../domain/instruments';
import type { PatchModule } from '../domain/types';

export function DrumMachinePanel({
  module,
  live,
  playing,
  step,
  onToggle,
  onEnabled,
}: {
  module: PatchModule;
  live: LiveControls;
  playing: boolean;
  step: number;
  onToggle: (sound: DrumSound, step: number) => void;
  onEnabled: () => void;
}) {
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
              aria-label={`Audition ${sound}`}
              title="Play this drum"
              onClick={() => live.drumHit(module.id, sound)}
            >
              {DRUM_SOUNDS.find((item) => item.id === sound)!.short}
            </button>
            {module.drumPattern?.[sound]?.map((on, index) => (
              <button
                key={index}
                className={`drum-step ${on ? 'on' : ''} ${playing && module.parameters.enabled && index === step ? 'current' : ''} ${index % 4 === 0 ? 'beat-start' : ''}`}
                aria-label={`${sound} step ${index + 1}`}
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
        <span>● KICK · SNARE · CLAP · HAT</span>
        <span>1/16 · SYNC TO TEMPO</span>
      </div>
    </div>
  );
}
