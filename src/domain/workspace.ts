import { CONFIG } from '../config';
import { defaultParameters, moduleDefinition } from './modules';
import type { ModuleType, Parameters, PatchModule } from './types';

export interface Point {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}
export interface Bounds extends Point, Size {}

export function snapPosition(x: number, y: number): Point {
  const snap = (value: number) =>
    Math.max(
      -CONFIG.canvas.maxCoordinate,
      Math.min(
        CONFIG.canvas.maxCoordinate,
        Math.round(value / CONFIG.canvas.grid) * CONFIG.canvas.grid,
      ),
    );
  return { x: snap(x), y: snap(y) };
}

export function moduleBounds(modules: readonly PatchModule[]): Bounds {
  if (!modules.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...modules.map((module) => module.x));
  const y = Math.min(...modules.map((module) => module.y));
  return {
    x,
    y,
    width: Math.max(...modules.map((module) => module.x + moduleDefinition(module).width)) - x,
    height: Math.max(...modules.map((module) => module.y + moduleDefinition(module).height)) - y,
  };
}

/** Search near the visible centre and the edges of existing panels, rather than a
 * finite list of rack slots. Each candidate is grid-aligned and leaves a physical gap.
 */
export function findOpenPosition(
  type: ModuleType,
  modules: readonly PatchModule[],
  centre: Point,
  parameters: Parameters = defaultParameters(type),
): Point {
  const size = moduleDefinition({ type, parameters });
  const preferred = snapPosition(centre.x - size.width / 2, centre.y - size.height / 2);
  const gap = CONFIG.canvas.moduleGap;
  const grid = CONFIG.canvas.grid;
  const xs = new Set([preferred.x]);
  const ys = new Set([preferred.y]);
  for (const module of modules) {
    const other = moduleDefinition(module);
    xs.add(Math.ceil((module.x + other.width + gap) / grid) * grid);
    xs.add(Math.floor((module.x - size.width - gap) / grid) * grid);
    ys.add(Math.ceil((module.y + other.height + gap) / grid) * grid);
    ys.add(Math.floor((module.y - size.height - gap) / grid) * grid);
  }
  const candidates = [...xs].flatMap((x) => [...ys].map((y) => ({ x, y })));
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - preferred.x, a.y - preferred.y) -
      Math.hypot(b.x - preferred.x, b.y - preferred.y),
  );
  // With at most CONFIG.maxModules panels, an outer candidate always has room.
  return (
    candidates.find(
      ({ x, y }) =>
        Math.abs(x) <= CONFIG.canvas.maxCoordinate &&
        Math.abs(y) <= CONFIG.canvas.maxCoordinate &&
        !modules.some((module) => {
          const other = moduleDefinition(module);
          return (
            x < module.x + other.width + gap &&
            x + size.width + gap > module.x &&
            y < module.y + other.height + gap &&
            y + size.height + gap > module.y
          );
        }),
    ) ?? preferred
  );
}

/** Enlarging a configured enclosure moves only that panel when it needs more room. */
export function clearModuleOverlap(
  module: PatchModule,
  others: readonly PatchModule[],
): PatchModule {
  const size = moduleDefinition(module);
  const overlaps = others.some((other) => {
    const bounds = moduleDefinition(other);
    return (
      module.x < other.x + bounds.width &&
      module.x + size.width > other.x &&
      module.y < other.y + bounds.height &&
      module.y + size.height > other.y
    );
  });
  return overlaps
    ? {
        ...module,
        ...findOpenPosition(
          module.type,
          others,
          { x: module.x + size.width / 2, y: module.y + size.height / 2 },
          module.parameters,
        ),
      }
    : module;
}
