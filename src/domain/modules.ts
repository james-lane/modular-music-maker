import type { ModuleDefinition, ModuleType } from './types';

/** The module catalog is the source of truth for appearance, ports and parameter ranges.
 * To add a module, register its definition here and its sound factory in audio/factories.ts.
 * Ordinary numeric controls render automatically; only special interfaces need a component.
 */
export const MODULES: Record<ModuleType, ModuleDefinition> = {
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
    width: 244,
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
    width: 244,
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
    width: 244,
    height: 270,
    ports: [
      { id: 'in', label: 'AUDIO IN', direction: 'input', signal: 'audio' },
      { id: 'out', label: 'AUDIO OUT', direction: 'output', signal: 'audio' },
    ],
    controls: [{ id: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, default: 0.25, unit: '%' }],
  },
  mixer: {
    type: 'mixer',
    name: 'Mixer',
    subtitle: 'Bring your ideas together',
    description: 'Blend two signals into something new.',
    category: 'Utility',
    color: '#a29373',
    code: 'MIX–01',
    width: 244,
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
  output: {
    type: 'output',
    name: 'Output',
    subtitle: 'All roads lead to your ears',
    description: 'The final stop. Make it heard.',
    category: 'Utility',
    color: '#b69656',
    code: 'OUT–01',
    width: 244,
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
