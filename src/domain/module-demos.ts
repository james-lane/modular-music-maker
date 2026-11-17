import { MODULE_GUIDES, guideInstance } from './module-guides';
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
  const modules = new Map<string, PatchModule>();
  for (const endpoint of recipe.connections.flatMap((wire) => [wire.from, wire.to])) {
    const key = guideInstance(endpoint);
    if (modules.has(key)) {
      if (modules.get(key)!.type !== endpoint.module)
        throw new Error(`Demo instance ${key} has conflicting module types.`);
      continue;
    }
    const module = createModule(endpoint.module, 0, 0);
    Object.assign(
      module.parameters,
      recipe.parameters?.[endpoint.module],
      recipe.instanceParameters?.[key],
    );
    if (endpoint.module === 'mic-sampler') module.samples = { clip: createDemoClap() };
    modules.set(key, module);
  }
  // External kit buses must be selected, not just cabled. Derive the lane from
  // the worked wiring so adding a different kit input cannot leave a silent demo.
  for (const wire of recipe.connections) {
    if (wire.to.module === 'drum-kit' && wire.to.port !== 'kit')
      modules.get(guideInstance(wire.to))!.parameters[wire.to.port] = 'input';
  }
  // Lay out DAG columns left-to-right; every column stacks real registry heights.
  // No fixed cell size or manual positions that break when an instrument grows.
  const depth = (key: string): number => {
    const incoming = recipe.connections.filter((wire) => guideInstance(wire.to) === key);
    return incoming.length
      ? 1 + Math.max(...incoming.map((wire) => depth(guideInstance(wire.from))))
      : 0;
  };
  const columns = new Map<number, PatchModule[]>();
  for (const [key, module] of modules) {
    const column = depth(key);
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
  if (recipe.rows) {
    const rows = recipe.rows;
    const keys = rows.flat();
    if (
      keys.length !== modules.size ||
      new Set(keys).size !== keys.length ||
      keys.some((key) => !modules.has(key))
    )
      throw new Error('Demo rows must place every instance exactly once.');
    const widths = Array.from({ length: Math.max(...rows.map((row) => row.length)) }, (_, column) =>
      Math.max(
        0,
        ...rows.map((row) => (row[column] ? moduleDefinition(modules.get(row[column])!).width : 0)),
      ),
    );
    let y = 40;
    for (const row of rows) {
      let x = 40;
      for (const [column, key] of row.entries()) {
        Object.assign(modules.get(key)!, { x, y });
        x += widths[column] + 60;
      }
      y += Math.max(...row.map((key) => moduleDefinition(modules.get(key)!).height)) + 40;
    }
  }
  const project = parseProject({
    ...createProject(true),
    name: `${MODULES[type].name} demo`,
    modules: [...modules.values()],
    cables: recipe.connections.map((wire) => ({
      id: crypto.randomUUID(),
      from: { moduleId: modules.get(guideInstance(wire.from))!.id, portId: wire.from.port },
      to: { moduleId: modules.get(guideInstance(wire.to))!.id, portId: wire.to.port },
    })),
  });
  const types = new Set([...modules.values()].map((module) => module.type));
  const interaction =
    recipe.interaction ??
    (types.has('keyboard') ? 'keyboard' : types.has('pad-controller') ? 'pads' : 'transport');
  const instructions =
    recipe.instructions ??
    (type === 'switch'
      ? 'Press Play to alternate one bar of drums and one bar of melody. Schedule edits the cues; numbered keys take manual control.'
      : interaction === 'keyboard'
        ? 'Play the Keyboard keys to hear this demo. No need to press Play.'
        : interaction === 'pads'
          ? type === 'pad-controller'
            ? 'Tap pad 1 for a kick and pad 2 for the included clap. Each output plays only its own instrument; no need to press Play.'
            : types.has('mic-sampler')
              ? 'Tap the Pad controller to play the included clap. You can replace it with your own recording.'
              : 'Tap the Pad controller, or press Play for its backing rhythm.'
          : 'Press Play to hear this demo, then try the module’s controls.');
  return { project, interaction, instructions };
}
