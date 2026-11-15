import { MODULES } from '../domain/modules';
import type { PatchModule, Project } from '../domain/types';
import { Knob } from './Knob';

/** Amber input indicators show cable occupancy, not a simulated audio meter. */
export function MergerPanel({
  module,
  project,
  onParameter,
}: {
  module: PatchModule;
  project: Project;
  onParameter: (id: string, value: number) => void;
}) {
  const inputs = MODULES.merger.controls.filter((control) => control.id !== 'level');
  const connected = new Set(
    project.cables
      .filter((cable) => cable.to.moduleId === module.id)
      .map((cable) => cable.to.portId),
  );
  return (
    <div className="merger-routing">
      <div className="merger-routing-title">
        <span>AUDIO SUMMING BUS</span>
        <strong>{inputs.length} → 1</strong>
      </div>
      <div className="merger-routing-inputs" aria-label="Merger input connections">
        {inputs.map((input) => (
          <div key={input.id} className={`merger-input ${connected.has(input.id) ? 'wired' : ''}`}>
            <span
              className="merger-input-indicator"
              role="img"
              aria-label={`${input.label} ${connected.has(input.id) ? 'wired' : 'free'}`}
            />
            <Knob
              control={input}
              value={Number(module.parameters[input.id])}
              onChange={(value) => onParameter(input.id, value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
