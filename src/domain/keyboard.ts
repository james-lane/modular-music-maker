import { KEYBOARD_KEY_COUNTS } from './modules';
import type { Project } from './types';
import { clearModuleOverlap } from './workspace';

/** Resizing and any necessary clearance move undo together; stable pitch cables stay put. */
export function setKeyboardKeyCount(project: Project, id: string, count: unknown): Project {
  if (typeof count !== 'number' || !KEYBOARD_KEY_COUNTS.some((item) => item === count))
    return project;
  const module = project.modules.find((item) => item.id === id);
  if (module?.type !== 'keyboard' || module.parameters.keyCount === count) return project;
  const resized = clearModuleOverlap(
    { ...module, parameters: { ...module.parameters, keyCount: count } },
    project.modules.filter((item) => item.id !== id),
  );
  return {
    ...project,
    modules: project.modules.map((item) => (item.id === id ? resized : item)),
  };
}
