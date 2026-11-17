import { DelayDisplay } from './DelayDisplay';
import { LfoDisplay } from './LfoDisplay';
import { FilterDisplay } from './FilterDisplay';
import { ModulePorts } from './ModulePorts';
import { ModulationPanel } from './ModulationPanel';
import { XYControllerPanel } from './XYControllerPanel';
import type { PlaybackPosition } from '../audio/playback-position';
import { GripVertical, X } from 'lucide-react';
import type { CSSProperties, PointerEvent } from 'react';
import type { AudioEngine } from '../audio/engine';
import { moduleDefinition } from '../domain/modules';
import type { DrumSample, Endpoint, Parameters, PatchModule, Project } from '../domain/types';
import { Knob } from './Knob';
import { LevelMeter, Scope } from './Scope';
import { Waveform } from './Waveform';
import type { LiveControls } from '../audio/live';
import type { DrumSound } from '../domain/instruments';
import { MicSamplerPanel } from './MicSamplerPanel';
import type { MicrophoneControls } from '../hooks/useMicrophoneSampler';
import { DrumKitPanel } from './DrumKitPanel';
import { DrumMachinePanel } from './DrumMachinePanel';
import { KeyboardPanel } from './KeyboardPanel';
import { PadControllerPanel } from './PadControllerPanel';
import { MixerPanel } from './MixerPanel';
import { MergerPanel } from './MergerPanel';
import { SwitchPanel } from './SwitchPanel';
import type { StepNoteChange } from './SequencerStep';
import { SequencerPanel } from './SequencerPanel';
import { XYEffectsPanel } from './XYEffectsPanel';

interface Props {
  onSwitchSchedule: () => void;
  module: PatchModule;
  /** Drawing-origin-relative placement only; world positions remain in the saved module. */
  position: { x: number; y: number };
  scale: number;
  project: Project;
  selected: boolean;
  playbackPosition: PlaybackPosition;
  live: LiveControls;
  audioActive: boolean;
  microphone: MicrophoneControls;
  engine: AudioEngine;
  playing: boolean;
  pending: Endpoint | null;
  onParameter: (id: string, value: number | string | boolean) => void;
  onParameters: (values: Parameters, group?: string) => void;
  onSample: (lane: string, sample: DrumSample | null) => boolean;
  onDrumStep: (sound: DrumSound, step: number) => void;
  onStep: (index: number, degree: StepNoteChange, group?: string) => void;
  onPort: (endpoint: Endpoint) => void;
  onRemove: () => void;
  onDragStart: (event: PointerEvent<HTMLElement>) => void;
  onSelect: () => void;
}

