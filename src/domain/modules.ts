import type { ModuleDefinition, ModuleType } from './types';

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
    description: 'Sixteen pads. A whole kit to play.',
    category: 'Modulation',
    color: '#a18cb4',
    code: 'PAD–01',
    width: 300,
    height: 492,
    ports: [{ id: 'trigger', label: 'TRIGGER OUT', direction: 'output', signal: 'trigger' }],
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
    width: 212,
    height: 274,
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
    width: 220,
    height: 270,
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
    description: 'Blend two signals into something new.',
    category: 'Utility',
    color: '#a29373',
    code: 'MIX–01',
    width: 184,
    height: 270,
    ports: [
      { id: 'a', label: 'IN A', direction: 'input', signal: 'audio' },
      { id: 'b', label: 'IN B', direction: 'input', signal: 'audio' },
      { id: 'out', label: 'AUDIO OUT', direction: 'output', signal: 'audio' },
    ],
    controls: [
      { id: 'a', label: 'Channel A', min: 0, max: 1, step: 0.01, default: 0.7, unit: '%' },
      { id: 'b', label: 'Channel B', min: 0, max: 1, step: 0.01, default: 0.7, unit: '%' },
    ],
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
    height: 336,
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

export function defaultParameters(type: ModuleType) {
  const definition = MODULES[type];
  return {
    ...definition.defaults,
    ...Object.fromEntries(definition.controls.map((control) => [control.id, control.default])),
  };
}
