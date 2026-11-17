import { MODULE_GUIDES } from './module-guides';
import { MODULES, moduleDefinition } from './modules';
import { createModule, createProject } from './project';
import { createDemoClap } from './demo-samples';
import type { ModuleType, PatchModule, Project } from './types';
import { parseProject } from './validation';

export interface ModuleDemo {
  project: Project;
  /** The same gesture used by browser QA, with no separate testing-only patch. */
  interaction: 'transport' | 'keyboard' | 'pads';
  instructions: string;
}

/** One recipe for guide wiring, user demos and regression fixtures. Construction
 * is silent and local: fresh IDs, fresh sample objects, no audio or microphone API.
 */
export function createModuleDemo(type: ModuleType): ModuleDemo {
  const recipe = MODULE_GUIDES[type].example;
  const types = [
    ...new Set(recipe.connections.flatMap((wire) => [wire.from.module, wire.to.module])),
  ];
  const modules = new Map<ModuleType, PatchModule>(
    types.map((type) => [type, createModule(type, 0, 0)]),
  );
  for (const [type, module] of modules) {
    Object.assign(module.parameters, recipe.parameters?.[type]);
    if (type === 'mic-sampler') module.samples = { clip: createDemoClap() };
  }
  // External kit buses must be selected, not just cabled. Derive the lane from
  // the worked wiring so adding a different kit input cannot leave a silent demo.
  for (const wire of recipe.connections) {
    if (wire.to.module === 'drum-kit' && wire.to.port !== 'kit')
      modules.get('drum-kit')!.parameters[wire.to.port] = 'input';
  }
  // Lay out DAG columns left-to-right; every column stacks real registry heights.
  // No fixed cell size or manual positions that break when an instrument grows.
  const depth = (type: ModuleType): number => {
    const incoming = recipe.connections.filter((wire) => wire.to.module === type);
    return incoming.length ? 1 + Math.max(...incoming.map((wire) => depth(wire.from.module))) : 0;
  };
  const columns = new Map<number, PatchModule[]>();
  for (const [type, module] of modules) {
    const column = depth(type);
    columns.set(column, [...(columns.get(column) ?? []), module]);
  }
  let x = 40;
  for (const [, column] of [...columns].sort(([a], [b]) => a - b)) {
    let y = 40;
    for (const module of column) {
      module.x = x;
      module.y = y;
      y += moduleDefinition(module).height + 40;
    }
    x += Math.max(...column.map((module) => moduleDefinition(module).width)) + 60;
  }
  const project = parseProject({
    ...createProject(true),
    name: `${MODULES[type].name} demo`,
    modules: [...modules.values()],
    cables: recipe.connections.map((wire) => ({
      id: crypto.randomUUID(),
      from: { moduleId: modules.get(wire.from.module)!.id, portId: wire.from.port },
      to: { moduleId: modules.get(wire.to.module)!.id, portId: wire.to.port },
    })),
  });
  const interaction = modules.has('keyboard')
    ? 'keyboard'
    : modules.has('pad-controller')
      ? 'pads'
      : 'transport';
  const instructions =
    type === 'switch'
      ? 'Press Play to alternate one bar of drums and one bar of melody. Schedule edits the cues; numbered keys take manual control.'
      : interaction === 'keyboard'
        ? 'Play the Keyboard keys to hear this demo. No need to press Play.'
        : interaction === 'pads'
          ? type === 'pad-controller'
            ? 'Tap pad 1 for a kick and pad 2 for the included clap. Each output plays only its own instrument; no need to press Play.'
            : modules.has('mic-sampler')
              ? 'Tap the Pad controller to play the included clap. You can replace it with your own recording.'
              : 'Tap the Pad controller, or press Play for its backing rhythm.'
          : 'Press Play to hear this demo, then try the module’s controls.';
  return { project, interaction, instructions };
}
