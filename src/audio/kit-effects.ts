import {
  connectedDrumKit,
  kitSamplerPaths,
  DRUM_LANES,
  type DrumLane,
} from '../domain/instruments';
import type { Project } from '../domain/types';
import { AUDIO_FACTORIES, type AudioRuntime } from './factories';

/** One rack per machine/lane, shared by its overlapping hits. Building per hit would
 * regenerate convolvers and lose delay/reverb tails when a sample source ends.
 */
export class KitEffects {
  readonly inputs = new Map<string, Partial<Record<DrumLane, AudioNode>>>();
  private effects: { moduleId: string; runtime: AudioRuntime }[] = [];
  private modulation: { source: AudioNode; target: AudioNode | AudioParam }[] = [];

  constructor(context: AudioContext, project: Project, runtimes: Map<string, AudioRuntime>) {
    for (const machine of project.modules.filter((module) => module.type === 'drum-machine')) {
      const output = runtimes.get(machine.id)?.outputs.out;
      if (!output) continue;
      const inputs: Partial<Record<DrumLane, AudioNode>> = {};
      const paths = kitSamplerPaths(project, connectedDrumKit(project, machine.id));
      for (const lane of DRUM_LANES) {
        const path = paths[lane];
        if (!path) continue;
        let previous: AudioNode | undefined;
        for (const module of path.effects) {
          const runtime = AUDIO_FACTORIES[module.type](context, output);
          this.effects.push({ moduleId: module.id, runtime });
          const input = runtime.inputs.in;
          if (!(input instanceof AudioNode)) continue;
          if (previous) previous.connect(input);
          else inputs[lane] = input;
          previous = runtime.outputs.out;
          // Preserve external modulation, but never feed the original audio bus into
          // this rack: it belongs exclusively to the receiving machine's saved hits.
          for (const cable of project.cables.filter(
            (cable) => cable.to.moduleId === module.id && cable.to.portId !== 'in',
          )) {
            const source = runtimes.get(cable.from.moduleId)?.outputs[cable.from.portId];
            const target = runtime.inputs[cable.to.portId];
            if (source && target) {
              if (target instanceof AudioParam) source.connect(target);
              else source.connect(target);
              this.modulation.push({ source, target });
            }
          }
        }
        previous?.connect(output);
      }
      this.inputs.set(machine.id, inputs);
    }
    this.update(project);
  }

  update(project: Project) {
    for (const { moduleId, runtime } of this.effects) {
      const module = project.modules.find((module) => module.id === moduleId);
      if (module) runtime.update(module.parameters);
    }
  }

  dispose() {
    for (const { source, target } of this.modulation) {
      if (target instanceof AudioParam) source.disconnect(target);
      else source.disconnect(target);
    }
    this.effects.forEach(({ runtime }) => runtime.dispose());
    this.effects = [];
    this.modulation = [];
    this.inputs.clear();
  }
}
