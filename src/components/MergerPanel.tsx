import { MODULES } from '../domain/modules';
import type { PatchModule, Project } from '../domain/types';

/** The printed routing diagram shows cable occupancy, not a simulated audio meter. */
export function MergerPanel({ module, project }: { module: PatchModule; project: Project }) {
  const inputs = MODULES.merger.ports.filter((port) => port.direction === 'input');
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
          <span key={input.id} className={connected.has(input.id) ? 'wired' : ''}>
            <i aria-hidden="true" />
            {input.label}
            <small>{connected.has(input.id) ? 'wired' : 'free'}</small>
          </span>
        ))}
      </div>
      <div className="merger-bus-line" aria-hidden="true">
        <i />
      </div>
      <p>
        {connected.size} of {inputs.length} inputs connected
      </p>
    </div>
  );
}
