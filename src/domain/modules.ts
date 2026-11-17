import type { ModuleDefinition, ModuleType, PatchModule } from './types';

export const MIXER_INPUT_COUNTS = [2, 3, 4, 5, 6, 7, 8] as const;
export const MIXER_CHANNEL_IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export function mixerInputCount(value: unknown): number {
  return MIXER_INPUT_COUNTS.find((count) => count === value) ?? MIXER_INPUT_COUNTS[0];
}

/** Socket count sets the enclosure width: even sixteen outputs retain one bottom row. */
export const PAD_LAYOUTS = [
  { count: 4, columns: 4, width: 300, height: 384 },
  { count: 8, columns: 4, width: 432, height: 456 },
  { count: 16, columns: 8, width: 760, height: 456 },
] as const;
export const DEFAULT_PAD_LAYOUT = PAD_LAYOUTS[2];
export type PadCount = (typeof PAD_LAYOUTS)[number]['count'];

export function padLayout(value: unknown) {
  return PAD_LAYOUTS.find((layout) => layout.count === value) ?? DEFAULT_PAD_LAYOUT;
}

/** Saved scale degrees include a rest and fourteen pitches, independently of the scale. */
export const SEQUENCER_DEGREES = { rest: -1, min: 0, max: 13 } as const;

/** Rates share the transport's sixteenth-note grid, keeping independent patterns in sync. */
export const SEQUENCER_RATES = [
  { value: '1/4', ticks: 4 },
  { value: '1/8', ticks: 2 },
  { value: '1/16', ticks: 1 },
] as const;
export const DEFAULT_SEQUENCER_RATE = SEQUENCER_RATES[1];

export function sequencerRate(value: unknown) {
  return SEQUENCER_RATES.find((rate) => rate.value === value) ?? DEFAULT_SEQUENCER_RATE;
}

export const SAMPLER_TRIM = { start: 0, end: 1, step: 0.001 } as const;

/** The module catalog is the source of truth for appearance, ports and parameter ranges.
 * To add a module, register its definition here and its sound factory in audio/factories.ts.
 * Ordinary numeric controls render automatically; only special interfaces need a component.
 */
