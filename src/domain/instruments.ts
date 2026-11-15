import { CONFIG } from '../config';
import { sampleRegion } from './samples';
import type { PatchModule, Project } from './types';

/** Shared identities keep synthesis, pad labels, pattern editing and validation aligned. */
export const DRUM_SOUNDS = [
  { id: 'kick', name: 'Kick', short: 'KICK', color: '#d68b57' },
  { id: 'snare', name: 'Snare', short: 'SNARE', color: '#d68b57' },
  { id: 'clap', name: 'Clap', short: 'CLAP', color: '#d68b57' },
  { id: 'closed-hat', name: 'Closed hat', short: 'CH HAT', color: '#d68b57' },
  { id: 'open-hat', name: 'Open hat', short: 'OH HAT', color: '#87a5a4' },
  { id: 'low-tom', name: 'Low tom', short: 'LO TOM', color: '#87a5a4' },
  { id: 'high-tom', name: 'High tom', short: 'HI TOM', color: '#87a5a4' },
  { id: 'rim', name: 'Rim shot', short: 'RIM', color: '#87a5a4' },
  { id: 'shaker', name: 'Shaker', short: 'SHAKER', color: '#a495b7' },
  { id: 'crash', name: 'Crash', short: 'CRASH', color: '#a495b7' },
  { id: 'ride', name: 'Ride', short: 'RIDE', color: '#a495b7' },
  { id: 'cowbell', name: 'Cowbell', short: 'BELL', color: '#a495b7' },
  { id: 'tambourine', name: 'Tambourine', short: 'TAMB', color: '#9caa79' },
  { id: 'claves', name: 'Claves', short: 'CLAVES', color: '#9caa79' },
  { id: 'low-conga', name: 'Low conga', short: 'LO CONGA', color: '#9caa79' },
  { id: 'high-conga', name: 'High conga', short: 'HI CONGA', color: '#9caa79' },
] as const;

export type DrumSound = (typeof DRUM_SOUNDS)[number]['id'];
export const DRUM_LANES = ['kick', 'snare', 'clap', 'closed-hat'] as const;
export type DrumLane = (typeof DRUM_LANES)[number];
export type DrumVoiceSource = DrumSound | 'sample' | 'input';

export function connectedDrumKit(project: Project, drumId: string): PatchModule | undefined {
  const cable = project.cables.find(
    (item) => item.to.moduleId === drumId && item.to.portId === 'kit',
  );
  return project.modules.find(
    (item) => item.id === cable?.from.moduleId && item.type === 'drum-kit',
  );
}

export type KitSamplerSources = Partial<Record<DrumLane, PatchModule>>;

/** A direct sampler cable supplies its saved clip per hit, not a running audio stream.
 * Effects and other audio sources retain the normal live-input envelope contract.
 */
export function kitSamplerSources(
  project: Project,
  kit: PatchModule | undefined,
): KitSamplerSources {
  const sources: KitSamplerSources = {};
  if (!kit) return sources;
  for (const lane of DRUM_LANES) {
    const cable = project.cables.find(
      (item) => item.to.moduleId === kit.id && item.to.portId === lane,
    );
    const sampler = project.modules.find(
      (module) => module.id === cable?.from.moduleId && module.type === 'mic-sampler',
    );
    if (sampler && cable?.from.portId === 'out') sources[lane] = sampler;
  }
  return sources;
}

export function drumVoiceLabel(kit: PatchModule | undefined, lane: DrumLane): string {
  const source = kit?.parameters[lane] ?? lane;
  if (source === 'sample') return kit?.samples?.[lane]?.name ?? 'No sample';
  if (source === 'input') return `Input ${DRUM_LANES.indexOf(lane) + 1}`;
  return DRUM_SOUNDS.find((sound) => sound.id === source)?.name ?? lane;
}
/** Imported/tuned hits can outlast the normal live-instrument idle tail. */
export function drumLiveTailMs(project: Project): number {
  let longest = 0;
  for (const drums of project.modules.filter((module) => module.type === 'drum-machine')) {
    const kit = connectedDrumKit(project, drums.id);
    if (!kit) continue;
    const samplers = kitSamplerSources(project, kit);
    for (const lane of DRUM_LANES) {
      const source = kit.parameters[lane];
      const pcm = kit.samples?.[lane]?.pcm;
      const sampler = source === 'input' ? samplers[lane] : undefined;
      const clip = sampler?.samples?.clip;
      const pitch = 2 ** (Number(drums.parameters.tone) / 12);
      const duration = sampler
        ? clip
          ? sampleRegion(clip.pcm, sampler.parameters).duration /
            Number(sampler.parameters.rate) /
            pitch
          : 0
        : source === 'sample' && pcm
          ? sampleRegion(pcm).duration / pitch
          : source === 'input'
            ? Number(kit.parameters.length) * Number(drums.parameters.decay)
            : 0;
      longest = Math.max(longest, duration);
    }
  }
  for (const sampler of project.modules.filter((module) => module.type === 'mic-sampler')) {
    const pcm = sampler.samples?.clip?.pcm;
    if (pcm)
      longest = Math.max(
        longest,
        sampleRegion(pcm, sampler.parameters).duration / Number(sampler.parameters.rate),
      );
  }
  return CONFIG.audio.liveTailMs + longest * 1000;
}

export const DRUM_STEP_COUNT = 16;
export const KEYBOARD_BASE_MIDI = 48; // C3 before the octave shift.
export const KEYBOARD_NOTE_COUNT = 25;
// Shortcuts are local to a focused instrument; text fields keep their ordinary behavior.
export const KEYBOARD_SHORTCUTS = [
  'a',
  'w',
  's',
  'e',
  'd',
  'f',
  't',
  'g',
  'y',
  'h',
  'u',
  'j',
  'k',
  'o',
  'l',
  'p',
  ';',
];
export const PAD_SHORTCUTS = [
  '1',
  '2',
  '3',
  '4',
  'q',
  'w',
  'e',
  'r',
  'a',
  's',
  'd',
  'f',
  'z',
  'x',
  'c',
  'v',
];

export function createDrumPattern(): Record<string, boolean[]> {
  const hits: Record<string, number[]> = {
    kick: [0, 6, 8, 14],
    snare: [4, 12],
    clap: [12],
    'closed-hat': [0, 2, 4, 6, 8, 10, 12, 14],
  };
  return Object.fromEntries(
    DRUM_LANES.map((id) => [
      id,
      Array.from({ length: DRUM_STEP_COUNT }, (_, step) => hits[id].includes(step)),
    ]),
  );
}

export function drumHitsAtStep(module: PatchModule, step: number): DrumSound[] {
  if (module.type !== 'drum-machine' || !module.parameters.enabled) return [];
  return DRUM_LANES.filter((id) => module.drumPattern?.[id]?.[step % DRUM_STEP_COUNT]);
}

export function midiFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

export function midiLabel(note: number): string {
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
}

/** Event routes deliberately never become AudioNode connections. */
export function controllerTargets(
  project: Project,
  controllerId: string,
  portId: 'pitch' | 'trigger' | 'kit',
): string[] {
  return project.cables
    .filter((cable) => cable.from.moduleId === controllerId && cable.from.portId === portId)
    .map((cable) => cable.to.moduleId);
}
