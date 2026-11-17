import { controllerTargets, DRUM_SOUNDS } from './instruments';
import { moduleDefinition, PAD_LAYOUTS, padLayout } from './modules';
import type { Project } from './types';
import { clearModuleOverlap } from './workspace';

/** A hit reaches its numbered output plus the stable shared bus used by old patches. */
export function padTargets(project: Project, controllerId: string, index: number): string[] {
  const module = project.modules.find((item) => item.id === controllerId);
  if (
    module?.type !== 'pad-controller' ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= padLayout(module.parameters.padCount).count ||
    !DRUM_SOUNDS[index]
  )
    return [];
  return [
    ...new Set([
      ...controllerTargets(project, controllerId, 'trigger'),
      ...controllerTargets(project, controllerId, `pad${index + 1}`),
    ]),
  ];
}

/** Printed drum names suit the shared kit; dedicated non-drum routes need honest labels. */
export function padLabel(project: Project, controllerId: string, index: number): string {
  const ids = padTargets(project, controllerId, index);
  const receivers = project.modules.filter((module) => ids.includes(module.id));
  if (!receivers.length || receivers.every((module) => module.type === 'drum-machine'))
    return DRUM_SOUNDS[index]?.short ?? '';
  if (receivers.length !== 1) return `PAD ${index + 1}`;
  switch (receivers[0].type) {
    case 'mic-sampler':
      return 'SAMPLE';
    case 'envelope':
      return 'ENV';
    case 'random-mod':
      return 'S&H';
    default:
      return `PAD ${index + 1}`;
  }
}

/** Count, footprint and removed cables form one undoable edit; other panels stay put. */
export function setPadCount(project: Project, id: string, count: unknown): Project {
  if (typeof count !== 'number' || !PAD_LAYOUTS.some((layout) => layout.count === count))
    return project;
  const module = project.modules.find((item) => item.id === id);
  if (module?.type !== 'pad-controller' || module.parameters.padCount === count) return project;
  const resized = clearModuleOverlap(
    { ...module, parameters: { ...module.parameters, padCount: count } },
    project.modules.filter((item) => item.id !== id),
  );
  const ports = new Set(moduleDefinition(resized).ports.map((port) => port.id));
  return {
    ...project,
    modules: project.modules.map((item) => (item.id === id ? resized : item)),
    cables: project.cables.filter(
      (cable) => cable.from.moduleId !== id || ports.has(cable.from.portId),
    ),
  };
}