export const MODULES: Record<ModuleType, ModuleDefinition> = {
  'drum-machine': {
    type: 'drum-machine',
    name: 'Drum machine',
    subtitle: 'Find a pocket. Stay a while.',
    description: 'Four lanes. Sixteen steps. Your groove.',
    category: 'Sources',
    color: '#ca7b50',
    code: 'DRM–01',
    width: 452,
    height: 432,
    ports: [
      { id: 'kit', label: 'KIT IN', direction: 'input', signal: 'kit' },
      { id: 'trigger', label: 'TRIGGER IN', direction: 'input', signal: 'trigger' },
      { id: 'out', label: 'AUDIO OUT', direction: 'output', signal: 'audio' },
    ],
    controls: [
      { id: 'level', label: 'Level', min: 0, max: 1, step: 0.01, default: 0.7, unit: '%' },
      { id: 'tone', label: 'Tone', min: -12, max: 12, step: 1, default: 0, unit: 'st' },
      { id: 'decay', label: 'Decay', min: 0.3, max: 1.5, step: 0.01, default: 0.8, unit: '×' },
    ],
    defaults: { enabled: true },
  },
  'mic-sampler': {
    type: 'mic-sampler',
    name: 'Mic sampler',
    subtitle: 'Catch a sound. Make it yours.',
    description: 'Record a short microphone snippet, then play and patch it.',
    category: 'Sources',
    color: '#90a4ad',
    code: 'MIC–01',
    width: 300,
    height: 480,
    ports: [
      { id: 'trigger', label: 'TRIGGER IN', direction: 'input', signal: 'trigger' },
      {
        id: 'rateMod',
        label: 'SPEED MOD',
        direction: 'input',
        signal: 'control',
      },
      {
        id: 'levelMod',
        label: 'LEVEL MOD',
        direction: 'input',
        signal: 'control',
      },
      { id: 'out', label: 'AUDIO OUT', direction: 'output', signal: 'audio' },
    ],
    controls: [
      { id: 'level', label: 'Level', min: 0, max: 1, step: 0.01, default: 0.7, unit: '%' },
      { id: 'rate', label: 'Speed', min: 0.5, max: 2, step: 0.01, default: 1, unit: '×' },
      {
        id: 'trimStart',
        label: 'Trim start',
        min: 0,
        max: 1,
        step: SAMPLER_TRIM.step,
        default: SAMPLER_TRIM.start,
      },
      {
        id: 'trimEnd',
        label: 'Trim end',
        min: 0,
        max: 1,
        step: SAMPLER_TRIM.step,
        default: SAMPLER_TRIM.end,
      },
    ],
  },
  'drum-kit': {
    type: 'drum-kit',
    name: 'Drum kit',
    subtitle: 'A new character for every voice',
    description: 'Built-in drums, your samples, or patched-in sounds.',
    category: 'Sources',
    color: '#ba795e',
    code: 'KIT–04',
    width: 360,
    height: 500,
    ports: [
      { id: 'kick', label: 'IN 1', direction: 'input', signal: 'audio' },
      { id: 'snare', label: 'IN 2', direction: 'input', signal: 'audio' },
      { id: 'clap', label: 'IN 3', direction: 'input', signal: 'audio' },
      { id: 'closed-hat', label: 'IN 4', direction: 'input', signal: 'audio' },
      { id: 'kit', label: 'KIT OUT', direction: 'output', signal: 'kit' },
    ],
    controls: [
      {
        id: 'length',
        label: 'Input decay',
        min: 0.03,
        max: 2,
        step: 0.01,
        default: 0.3,
        unit: 's',
      },
    ],
    // Stable lane IDs preserve existing patterns even when their sounds are replaced.
    defaults: { kick: 'kick', snare: 'snare', clap: 'clap', 'closed-hat': 'closed-hat' },
  },
  keyboard: {
    type: 'keyboard',
    name: 'Keyboard',
    subtitle: 'Put a melody under your fingers',
    description: 'Two octaves of hands-on melody.',
    category: 'Modulation',
    color: '#8c9a78',
    code: 'KEY–01',
    width: 428,
    height: 360,
    ports: [{ id: 'pitch', label: 'PITCH / GATE', direction: 'output', signal: 'pitch' }],
    controls: [
      { id: 'octave', label: 'Octave', min: -2, max: 2, step: 1, default: 0 },
      { id: 'velocity', label: 'Velocity', min: 0.1, max: 1, step: 0.01, default: 0.8, unit: '%' },
    ],
  },
  'pad-controller': {
    type: 'pad-controller',
    name: 'Pad controller',
    subtitle: 'A rhythm at your fingertips',
    description: '4, 8 or 16 pads. Independent triggers.',
    category: 'Modulation',
    color: '#a18cb4',
    code: 'PAD–01',
    width: DEFAULT_PAD_LAYOUT.width,
    height: DEFAULT_PAD_LAYOUT.height,
    ports: [
      { id: 'trigger', label: 'ALL', direction: 'output', signal: 'trigger' },
      ...Array.from({ length: DEFAULT_PAD_LAYOUT.count }, (_, index) => ({
        id: `pad${index + 1}`,
        label: `PAD ${index + 1}`,
        direction: 'output' as const,
        signal: 'trigger' as const,
      })),
    ],
    defaults: { padCount: DEFAULT_PAD_LAYOUT.count },
    controls: [
      { id: 'velocity', label: 'Velocity', min: 0.1, max: 1, step: 0.01, default: 0.85, unit: '%' },
    ],
  },
  sequencer: {
    type: 'sequencer',
    name: 'Step sequencer',
    subtitle: 'A little rhythm goes a long way',
    description: 'Eight steps. Endless possibilities.',
    category: 'Modulation',
    color: '#d78647',
    code: 'SQ–01',
    width: 260,
    height: 304,
    ports: [{ id: 'pitch', label: 'PITCH', direction: 'output', signal: 'pitch' }],
    controls: [
      { id: 'gate', label: 'Gate', min: 0.1, max: 0.95, step: 0.01, default: 0.65, unit: '%' },
    ],
    defaults: { rate: DEFAULT_SEQUENCER_RATE.value },
  },
  oscillator: {
    type: 'oscillator',
    name: 'Oscillator',
    subtitle: 'Where the sound begins',
    description: 'The heart of your next sound.',
    category: 'Sources',
    color: '#d96c46',
    code: 'VCO–01',
    width: 244,
    height: 326,
    ports: [
      { id: 'pitch', label: 'PITCH', direction: 'input', signal: 'pitch' },
      {
        id: 'pitchMod',
        label: 'PITCH MOD',
        direction: 'input',
        signal: 'control',
      },
      { id: 'out', label: 'AUDIO OUT', direction: 'output', signal: 'audio' },
    ],
    controls: [
      { id: 'octave', label: 'Octave', min: -2, max: 2, step: 1, default: 0 },
      { id: 'detune', label: 'Fine tune', min: -50, max: 50, step: 1, default: 0, unit: 'ct' },
      { id: 'level', label: 'Level', min: 0, max: 0.8, step: 0.01, default: 0.32, unit: '%' },
    ],
    defaults: { waveform: 'sawtooth' },
  },
  noise: {
    type: 'noise',
    name: 'Noise',
    subtitle: 'A beautiful bit of chaos',
    description: 'Texture, grit, and happy accidents.',
    category: 'Sources',
    color: '#bd8b67',
    code: 'NS–01',
    width: 168,
    height: 220,
    ports: [{ id: 'out', label: 'AUDIO OUT', direction: 'output', signal: 'audio' }],
    controls: [
      { id: 'level', label: 'Level', min: 0, max: 0.5, step: 0.01, default: 0.12, unit: '%' },
    ],
  },
  lfo: {
    type: 'lfo',
    name: 'LFO',
    subtitle: 'Give your sound some movement',
    description: 'Slow waves that bring things to life.',
    category: 'Modulation',
    color: '#8a80b2',
    code: 'LFO–01',
    width: 216,
    height: 290,
    ports: [{ id: 'out', label: 'MOD OUT', direction: 'output', signal: 'control' }],
    controls: [
      { id: 'rate', label: 'Rate', min: 0.1, max: 15, step: 0.1, default: 0.6, unit: 'Hz' },
      { id: 'depth', label: 'Depth', min: 0, max: 1500, step: 10, default: 500, unit: 'Hz' },
    ],
  },
  envelope: {
    type: 'envelope',
    name: 'Envelope',
    subtitle: 'Give every note a shape',
    description: 'Attack and release sweeps from notes or pad hits.',
    category: 'Modulation',
    color: '#c5b89d',
    code: 'ENV–01',
    width: 276,
    height: 390,
    ports: [
      { id: 'gate', label: 'NOTE / GATE', direction: 'input', signal: 'pitch' },
      { id: 'trigger', label: 'TRIGGER IN', direction: 'input', signal: 'trigger' },
      { id: 'out', label: 'MOD OUT', direction: 'output', signal: 'control' },
    ],
    controls: [
      { id: 'attack', label: 'Attack', min: 0.005, max: 2, step: 0.005, default: 0.05, unit: 's' },
      { id: 'release', label: 'Release', min: 0.02, max: 3, step: 0.01, default: 0.4, unit: 's' },
      { id: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, default: 0.5, unit: '%' },
    ],
  },
  'mod-sequencer': {
    type: 'mod-sequencer',
    name: 'Mod sequencer',
    subtitle: 'Eight steps of movement',
    description: 'A tempo-synced pattern of control values, not notes.',
    category: 'Modulation',
    color: '#809fa3',
    code: 'MOD–08',
    width: 360,
    height: 520,
    ports: [{ id: 'out', label: 'MOD OUT', direction: 'output', signal: 'control' }],
    controls: [
      ...[0, 0.5, -0.3, 0.8, -0.6, 0.2, 1, -0.2].map((value, index) => ({
        id: `step${index + 1}`,
        label: `Mod step ${index + 1}`,
        min: -1,
        max: 1,
        step: 0.01,
        default: value,
      })),
      { id: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, default: 0.5, unit: '%' },
      { id: 'glide', label: 'Glide', min: 0, max: 0.2, step: 0.005, default: 0.01, unit: 's' },
    ],
    defaults: { rate: DEFAULT_SEQUENCER_RATE.value },
  },
  'random-mod': {
    type: 'random-mod',
    name: 'Sample & Hold',
    subtitle: 'A little controlled uncertainty',
    description: 'Random held modulation values, synced to tempo or pad hits.',
    category: 'Modulation',
    color: '#b3a05a',
    code: 'S&H–01',
    width: 260,
    height: 430,
    ports: [
      { id: 'trigger', label: 'TRIGGER IN', direction: 'input', signal: 'trigger' },
      { id: 'out', label: 'MOD OUT', direction: 'output', signal: 'control' },
    ],
    controls: [
      { id: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, default: 0.5, unit: '%' },
      { id: 'glide', label: 'Glide', min: 0, max: 0.2, step: 0.005, default: 0.01, unit: 's' },
    ],
    defaults: { rate: DEFAULT_SEQUENCER_RATE.value },
  },
  'xy-controller': {
    type: 'xy-controller',
    name: 'XY controller',
    subtitle: 'Two movements under one finger',
    description: 'Two independent modulation outputs from a hands-on pad.',
    category: 'Modulation',
    color: '#6683a4',
    code: 'XY–02',
    width: 300,
    height: 500,
    ports: [
      { id: 'x', label: 'X MOD', direction: 'output', signal: 'control' },
      { id: 'y', label: 'Y MOD', direction: 'output', signal: 'control' },
    ],
    controls: [
      { id: 'x', label: 'X position', min: -1, max: 1, step: 0.01, default: 0 },
      { id: 'y', label: 'Y position', min: -1, max: 1, step: 0.01, default: 0 },
      { id: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, default: 0.5, unit: '%' },
    ],
  },
  filter: {
    type: 'filter',
    name: 'Filter',
    subtitle: 'Carve out your own character',
    description: 'Shape the edges. Find the warmth.',
    category: 'Effects',
    color: '#7b916b',
    code: 'VCF–01',
    width: 244,
    height: 326,
    ports: [
      { id: 'in', label: 'AUDIO IN', direction: 'input', signal: 'audio' },
      { id: 'cutoff', label: 'MOD', direction: 'input', signal: 'control' },
      { id: 'out', label: 'AUDIO OUT', direction: 'output', signal: 'audio' },
    ],
    controls: [
      {
        id: 'cutoff',
        label: 'Cutoff',
        min: 80,
        max: 16000,
        step: 1,
        default: 1800,
        unit: 'Hz',
        logarithmic: true,
      },
      { id: 'resonance', label: 'Resonance', min: 0.1, max: 15, step: 0.1, default: 2.4 },
    ],
    defaults: { mode: 'lowpass' },
  },
  delay: {
    type: 'delay',
    name: 'Delay',
    subtitle: 'Let a good idea linger',
    description: 'A little echo. A lot of atmosphere.',
    category: 'Effects',
    color: '#6f91ac',
    code: 'DLY–01',
    width: 260,
    height: 284,
    ports: [
      { id: 'in', label: 'AUDIO IN', direction: 'input', signal: 'audio' },
      { id: 'out', label: 'AUDIO OUT', direction: 'output', signal: 'audio' },
    ],
    controls: [
      { id: 'time', label: 'Time', min: 0.05, max: 1, step: 0.01, default: 0.28, unit: 's' },
      {
        id: 'feedback',
        label: 'Feedback',
        min: 0,
        max: 0.85,
        step: 0.01,
        default: 0.32,
        unit: '%',
      },
      { id: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, default: 0.28, unit: '%' },
    ],
  },
  reverb: {
    type: 'reverb',
    name: 'Reverb',
    subtitle: 'Make a little more room',
    description: 'Put your sound in a bigger space.',
    category: 'Effects',
    color: '#b58aa4',
    code: 'RVB–01',
    width: 180,
    height: 220,
    ports: [
      { id: 'in', label: 'AUDIO IN', direction: 'input', signal: 'audio' },
      { id: 'out', label: 'AUDIO OUT', direction: 'output', signal: 'audio' },
    ],
    controls: [{ id: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, default: 0.25, unit: '%' }],
  },
  'xy-effects': {
    type: 'xy-effects',
    name: 'XY Effects',
    subtitle: 'Four corners. Find your own in-between.',
    description: 'Slide between four effects. Choose what lives in each corner.',
    category: 'Effects',
    color: '#cb8d69',
    code: 'XY–04',
    width: 340,
    height: 570,
    ports: [
      { id: 'in', label: 'AUDIO IN', direction: 'input', signal: 'audio' },
      { id: 'out', label: 'AUDIO OUT', direction: 'output', signal: 'audio' },
    ],
    controls: [
      { id: 'x', label: 'X position', min: -1, max: 1, step: 0.01, default: 0 },
      { id: 'y', label: 'Y position', min: -1, max: 1, step: 0.01, default: 0 },
      { id: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, default: 0.7, unit: '%' },
    ],
    defaults: { topLeft: 'filter', topRight: 'echo', bottomLeft: 'grit', bottomRight: 'space' },
  },
  mixer: {
    type: 'mixer',
    name: 'Mixer',
    subtitle: 'Bring your ideas together',
    description: 'Blend 2–8 signals with individual faders.',
    category: 'Utility',
    color: '#a29373',
    code: 'MIX–01',
    width: 184,
    height: 270,
    ports: [
      ...MIXER_CHANNEL_IDS.map((id) => ({
        id,
        label: `IN ${id.toUpperCase()}`,
        direction: 'input' as const,
        signal: 'audio' as const,
      })),
      { id: 'out', label: 'AUDIO OUT', direction: 'output', signal: 'audio' },
    ],
    controls: MIXER_CHANNEL_IDS.map((id) => ({
      id,
      label: `Channel ${id.toUpperCase()}`,
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.7,
      unit: '%',
    })),
    defaults: { inputCount: MIXER_INPUT_COUNTS[0] },
  },
  merger: {
    type: 'merger',
    name: 'Merger',
    subtitle: 'Four sounds. One destination.',
    description: 'Balance four audio inputs with individual levels and one sum control.',
    category: 'Utility',
    color: '#5a9290',
    code: 'SUM–04',
    width: 320,
    height: 248,
    ports: [
      { id: 'in1', label: 'IN 1', direction: 'input', signal: 'audio' },
      { id: 'in2', label: 'IN 2', direction: 'input', signal: 'audio' },
      { id: 'in3', label: 'IN 3', direction: 'input', signal: 'audio' },
      { id: 'in4', label: 'IN 4', direction: 'input', signal: 'audio' },
      { id: 'out', label: 'SUM OUT', direction: 'output', signal: 'audio' },
    ],
    controls: [
      { id: 'in1', label: 'Input 1', min: 0, max: 1, step: 0.01, default: 1, unit: '%' },
      { id: 'in2', label: 'Input 2', min: 0, max: 1, step: 0.01, default: 1, unit: '%' },
      { id: 'in3', label: 'Input 3', min: 0, max: 1, step: 0.01, default: 1, unit: '%' },
      { id: 'in4', label: 'Input 4', min: 0, max: 1, step: 0.01, default: 1, unit: '%' },
      { id: 'level', label: 'Sum level', min: 0, max: 1, step: 0.01, default: 0.5, unit: '%' },
    ],
  },
  switch: {
    type: 'switch',
    name: 'Switch',
    subtitle: 'A different sound at the press of a key',
    description: 'Choose one of four audio inputs without repatching.',
    category: 'Utility',
    color: '#b67c83',
    code: 'SW–04',
    width: 320,
    height: 300,
    ports: [
      { id: 'in1', label: 'IN 1', direction: 'input', signal: 'audio' },
      { id: 'in2', label: 'IN 2', direction: 'input', signal: 'audio' },
      { id: 'in3', label: 'IN 3', direction: 'input', signal: 'audio' },
      { id: 'in4', label: 'IN 4', direction: 'input', signal: 'audio' },
      { id: 'out', label: 'AUDIO OUT', direction: 'output', signal: 'audio' },
    ],
    controls: [{ id: 'selected', label: 'Selected input', min: 1, max: 4, step: 1, default: 1 }],
  },
  output: {
    type: 'output',
    name: 'Output',
    subtitle: 'All roads lead to your ears',
    description: 'The final stop. Make it heard.',
    category: 'Utility',
    color: '#b69656',
    code: 'OUT–01',
    width: 228,
    height: 326,
    maxInstances: 1,
    ports: [{ id: 'in', label: 'AUDIO IN', direction: 'input', signal: 'audio' }],
    controls: [
      { id: 'level', label: 'Output level', min: 0, max: 1, step: 0.01, default: 0.8, unit: '%' },
    ],
  },
};

export const MODULE_LIST = Object.values(MODULES);

/** Resolve the same configured footprint/sockets for rendering, placement and validation. */
export function moduleDefinition(
  module: Pick<PatchModule, 'type' | 'parameters'>,
): ModuleDefinition {
  const definition = MODULES[module.type];
  if (module.type === 'mixer') {
    const count = mixerInputCount(module.parameters.inputCount);
    return {
      ...definition,
      width: definition.width + (count - MIXER_INPUT_COUNTS[0]) * 64,
      ports: [...definition.ports.slice(0, count), definition.ports[definition.ports.length - 1]],
      controls: definition.controls.slice(0, count),
    };
  }
  if (module.type !== 'pad-controller') return definition;
  const layout = padLayout(module.parameters.padCount);
  return {
    ...definition,
    width: layout.width,
    height: layout.height,
    ports: definition.ports.slice(0, layout.count + 1),
  };
}

export function defaultParameters(type: ModuleType) {
  const definition = MODULES[type];
  return {
    ...definition.defaults,
    ...Object.fromEntries(definition.controls.map((control) => [control.id, control.default])),
  };
}
