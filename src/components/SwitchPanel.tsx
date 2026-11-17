import { MODULES } from '../domain/modules';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PlaybackPosition } from '../audio/playback-position';
import { switchInputAtBar, ticksPerBar, type SwitchSchedule } from '../domain/switch-schedule';
import type { Parameters, PatchModule, Project } from '../domain/types';
import { SwitchScheduleEditor } from './SwitchScheduleEditor';

/** Ordinary pressed buttons keep touch and keyboard selection on the same edit path. */
export function SwitchPanel({
  module,
  project,
  onParameters,
  position,
  playing,
  onSchedule,
}: {
  module: PatchModule;
  project: Project;
  onParameters: (parameters: Parameters) => void;
  position: PlaybackPosition;
  playing: boolean;
  onSchedule: (schedule: SwitchSchedule) => void;
}) {
  const [editing, setEditing] = useState(false);
  const scheduleButton = useRef<HTMLButtonElement>(null);
  const previousEditing = useRef(false);
  useLayoutEffect(() => {
    if (previousEditing.current && !editing) scheduleButton.current?.focus({ preventScroll: true });
    previousEditing.current = editing;
  }, [editing]);
  const inputs = MODULES.switch.ports.filter((port) => port.direction === 'input');
  const bar = useSyncExternalStore(position.subscribe, () =>
    position.bar(ticksPerBar(project.timeSignature)),
  );
  const automatic = Boolean(module.parameters.automatic);
  const selected =
    automatic && playing ? switchInputAtBar(module, bar) : Number(module.parameters.selected);
  return (
    <div className={`switch-console${editing ? ' schedule-editing' : ''}`}>
      {editing ? (
        <SwitchScheduleEditor
          key={JSON.stringify([
            module.switchCues,
            module.parameters.repeat,
            module.parameters.loopBars,
          ])}
          module={module}
          onClose={() => setEditing(false)}
          onApply={(schedule) => {
            onSchedule(schedule);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <div className="switch-legend">
            <button
              className="switch-auto"
              aria-label="Automatic switching"
              aria-pressed={automatic}
              onClick={() =>
                onParameters(automatic ? { automatic: false, selected } : { automatic: true })
              }
            >
              {automatic ? 'Auto' : 'Manual'}
            </button>
            <button ref={scheduleButton} aria-expanded={editing} onClick={() => setEditing(true)}>
              Schedule
            </button>
          </div>
          <div className="switch-keys" role="group" aria-label="Selected input">
            {inputs.map((input, index) => {
              const cable = project.cables.find(
                (cable) => cable.to.moduleId === module.id && cable.to.portId === input.id,
              );
              const source = project.modules.find((source) => source.id === cable?.from.moduleId);
              return (
                <button
                  key={input.id}
                  aria-label={`Select input ${index + 1}`}
                  aria-pressed={selected === index + 1}
                  title={source ? MODULES[source.type].name : 'Unpatched — silence'}
                  onClick={() => onParameters({ selected: index + 1, automatic: false })}
                >
                  <i aria-hidden="true" />
                  <strong>{index + 1}</strong>
                  <span>{source ? MODULES[source.type].name : 'Unpatched'}</span>
                </button>
              );
            })}
          </div>
          <p role="status">
            {automatic
              ? playing && bar >= 0
                ? `Bar ${module.parameters.repeat ? (bar % Number(module.parameters.loopBars)) + 1 : bar + 1} · input ${selected}`
                : 'AUTO · STARTS ON PLAY'
              : 'MANUAL · TAP AN INPUT'}
          </p>
        </>
      )}
    </div>
  );
}
