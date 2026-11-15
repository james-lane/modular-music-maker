import { CONFIG, ROOT_NOTES, SCALES } from '../config';
import { MODULES, defaultParameters } from './modules';
import { createDrumPattern } from './instruments';
import type { Cable, Endpoint, ModuleType, PatchModule, Project } from './types';

export function createModule(type: ModuleType, x: number, y: number): PatchModule {
  return {
    id: crypto.randomUUID(),
    type,
    x,
    y,
    parameters: defaultParameters(type),
    ...(type === 'sequencer' ? { steps: [0, 2, 4, 2, 0, 2, 6, 4] } : {}),
    ...(type === 'drum-machine' ? { drumPattern: createDrumPattern() } : {}),
  };
}

/** A real connected starter patch lets the first Play click produce music. */
export function createProject(empty = false): Project {
  const sequencer = createModule('sequencer', 48, 60);
  const oscillator = createModule('oscillator', 370, 60);
  const filter = createModule('filter', 676, 60);
  const output = createModule('output', 982, 60);
  const delay = createModule('delay', 676, 470);
  const cable = (from: PatchModule, fromPort: string, to: PatchModule, toPort: string): Cable => ({
    id: crypto.randomUUID(),
    from: { moduleId: from.id, portId: fromPort },
    to: { moduleId: to.id, portId: toPort },
  });
  return {
    version: 2,
    id: crypto.randomUUID(),
    name: empty ? 'Untitled patch' : 'Sunday circuits',
    updatedAt: new Date().toISOString(),
    tempo: CONFIG.tempo.default,
    rootNote: 'C',
    scale: 'minor',
    timeSignature: '4/4',
    masterVolume: CONFIG.audio.defaultMasterVolume,
    modules: empty
      ? [createModule('output', 982, 60)]
      : [sequencer, oscillator, filter, output, delay],
    cables: empty
      ? []
      : [
          cable(sequencer, 'pitch', oscillator, 'pitch'),
          cable(oscillator, 'out', filter, 'in'),
          cable(filter, 'out', delay, 'in'),
          cable(delay, 'out', output, 'in'),
        ],
  };
}

/** A separate preset leaves existing saved patches and the original starter untouched. */
export function createPerformanceProject(): Project {
  const drums = createModule('drum-machine', 48, 60);
  const pads = createModule('pad-controller', 560, 60);
  const kit = createModule('drum-kit', 1300, 60);
  const keyboard = createModule('keyboard', 48, 550);
  const oscillator = createModule('oscillator', 560, 610);
  oscillator.parameters.waveform = 'triangle';
  const mixer = createModule('mixer', 990, 60);
  const output = createModule('output', 990, 470);
  const connect = (
    from: PatchModule,
    fromPort: string,
    to: PatchModule,
    toPort: string,
  ): Cable => ({
    id: crypto.randomUUID(),
    from: { moduleId: from.id, portId: fromPort },
    to: { moduleId: to.id, portId: toPort },
  });
  return {
    ...createProject(true),
    name: 'Pocket rhythm',
    modules: [drums, pads, keyboard, oscillator, mixer, output, kit],
    cables: [
      connect(kit, 'kit', drums, 'kit'),
      connect(pads, 'trigger', drums, 'trigger'),
      connect(keyboard, 'pitch', oscillator, 'pitch'),
      connect(drums, 'out', mixer, 'a'),
      connect(oscillator, 'out', mixer, 'b'),
      connect(mixer, 'out', output, 'in'),
    ],
  };
}

export function getPort(project: Project, endpoint: Endpoint) {
  const module = project.modules.find((item) => item.id === endpoint.moduleId);
  return module && MODULES[module.type].ports.find((port) => port.id === endpoint.portId);
}

/** Reject invalid patches before Web Audio sees them. User-level feedback comes from here too. */
export function connectionError(project: Project, from: Endpoint, to: Endpoint): string | null {
  const output = getPort(project, from);
  const input = getPort(project, to);
  if (!output || !input) return 'That socket no longer exists.';
  if (output.direction !== 'output' || input.direction !== 'input')
    return 'Connect an output socket to an input socket.';
  if (output.signal !== input.signal)
    return 'Match socket types: audio, pitch, modulation, trigger, or kit.';
  if (from.moduleId === to.moduleId) return 'Connect two different modules.';
  if (
    project.cables.some(
      (cable) => cable.to.moduleId === to.moduleId && cable.to.portId === to.portId,
    )
  )
    return 'This input already has a cable. Unplug it first.';
  if (project.cables.length >= CONFIG.maxCables)
    return `A patch can have up to ${CONFIG.maxCables} cables.`;

  // Walk forward from the target. Reaching the source would make a feedback cycle.
  const visited = new Set<string>();
  const pending = [to.moduleId];
  while (pending.length) {
    const id = pending.pop()!;
    if (id === from.moduleId)
      return 'This would create a feedback loop. Use the Delay feedback knob instead.';
    if (visited.has(id)) continue;
    visited.add(id);
    project.cables
      .filter((cable) => cable.from.moduleId === id)
      .forEach((cable) => pending.push(cable.to.moduleId));
  }
  return null;
}

export function stepFrequency(project: Project, degree: number, octave = 0): number {
  const scale = SCALES[project.scale];
  const semitone = scale[degree % scale.length] + 12 * Math.floor(degree / scale.length);
  const midi = 48 + ROOT_NOTES.indexOf(project.rootNote) + semitone + octave * 12;
  return 440 * 2 ** ((midi - 69) / 12);
}

export function noteLabel(project: Project, degree: number): string {
  if (degree < 0) return '—';
  const scale = SCALES[project.scale];
  const semitone = ROOT_NOTES.indexOf(project.rootNote) + scale[degree % scale.length];
  return `${ROOT_NOTES[semitone % 12]}${3 + Math.floor(degree / scale.length) + Math.floor(semitone / 12)}`;
}
