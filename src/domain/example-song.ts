import { createDemoClap } from './demo-samples';
import { DRUM_LANES, DRUM_STEP_COUNT, type DrumSound } from './instruments';
import { moduleDefinition } from './modules';
import { createModule, createProject } from './project';
import type { Cable, ModuleType, Parameters, PatchModule, Project } from './types';

/** All section changes fall on two-bar phrase boundaries. Input 4 is deliberately
 * unpatched on every Switch: the last cue lets the effects decay into a real ending.
 * Keep this a normal editable patch; the existing audio clock performs the arrangement.
 */
export function createDaylightRadioProject(): Project {
  const tempo = 120;
  const modules: PatchModule[] = [];
  const cables: Cable[] = [];
  const add = (type: ModuleType, parameters: Parameters = {}) => {
    const module = createModule(type, 0, 0);
    module.parameters = { ...module.parameters, ...parameters };
    modules.push(module);
    return module;
  };
  const connect = (from: PatchModule, output: string, to: PatchModule, input: string) => {
    cables.push({
      id: crypto.randomUUID(),
      from: { moduleId: from.id, portId: output },
      to: { moduleId: to.id, portId: input },
    });
  };
  const notes = (steps: number[], gate: number) => {
    const module = add('sequencer', { rate: '1/4', gate });
    module.steps = steps;
    return module;
  };
  const rhythm = (hits: Partial<Record<DrumSound, readonly number[]>>, level: number) => {
    const module = add('drum-machine', { level, decay: 0.55 });
    module.drumPattern = Object.fromEntries(
      DRUM_LANES.map((sound) => [
        sound,
        Array.from({ length: DRUM_STEP_COUNT }, (_, step) => (hits[sound] ?? []).includes(step)),
      ]),
    );
    return module;
  };
  // Intro 1–2, verse 3–6, chorus 7–10, breakdown 11–12, reprise 13–14, tag 15–16.
  const bars = [1, 3, 7, 11, 13, 15, 17];
  const programme = (inputs: number[]) => {
    const module = add('switch', { automatic: true, repeat: false, loopBars: 16 });
    module.switchCues = bars.map((bar, index) => ({ bar, input: inputs[index] }));
    module.parameters.selected = inputs[0];
    return module;
  };

  const tagNotes = notes([7, -1, 5, -1, 4, 6, 7, -1], 0.38);
  const tag = add('oscillator', { waveform: 'sine', octave: 1, level: 0.38 });
  const verseNotes = notes([4, -1, 5, 7, 6, 4, 2, -1], 0.5);
  const verse = add('oscillator', { waveform: 'triangle', octave: 1, level: 0.38 });
  const hookNotes = notes([9, 9, 10, 9, 8, 6, 7, -1], 0.56);
  const hook = add('oscillator', { waveform: 'triangle', octave: 1, level: 0.42 });
  const melody = programme([1, 2, 3, 1, 3, 1, 4]);
  const leadFilter = add('filter', { cutoff: 2800, resonance: 0.7 });
  const echo = add('delay', { time: 60 / tempo / 2, feedback: 0.22, mix: 0.18 });
  const envelope = add('envelope', { attack: 0.015, release: 0.16, depth: 0.65 });
  for (const [sequence, oscillator, input] of [
    [tagNotes, tag, 'in1'],
    [verseNotes, verse, 'in2'],
    [hookNotes, hook, 'in3'],
  ] as const) {
    connect(sequence, 'pitch', oscillator, 'pitch');
    connect(oscillator, 'out', melody, input);
  }
  connect(hookNotes, 'pitch', envelope, 'gate');
  connect(envelope, 'out', leadFilter, 'cutoff');
  connect(melody, 'out', leadFilter, 'in');
  connect(leadFilter, 'out', echo, 'in');

  const bassNotes = notes([0, -1, 3, -1, 4, -1, 0, -1], 0.65);
  const bass = add('oscillator', { waveform: 'triangle', octave: -1, level: 0.5 });
  const walkingNotes = notes([0, 4, 3, 0, 4, 1, 0, 4], 0.65);
  const walkingBass = add('oscillator', { waveform: 'sawtooth', octave: -1, level: 0.42 });
  const bassPart = programme([4, 1, 2, 4, 2, 1, 4]);
  const bassFilter = add('filter', { cutoff: 650, resonance: 0.8 });
  const lfo = add('lfo', { rate: 0.1, depth: 100 });
  connect(bassNotes, 'pitch', bass, 'pitch');
  connect(walkingNotes, 'pitch', walkingBass, 'pitch');
  connect(bass, 'out', bassPart, 'in1');
  connect(walkingBass, 'out', bassPart, 'in2');
  connect(bassPart, 'out', bassFilter, 'in');
  connect(lfo, 'out', bassFilter, 'cutoff');

  // C–F–G–C, one chord per half-bar. Three independent pitches make actual triads.
  const roots = notes([0, 0, 3, 3, 4, 4, 0, 0], 0.82);
  const rootVoice = add('oscillator', { waveform: 'triangle', level: 0.22 });
  const thirds = notes([2, 2, 5, 5, 6, 6, 2, 2], 0.82);
  const thirdVoice = add('oscillator', { waveform: 'triangle', level: 0.19 });
  const fifths = notes([4, 4, 7, 7, 8, 8, 4, 4], 0.82);
  const fifthVoice = add('oscillator', { waveform: 'sine', level: 0.2 });
  const chords = add('merger', { level: 0.85 });
  const chordFilter = add('filter', { cutoff: 2400, resonance: 0.7 });
  const room = add('reverb', { mix: 0.17 });
  const space = add('xy-effects', { x: 0.1, y: -0.2, mix: 0.12 });
  const harmony = programme([4, 4, 1, 4, 1, 4, 4]);
  const drift = add('random-mod', { rate: '1/4', depth: 0.12, glide: 0.12 });
  for (const [sequence, oscillator, input] of [
    [roots, rootVoice, 'in1'],
    [thirds, thirdVoice, 'in2'],
    [fifths, fifthVoice, 'in3'],
  ] as const) {
    connect(sequence, 'pitch', oscillator, 'pitch');
    connect(oscillator, 'out', chords, input);
  }
  connect(chords, 'out', chordFilter, 'in');
  connect(drift, 'out', chordFilter, 'cutoff');
  connect(chordFilter, 'out', room, 'in');
  connect(room, 'out', space, 'in');
  connect(space, 'out', harmony, 'in1');

  const beat = rhythm({ kick: [0, 8, 10], snare: [4, 12] }, 0.48);
  const percussion = rhythm({ snare: [2, 6, 10, 14], clap: [4, 12], 'closed-hat': [0, 8] }, 0.32);
  const kit = add('drum-kit', {
    snare: 'shaker',
    clap: 'input',
    'closed-hat': 'input',
    length: 0.04,
  });
  const noise = add('noise', { level: 0.12 });
  const sampler = add('mic-sampler', { level: 0.65 });
  sampler.samples = { clip: createDemoClap() };
  const shuffle = add('mod-sequencer', { rate: '1/8', depth: 0.025, glide: 0.03 });
  const clapLevel = add('xy-controller', { x: 0.85, y: 0, depth: 1 });
  const rhythmMix = add('mixer', { a: 0.85, b: 0.75 });
  const rhythmPart = programme([1, 2, 3, 1, 3, 4, 4]);
  connect(sampler, 'out', kit, 'clap');
  connect(shuffle, 'out', sampler, 'rateMod');
  connect(clapLevel, 'x', sampler, 'levelMod');
  connect(noise, 'out', kit, 'closed-hat');
  connect(kit, 'kit', percussion, 'kit');
  connect(beat, 'out', rhythmMix, 'a');
  connect(percussion, 'out', rhythmMix, 'b');
  connect(percussion, 'out', rhythmPart, 'in1');
  connect(beat, 'out', rhythmPart, 'in2');
  connect(rhythmMix, 'out', rhythmPart, 'in3');

  const master = add('merger', { level: 0.9, in1: 1, in2: 0.85, in3: 0.7, in4: 0.85 });
  const output = add('output', { level: 0.85 });
  connect(echo, 'out', master, 'in1');
  connect(bassFilter, 'out', master, 'in2');
  connect(harmony, 'out', master, 'in3');
  connect(rhythmPart, 'out', master, 'in4');
  connect(master, 'out', output, 'in');

  // Use resolved footprints so concurrent/new socket configurations cannot make
  // this dense example overlap. Each row follows one musical job, left to right.
  const rows = [
    [melody, bassPart, harmony, rhythmPart, master, output],
    [tagNotes, tag, verseNotes, verse, hookNotes, hook, leadFilter, echo, envelope],
    [bassNotes, bass, walkingNotes, walkingBass, bassFilter, lfo],
    [
      roots,
      rootVoice,
      thirds,
      thirdVoice,
      fifths,
      fifthVoice,
      chords,
      chordFilter,
      room,
      space,
      drift,
    ],
    [beat, percussion, kit, noise, sampler, shuffle, clapLevel, rhythmMix],
  ];
  let y = 40;
  for (const row of rows) {
    let x = 40;
    for (const module of row) {
      module.x = x;
      module.y = y;
      x += moduleDefinition(module).width + 40;
    }
    y += Math.max(...row.map((module) => moduleDefinition(module).height)) + 60;
  }

  return {
    ...createProject(true),
    name: 'Daylight radio',
    tempo,
    rootNote: 'C',
    scale: 'major',
    modules,
    cables,
  };
}
