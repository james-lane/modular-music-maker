import { MODULES } from '../domain/modules';
import type { PatchModule } from '../domain/types';

/** Every port uses the same 54px bottom footer. Match its 12px horizontal inset
 * and socket centre in styles.css; do not add per-instrument position overrides.
 */
export function socketPosition(module: PatchModule, portId: string) {
  const definition = MODULES[module.type];
  const index = definition.ports.findIndex((port) => port.id === portId);
  return {
    x: module.x + 12 + ((definition.width - 24) * (index + 0.5)) / definition.ports.length,
    y: module.y + definition.height - 22,
  };
}