export function ModuleCard({
  onSwitchSchedule,
  module,
  position,
  scale,
  project,
  selected,
  playbackPosition,
  live,
  audioActive,
  microphone,
  engine,
  playing,
  pending,
  onParameter,
  onParameters,
  onDrumStep,
  onSample,
  onStep,
  onPort,
  onRemove,
  onDragStart,
  onSelect,
}: Props) {
  const definition = moduleDefinition(module);
  return (
    <article
      className={`module-panel ${selected ? 'selected' : ''} module-${module.type}`}
      style={
        {
          left: position.x * scale,
          top: position.y * scale,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'top left',
          width: definition.width,
          height: definition.height,
          '--module-color': definition.color,
        } as CSSProperties
      }
      aria-label={`${definition.name} module`}
      data-module-id={module.id}
      onPointerDown={onSelect}
    >
      <i className="panel-screw top-left" />
      <i className="panel-screw top-right" />
      <i className="panel-screw bottom-left" />
      <i className="panel-screw bottom-right" />
      <header className="module-header" onPointerDown={onDragStart}>
        <div className="module-title">
          <span className="module-indicator" />
          <h2>{definition.name}</h2>
        </div>
        <div className="module-header-actions">
          <GripVertical size={13} />
          <button
            className="module-remove"
            title={`Remove ${definition.name}`}
            aria-label={`Remove ${definition.name}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onRemove}
          >
            <X size={12} />
          </button>
        </div>
        <span className="module-code">{definition.code}</span>
      </header>
      <div className="module-content">
        {module.type === 'drum-machine' && (
          <DrumMachinePanel
            module={module}
            project={project}
            live={live}
            playing={playing}
            position={playbackPosition}
            onToggle={onDrumStep}
            onEnabled={() => onParameter('enabled', !module.parameters.enabled)}
          />
        )}
        {module.type === 'drum-kit' && (
          <DrumKitPanel
            module={module}
            project={project}
            live={live}
            onParameter={onParameter}
            onSample={onSample}
          />
        )}
        {module.type === 'mic-sampler' && (
          <MicSamplerPanel
            module={module}
            microphone={microphone}
            live={live}
            onParameters={onParameters}
            onClear={() => onSample('clip', null)}
          />
        )}
        {module.type === 'keyboard' && <KeyboardPanel module={module} live={live} />}
        {module.type === 'xy-effects' && (
          <XYEffectsPanel module={module} onParameters={onParameters} />
        )}
        {module.type === 'pad-controller' && (
          <PadControllerPanel
            module={module}
            project={project}
            live={live}
            onCount={(count) => onParameter('padCount', count)}
          />
        )}
        {module.type === 'sequencer' && (
          <SequencerPanel
            module={module}
            project={project}
            playing={playing}
            position={playbackPosition}
            onParameter={onParameter}
            onStep={onStep}
          />
        )}
        {['envelope', 'mod-sequencer', 'random-mod'].includes(module.type) && (
          <ModulationPanel
            module={module}
            playing={playing}
            position={playbackPosition}
            engine={engine}
            audioActive={audioActive}
            live={live}
            onParameters={onParameters}
          />
        )}
        {module.type === 'xy-controller' && (
          <XYControllerPanel
            module={module}
            onParameters={onParameters}
            engine={engine}
            audioActive={audioActive}
          />
        )}
        {module.type === 'oscillator' && (
          <>
            <div className="trace-display">
              <Waveform waveform={String(module.parameters.waveform)} />
              <span>ANALOG WAVEFORM</span>
            </div>
            <div className="waveform-selector">
              {[
                ['sine', '∿'],
                ['triangle', '⋀'],
                ['sawtooth', '⩘'],
                ['square', '⊓'],
              ].map(([value, symbol]) => (
                <button
                  key={value}
                  className={module.parameters.waveform === value ? 'active' : ''}
                  aria-label={`${value} waveform`}
                  aria-pressed={module.parameters.waveform === value}
                  title={value}
                  onClick={() => onParameter('waveform', value)}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </>
        )}
        {module.type === 'filter' && (
          <>
            <FilterDisplay
              parameters={module.parameters}
              engine={engine}
              active={audioActive}
              modulation={
                project.cables.find(
                  (cable) => cable.to.moduleId === module.id && cable.to.portId === 'cutoff',
                )?.from
              }
            />
            <div className="mode-selector">
              {[
                ['lowpass', 'LOW PASS'],
                ['highpass', 'HIGH PASS'],
                ['bandpass', 'BAND'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={module.parameters.mode === value ? 'active' : ''}
                  aria-pressed={module.parameters.mode === value}
                  onClick={() => onParameter('mode', value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
        {module.type === 'output' && (
          <>
            <Scope engine={engine} playing={audioActive} />
            <LevelMeter engine={engine} playing={audioActive} />
          </>
        )}
        {module.type === 'delay' && <DelayDisplay parameters={module.parameters} />}
        {module.type === 'mixer' && <MixerPanel module={module} onParameter={onParameter} />}
        {module.type === 'switch' && (
          <SwitchPanel
            module={module}
            project={project}
            onParameters={onParameters}
            position={playbackPosition}
            playing={playing}
            onEditSchedule={onSwitchSchedule}
          />
        )}
        {module.type === 'merger' && (
          <MergerPanel module={module} project={project} onParameter={onParameter} />
        )}
        {module.type === 'lfo' && (
          <LfoDisplay module={module} engine={engine} active={audioActive} />
        )}
        {![
          'sequencer',
          'mixer',
          'merger',
          'xy-effects',
          'switch',
          'envelope',
          'mod-sequencer',
          'random-mod',
          'xy-controller',
        ].includes(module.type) && (
          <div className={`module-knobs ${definition.controls.length === 1 ? 'single-knob' : ''}`}>
            {definition.controls
              .filter(
                (control) =>
                  module.type !== 'mic-sampler' || !['trimStart', 'trimEnd'].includes(control.id),
              )
              .map((control) => (
                <Knob
                  key={control.id}
                  control={control}
                  value={Number(module.parameters[control.id])}
                  onChange={(value) => onParameter(control.id, value)}
                  large={module.type === 'output'}
                />
              ))}
          </div>
        )}
      </div>
      <ModulePorts module={module} project={project} pending={pending} onPort={onPort} />
    </article>
  );
}
