import { DRUM_LANES, DRUM_STEP_COUNT, type DrumSound } from './instruments';
import { createModule, createPerformanceProject, createProject } from './project';
import type { Cable, ModuleType, Parameters, PatchModule, Project } from './types';

export interface ExamplePatch {
  id: string;
  name: string;
  style: string;
  description: string;
  tryThis: string;
  color: string;
  artwork: 'melody' | 'performance' | 'bass' | 'texture' | 'arcade';
  /** Factories supply fresh project/module/cable IDs and independent editable data every time. */
  create: () => Project;
}

/** Small named building blocks keep the musical recipes readable without duplicating UUID wiring. */
function instrument(type: ModuleType, x: number, y: number, parameters: Parameters = {}) {
  const module = createModule(type, x, y);
  module.parameters = { ...module.parameters, ...parameters };
  return module;
}

function wire(from: PatchModule, output: string, to: PatchModule, input: string): Cable {
  return {
    id: crypto.randomUUID(),
    from: { moduleId: from.id, portId: output },
    to: { moduleId: to.id, portId: input },
  };
}

function drumPattern(hits: Partial<Record<DrumSound, readonly number[]>>) {
  return Object.fromEntries(
    DRUM_LANES.map((sound: DrumSound) => [
      sound,
      Array.from({ length: DRUM_STEP_COUNT }, (_, step) => (hits[sound] ?? []).includes(step)),
    ]),
  );
}

function createWarehouseProject(): Project {
  const drums = instrument('drum-machine', 48, 60, { level: 0.65, tone: -2, decay: 0.55 });
  drums.drumPattern = drumPattern({
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    clap: [12],
    'closed-hat': [2, 6, 10, 14, 15],
  });
  const sequencer = instrument('sequencer', 48, 550, { gate: 0.28 });
  sequencer.steps = [0, -1, 0, 4, 0, -1, 3, 1];
  const bass = instrument('oscillator', 370, 550, {
    waveform: 'sawtooth',
    octave: -2,
    level: 0.38,
  });
  const filter = instrument('filter', 676, 550, { cutoff: 650, resonance: 3.5 });
  const mixer = instrument('mixer', 990, 60, { a: 0.8, b: 0.65 });
  const output = instrument('output', 1250, 60);
  return {
    ...createProject(true),
    name: 'Warehouse pulse',
    tempo: 128,
    rootNote: 'F',
    scale: 'minor',
    modules: [drums, sequencer, bass, filter, mixer, output],
    cables: [
      wire(sequencer, 'pitch', bass, 'pitch'),
      wire(bass, 'out', filter, 'in'),
      wire(filter, 'out', mixer, 'b'),
      wire(drums, 'out', mixer, 'a'),
      wire(mixer, 'out', output, 'in'),
    ],
  };
}

function createCoastalProject(): Project {
  const noise = instrument('noise', 48, 60, { level: 0.3 });
  const lfo = instrument('lfo', 48, 430, { rate: 0.1, depth: 650 });
  const filter = instrument('filter', 370, 60, { cutoff: 1000, resonance: 0.7 });
  const reverb = instrument('reverb', 676, 60, { mix: 0.6 });
  const output = instrument('output', 982, 60, { level: 0.7 });
  return {
    ...createProject(true),
    name: 'Coastal static',
    tempo: 60,
    modules: [noise, lfo, filter, reverb, output],
    cables: [
      wire(noise, 'out', filter, 'in'),
      wire(lfo, 'out', filter, 'cutoff'),
      wire(filter, 'out', reverb, 'in'),
      wire(reverb, 'out', output, 'in'),
    ],
  };
}

function createArcadeProject(): Project {
  const melody = instrument('sequencer', 48, 60, { gate: 0.38 });
  melody.steps = [7, 9, 11, 9, 12, 11, 9, 4];
  const lead = instrument('oscillator', 370, 60, { waveform: 'square', level: 0.15 });
  const counterpoint = instrument('sequencer', 48, 470, { gate: 0.7 });
  counterpoint.steps = [0, -1, 4, -1, 3, -1, 4, 6];
  const bass = instrument('oscillator', 370, 470, {
    waveform: 'triangle',
    octave: -1,
    level: 0.3,
  });
  const mixer = instrument('mixer', 740, 60, { a: 0.65, b: 0.9 });
  const output = instrument('output', 1040, 60);
  return {
    ...createProject(true),
    name: 'Tiny arcade',
    tempo: 152,
    rootNote: 'G',
    scale: 'major',
    modules: [melody, lead, counterpoint, bass, mixer, output],
    cables: [
      wire(melody, 'pitch', lead, 'pitch'),
      wire(counterpoint, 'pitch', bass, 'pitch'),
      wire(lead, 'out', mixer, 'a'),
      wire(bass, 'out', mixer, 'b'),
      wire(mixer, 'out', output, 'in'),
    ],
  };
}

/** Curated, contrasting starting points. Keep copy and sound design together when adding examples. */
export const EXAMPLE_PATCHES: readonly ExamplePatch[] = [
  {
    id: 'sunday-circuits',
    name: 'Sunday circuits',
    style: 'Warm melody',
    description: 'A repeating analogue melody, softened by a filter and trailing echoes.',
    tryThis: 'Turn the Filter cutoff to open up the melody.',
    color: '#aa6c3d',
    artwork: 'melody',
    create: createProject,
  },
  {
    id: 'pocket-rhythm',
    name: 'Pocket rhythm',
    style: 'Live performance',
    description: 'A drum groove with a playable keyboard and sixteen percussion pads.',
    tryThis: 'Play the keys or tap the pads over the beat.',
    color: '#8a6d9d',
    artwork: 'performance',
    create: createPerformanceProject,
  },
  {
    id: 'warehouse-pulse',
    name: 'Warehouse pulse',
    style: 'Bass & drums',
    description: 'Four-on-the-floor drums and a low, clipped bass line at 128 BPM.',
    tryThis: 'Raise Filter resonance, then sweep the cutoff.',
    color: '#9b5d4e',
    artwork: 'bass',
    create: createWarehouseProject,
  },
  {
    id: 'coastal-static',
    name: 'Coastal static',
    style: 'Ambient texture',
    description: 'Filtered noise washes through reverb, shaped by a slow, free-running LFO.',
    tryThis: 'Change LFO Rate to speed up or slow down the waves.',
    color: '#537f83',
    artwork: 'texture',
    create: createCoastalProject,
  },
  {
    id: 'tiny-arcade',
    name: 'Tiny arcade',
    style: 'Two-voice chiptune',
    description: 'A bright square-wave tune and a separate triangle bass melody. Dry and punchy.',
    tryThis: 'Edit either sequencer to change one half of the duet.',
    color: '#728246',
    artwork: 'arcade',
    create: createArcadeProject,
  },
];
