import { GripVertical, X } from 'lucide-react';
import type { CSSProperties, PointerEvent } from 'react';
import type { AudioEngine } from '../audio/engine';
import { MODULES } from '../domain/modules';
import { noteLabel } from '../domain/project';
import type { DrumSample, Endpoint, Parameters, PatchModule, Project } from '../domain/types';
import { Knob } from './Knob';
import { LevelMeter, Scope } from './Scope';
import { Waveform } from './Waveform';
import type { LiveControls } from '../audio/live';
import type { DrumLane, DrumSound } from '../domain/instruments';
import { DrumKitPanel } from './DrumKitPanel';
import { DrumMachinePanel } from './DrumMachinePanel';
import { KeyboardPanel } from './KeyboardPanel';
import { PadControllerPanel } from './PadControllerPanel';
import { MixerPanel } from './MixerPanel';
import { MergerPanel } from './MergerPanel';
import { SequencerStep, type StepNoteChange } from './SequencerStep';
import { XYEffectsPanel } from './XYEffectsPanel';

interface Props {
  module: PatchModule;
  project: Project;
  selected: boolean;
  step: number;
  drumStep: number;
  live: LiveControls;
  audioActive: boolean;
  engine: AudioEngine;
  playing: boolean;
  pending: Endpoint | null;
  onParameter: (id: string, value: number | string | boolean) => void;
  onParameters: (values: Parameters, group?: string) => void;
  onSample: (lane: DrumLane, sample: DrumSample | null) => boolean;
  onDrumStep: (sound: DrumSound, step: number) => void;
  onStep: (index: number, degree: StepNoteChange, group?: string) => void;
  onPort: (endpoint: Endpoint) => void;
  onRemove: () => void;
  onDragStart: (event: PointerEvent<HTMLElement>) => void;
  onSelect: () => void;
}

export function ModuleCard({
  module,
  project,
  selected,
  step,
  drumStep,
  live,
  audioActive,
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
  const definition = MODULES[module.type];
  return (
    <article
      className={`module-panel ${selected ? 'selected' : ''} module-${module.type}`}
      style={
        {
          left: module.x,
          top: module.y,
          width: definition.width,
          height: definition.height,
          '--module-color': definition.color,
        } as CSSProperties
      }
      aria-label={`${definition.name} module`}
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
            step={drumStep}
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
        {module.type === 'keyboard' && <KeyboardPanel module={module} live={live} />}
        {module.type === 'xy-effects' && (
          <XYEffectsPanel module={module} onParameters={onParameters} />
        )}
        {module.type === 'pad-controller' && <PadControllerPanel module={module} live={live} />}
        {module.type === 'sequencer' && (
          <>
            <div className="instrument-caption">
              <span>8-STEP NOTE SEQUENCER</span>
              <span className={`tiny-led ${playing ? 'on' : ''}`} />
            </div>
            <div className="sequence-steps">
              {module.steps?.map((degree, index) => (
                <SequencerStep
                  key={index}
                  degree={degree}
                  index={index}
                  label={noteLabel(project, degree)}
                  active={index === step && playing}
                  onChange={(next, group) => onStep(index, next, group)}
                />
              ))}
            </div>
            <div className="sequencer-lower">
              <div className="rate-display">
                <span>STEP RATE</span>
                <strong>
                  1/8 <small>♪</small>
                </strong>
                <em>SYNC TO TEMPO</em>
              </div>
              <Knob
                control={definition.controls[0]}
                value={Number(module.parameters.gate)}
                onChange={(value) => onParameter('gate', value)}
              />
            </div>
          </>
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
            <div className="trace-display filter-trace">
              <Waveform type="filter" />
              <span>FREQUENCY RESPONSE</span>
            </div>
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
        {module.type === 'delay' && (
          <div className="delay-display">
            <span>STEREO ECHO</span>
            <Waveform type="delay" />
            <strong>
              {Math.round(Number(module.parameters.time) * 1000)} <small>ms</small>
            </strong>
          </div>
        )}
        {module.type === 'mixer' && <MixerPanel module={module} onParameter={onParameter} />}
        {module.type === 'merger' && <MergerPanel module={module} project={project} />}
        {['noise', 'lfo', 'reverb'].includes(module.type) && (
          <div className="trace-display">
            <Waveform type={module.type} />
            <span>{definition.subtitle.toUpperCase()}</span>
          </div>
        )}
        {!['sequencer', 'mixer', 'xy-effects'].includes(module.type) && (
          <div className={`module-knobs ${definition.controls.length === 1 ? 'single-knob' : ''}`}>
            {definition.controls.map((control) => (
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
      <footer className="module-ports">
        {definition.ports.map((port) => {
          const connected = project.cables.some((cable) =>
            [cable.from, cable.to].some(
              (endpoint) => endpoint.moduleId === module.id && endpoint.portId === port.id,
            ),
          );
          const active = pending?.moduleId === module.id && pending.portId === port.id;
          return (
            <button
              key={port.id}
              className={`port-button signal-${port.signal} ${connected ? 'connected' : ''} ${active ? 'pending' : ''}`}
              data-port={`${module.id}:${port.id}`}
              aria-label={`${definition.name} ${port.label} ${port.direction} socket${connected ? ', connected' : ''}`}
              title={`${port.label} · ${port.signal} ${port.direction}${connected ? ' · Click input to unplug' : ''}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onPort({ moduleId: module.id, portId: port.id });
              }}
            >
              <span>{port.label}</span>
              <i className="socket">
                <b />
              </i>
            </button>
          );
        })}
      </footer>
    </article>
  );
}
