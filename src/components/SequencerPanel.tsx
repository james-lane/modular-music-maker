import type { PlaybackPosition } from '../audio/playback-position';
import { usePlaybackStep } from '../hooks/usePlaybackStep';
import { MODULES, SEQUENCER_RATES, sequencerRate } from '../domain/modules';
import { noteLabel } from '../domain/project';
import type { PatchModule, Project } from '../domain/types';
import { Knob } from './Knob';
import { SequencerStep, type StepNoteChange } from './SequencerStep';

interface Props {
  module: PatchModule;
  project: Project;
  playing: boolean;
  position: PlaybackPosition;
  onParameter: (id: string, value: number | string | boolean) => void;
  onStep: (index: number, degree: StepNoteChange, group?: string) => void;
}

export function SequencerPanel({ module, project, playing, position, onParameter, onStep }: Props) {
  const rate = sequencerRate(module.parameters.rate);
  const steps = module.steps ?? [];
  // Derive lights from the audio-clock tick; rendering never advances the musical clock.
  const activeStep = usePlaybackStep(position, rate.ticks, steps.length);

  return (
    <>
      <div className="instrument-caption">
        <span>8-STEP NOTE SEQUENCER</span>
        <span className={`tiny-led ${playing ? 'on' : ''}`} />
      </div>
      <div className="sequence-steps">
        {steps.map((degree, index) => (
          <SequencerStep
            key={index}
            degree={degree}
            index={index}
            label={noteLabel(project, degree)}
            active={index === activeStep && playing}
            onChange={(next, group) => onStep(index, next, group)}
          />
        ))}
      </div>
      <div className="sequencer-lower">
        <label className="rate-display">
          <span>STEP RATE</span>
          <select
            aria-label="Step rate"
            value={rate.value}
            onChange={(event) => onParameter('rate', event.target.value)}
          >
            {SEQUENCER_RATES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value}
              </option>
            ))}
          </select>
          <em>SYNC TO TEMPO</em>
        </label>
        <Knob
          control={MODULES.sequencer.controls[0]}
          value={Number(module.parameters.gate)}
          onChange={(value) => onParameter('gate', value)}
        />
      </div>
    </>
  );
}
