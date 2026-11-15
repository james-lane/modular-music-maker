import { MODULES } from '../domain/modules';
import type { PatchModule, Project } from '../domain/types';

/** Ordinary pressed buttons keep touch and keyboard selection on the same edit path. */
export function SwitchPanel({
  module,
  project,
  onParameter,
}: {
  module: PatchModule;
  project: Project;
  onParameter: (id: string, value: number) => void;
}) {
  const inputs = MODULES.switch.ports.filter((port) => port.direction === 'input');
  return (
    <div className="switch-console">
      <div className="switch-legend">
        <span>AUDIO SELECTOR</span>
        <strong>4 → 1</strong>
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
              aria-pressed={module.parameters.selected === index + 1}
              title={source ? MODULES[source.type].name : 'Unpatched — silence'}
              onClick={() => onParameter('selected', index + 1)}
            >
              <i aria-hidden="true" />
              <strong>{index + 1}</strong>
              <span>{source ? MODULES[source.type].name : 'Unpatched'}</span>
            </button>
          );
        })}
      </div>
      <p>ONE INPUT AT A TIME · SMOOTH CHANGEOVER</p>
    </div>
  );
}
