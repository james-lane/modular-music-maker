import { ControlScope } from './ControlScope';
import type { AudioEngine } from '../audio/engine';
import type { PlaybackPosition } from '../audio/playback-position';
import type { LiveControls } from '../audio/live';
import { MODULES, SEQUENCER_RATES, sequencerRate } from '../domain/modules';
import type { Parameters, PatchModule } from '../domain/types';
import { usePlaybackStep } from '../hooks/usePlaybackStep';
import { Knob } from './Knob';

export function ModulationPanel({
  module,
  playing,
  position,
  live,
  onParameters,
  engine,
  audioActive,
}: {
  engine: AudioEngine;
  audioActive: boolean;
  module: PatchModule;
  playing: boolean;
  position: PlaybackPosition;
  live: LiveControls;
  onParameters: (values: Parameters, group?: string) => void;
}) {
  const definition = MODULES[module.type];
  const sequenced = module.type === 'mod-sequencer';
  const envelope = module.type === 'envelope';
  const active = usePlaybackStep(position, sequencerRate(module.parameters.rate).ticks, 8);
  return (
    <div className="mod-instrument">
      <div className="instrument-caption">
        {envelope
          ? 'ATTACK → HOLD → RELEASE'
          : sequenced
            ? 'BIPOLAR CONTROL PATTERN'
            : 'RANDOM VOLTAGE · HOLD / GLIDE'}
      </div>
      <ControlScope engine={engine} moduleId={module.id} active={audioActive} />
      {sequenced ? (
        <div className="mod-steps">
          {definition.controls
            .filter((control) => control.id.startsWith('step'))
            .map((control, index) => (
              <label key={control.id} className={playing && active === index ? 'active' : ''}>
                <span>{index + 1}</span>
                <input
                  type="range"
                  aria-label={control.label}
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={Number(module.parameters[control.id])}
                  onChange={(event) =>
                    onParameters({ [control.id]: Number(event.target.value) }, control.id)
                  }
                />
                <output>{Number(module.parameters[control.id]).toFixed(2)}</output>
              </label>
            ))}
        </div>
      ) : null}
      {!envelope && (
        <label className="rate-display mod-rate">
          <span>STEP RATE</span>
          <select
            aria-label={sequenced ? 'Mod step rate' : 'Random step rate'}
            value={String(module.parameters.rate)}
            onChange={(event) => onParameters({ rate: event.target.value })}
          >
            {SEQUENCER_RATES.map((rate) => (
              <option key={rate.value} value={rate.value}>
                {rate.value}
              </option>
            ))}
          </select>
          <em>SYNC TO TEMPO</em>
        </label>
      )}
      <div className="module-knobs">
        {definition.controls
          .filter((control) => !control.id.startsWith('step'))
          .map((control) => (
            <Knob
              key={control.id}
              control={control}
              value={Number(module.parameters[control.id])}
              onChange={(value) => onParameters({ [control.id]: value }, control.id)}
            />
          ))}
      </div>
      {!sequenced && (
        <button className="mod-fire" onClick={() => live.drumHit(module.id, 'kick')}>
          {envelope ? 'Trigger envelope' : 'New random value'}
        </button>
      )}
    </div>
  );
}
