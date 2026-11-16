import type { Endpoint, PatchModule, PortDefinition, Project } from '../domain/types';
import { MODULES } from '../domain/modules';

/** Positioned sockets are an additive bank: existing footer geometry stays intact. */
export function ModulePorts({
  module,
  project,
  pending,
  onPort,
}: {
  module: PatchModule;
  project: Project;
  pending: Endpoint | null;
  onPort: (endpoint: Endpoint) => void;
}) {
  const definition = MODULES[module.type];
  const button = (port: PortDefinition) => {
    const connected = project.cables.some((cable) =>
      [cable.from, cable.to].some(
        (endpoint) => endpoint.moduleId === module.id && endpoint.portId === port.id,
      ),
    );
    const active = pending?.moduleId === module.id && pending.portId === port.id;
    return (
      <button
        key={port.id}
        className={`port-button signal-${port.signal} ${port.position ? 'panel-port' : ''} ${connected ? 'connected' : ''} ${active ? 'pending' : ''}`}
        style={
          port.position ? { left: port.position.x - 30, top: port.position.y - 27.5 } : undefined
        }
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
  };
  return (
    <>
      <footer className="module-ports">
        {definition.ports.filter((port) => !port.position).map(button)}
      </footer>
      {definition.ports.filter((port) => port.position).map(button)}
    </>
  );
}
