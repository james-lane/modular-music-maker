import { MIXER_INPUT_COUNTS, moduleDefinition } from './modules';
import type { Project } from './types';
import { clearModuleOverlap } from './workspace';

/** Removing channels, their input cables and any resize relocation undo together. */
export function setMixerInputCount(project: Project, id: string, count: unknown): Project {
  if (typeof count !== 'number' || !MIXER_INPUT_COUNTS.some((item) => item === count))
    return project;
  const module = project.modules.find((item) => item.id === id);
  if (module?.type !== 'mixer' || module.parameters.inputCount === count) return project;
  const resized = clearModuleOverlap(
    { ...module, parameters: { ...module.parameters, inputCount: count } },
    project.modules.filter((item) => item.id !== id),
  );
  const ports = new Set(moduleDefinition(resized).ports.map((port) => port.id));
  return {
    ...project,
    modules: project.modules.map((item) => (item.id === id ? resized : item)),
    cables: project.cables.filter(
      (cable) => cable.to.moduleId !== id || ports.has(cable.to.portId),
    ),
  };
}
