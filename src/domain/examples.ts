import { createDemoClap } from './demo-samples';
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
  artwork: 'melody' | 'performance' | 'bass' | 'texture' | 'arcade' | 'xy' | 'ensemble' | 'pop';
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

function createCopperProject(): Project {
  const kit = instrument('drum-kit', -440, 60, {
    snare: 'rim',
    clap: 'low-conga',
    'closed-hat': 'input',
    length: 0.055,
  });
  const noise = instrument('noise', -440, 620, { level: 0.16 });
  const drums = instrument('drum-machine', 0, 60, { level: 0.62, tone: -1, decay: 0.6 });
  drums.drumPattern = drumPattern({
    kick: [0, 6, 10],
    snare: [4, 12],
    clap: [3, 7, 11, 14],
    'closed-hat': [0, 2, 4, 6, 8, 10, 12, 14, 15],
  });
  const sequencer = instrument('sequencer', 0, 540, { gate: 0.45 });
  sequencer.steps = [0, -1, 3, 4, -1, 6, 4, -1];
  const bass = instrument('oscillator', 340, 540, {
    waveform: 'triangle',
    octave: -1,
    level: 0.42,
  });
  const merger = instrument('merger', 540, 60, { level: 0.65 });
  const effects = instrument('xy-effects', 940, 60, { x: 0.45, y: 0.65, mix: 0.5 });
  const output = instrument('output', 1360, 60, { level: 0.8 });
  return {
    ...createProject(true),
    name: 'Copper currents',
    tempo: 94,
    rootNote: 'D',
    scale: 'pentatonic',
    modules: [kit, noise, drums, sequencer, bass, merger, effects, output],
    cables: [
      // The kit gates this continuous noise into hats; it is never a direct noise wash.
      wire(noise, 'out', kit, 'closed-hat'),
      wire(kit, 'kit', drums, 'kit'),
      wire(sequencer, 'pitch', bass, 'pitch'),
      wire(drums, 'out', merger, 'in1'),
      wire(bass, 'out', merger, 'in2'),
      wire(merger, 'out', effects, 'in'),
      wire(effects, 'out', output, 'in'),
    ],
  };
}

/** Four readable rows: rhythm, bass, layered lead, then answering bells.
 * Repeated modules have separate musical jobs; the lead's pitch fan-out is intentional.
 * Keep the two submixers and two mergers explicit so the recipe teaches bus routing.
 */
function createClockworkProject(): Project {
  const tempo = 118;
  const eighth = 60 / tempo / 2;
  const drums = instrument('drum-machine', -1000, -480, { level: 0.48, tone: -2, decay: 0.55 });
  drums.drumPattern = drumPattern({ kick: [0, 8], snare: [4, 12], 'closed-hat': [2, 6, 10, 14] });
  const percussion = instrument('drum-machine', -480, -480, { level: 0.34, tone: 2, decay: 0.5 });
  percussion.drumPattern = drumPattern({
    kick: [3, 10],
    snare: [6, 15],
    clap: [1, 5, 9, 13],
    'closed-hat': [14],
  });
  const kit = instrument('drum-kit', 40, -480, {
    kick: 'low-conga',
    snare: 'claves',
    clap: 'shaker',
    'closed-hat': 'open-hat',
  });
  const rhythmMix = instrument('mixer', 460, -480, { a: 0.8, b: 0.65 });

  const bassSequence = instrument('sequencer', -1000, 100, { gate: 0.54 });
  bassSequence.steps = [0, 0, -1, 0, 3, -1, 4, 6];
  const bass = instrument('oscillator', -680, 100, {
    waveform: 'sawtooth',
    octave: -1,
    level: 0.27,
  });
  const bassFilter = instrument('filter', -360, 100, { cutoff: 620, resonance: 1.5 });
  const bassLfo = instrument('lfo', -60, 100, { rate: 0.17, depth: 220 });

  const leadSequence = instrument('sequencer', -1000, 500, { gate: 0.42 });
  leadSequence.steps = [7, -1, 9, -1, 11, -1, 9, 6];
  const leadSaw = instrument('oscillator', -680, 500, {
    waveform: 'sawtooth',
    detune: -7,
    level: 0.17,
  });
  const leadTriangle = instrument('oscillator', -360, 500, {
    waveform: 'triangle',
    detune: 7,
    level: 0.22,
  });
  const leadMix = instrument('mixer', -60, 500, { a: 0.55, b: 0.75 });
  const leadFilter = instrument('filter', 260, 500, { cutoff: 2400, resonance: 1.1 });
  const leadEcho = instrument('delay', 580, 500, { time: eighth * 1.5, feedback: 0.28, mix: 0.24 });
  const leadLfo = instrument('lfo', 900, 500, { rate: 0.31, depth: 900 });

  const bellSequence = instrument('sequencer', -1000, 900, { gate: 0.22 });
  bellSequence.steps = [-1, 4, -1, 6, -1, 7, 4, -1];
  const bell = instrument('oscillator', -680, 900, { waveform: 'sine', octave: 1, level: 0.2 });
  const bellFilter = instrument('filter', -360, 900, { cutoff: 4200, resonance: 0.7 });
  const bellEcho = instrument('delay', -60, 900, { time: eighth, feedback: 0.36, mix: 0.32 });

  const voices = instrument('merger', 780, 100, { level: 0.8 });
  const room = instrument('reverb', 1180, 100, { mix: 0.2 });
  const master = instrument('merger', 1180, -480, { level: 0.8 });
  const output = instrument('output', 1580, -480, { level: 0.8 });
  return {
    ...createProject(true),
    name: 'Clockwork garden',
    tempo,
    rootNote: 'E',
    scale: 'minor',
    modules: [
      drums,
      percussion,
      kit,
      rhythmMix,
      bassSequence,
      bass,
      bassFilter,
      bassLfo,
      leadSequence,
      leadSaw,
      leadTriangle,
      leadMix,
      leadFilter,
      leadEcho,
      leadLfo,
      bellSequence,
      bell,
      bellFilter,
      bellEcho,
      voices,
      room,
      master,
      output,
    ],
    cables: [
      wire(kit, 'kit', percussion, 'kit'),
      wire(drums, 'out', rhythmMix, 'a'),
      wire(percussion, 'out', rhythmMix, 'b'),
      wire(bassSequence, 'pitch', bass, 'pitch'),
      wire(bass, 'out', bassFilter, 'in'),
      wire(bassLfo, 'out', bassFilter, 'cutoff'),
      wire(bassFilter, 'out', voices, 'in1'),
      // One sequence plays two detuned voices. This fader pair blends their timbres.
      wire(leadSequence, 'pitch', leadSaw, 'pitch'),
      wire(leadSequence, 'pitch', leadTriangle, 'pitch'),
      wire(leadSaw, 'out', leadMix, 'a'),
      wire(leadTriangle, 'out', leadMix, 'b'),
      wire(leadMix, 'out', leadFilter, 'in'),
      wire(leadLfo, 'out', leadFilter, 'cutoff'),
      wire(leadFilter, 'out', leadEcho, 'in'),
      wire(leadEcho, 'out', voices, 'in2'),
      wire(bellSequence, 'pitch', bell, 'pitch'),
      wire(bell, 'out', bellFilter, 'in'),
      wire(bellFilter, 'out', bellEcho, 'in'),
      wire(bellEcho, 'out', voices, 'in3'),
      // Only the melodic bus gets room ambience; the separate rhythm bus stays crisp.
      wire(voices, 'out', room, 'in'),
      wire(room, 'out', master, 'in1'),
      wire(rhythmMix, 'out', master, 'in2'),
      wire(master, 'out', output, 'in'),
    ],
  };
}

/** A dedicated control lesson keeps the established 38-module performance fixture intact. */
function createMovingPartsProject(): Project {
  const notes = instrument('sequencer', 40, 40, { rate: '1/4', gate: 0.4 });
  const oscillator = instrument('oscillator', 360, 40, { waveform: 'triangle', level: 0.24 });
  const filter = instrument('filter', 660, 40, { cutoff: 750, resonance: 0.7 });
  const envelope = instrument('envelope', 960, 40, { attack: 0.02, release: 0.3, depth: 0.65 });
  const modulation = instrument('mod-sequencer', 40, 470, {
    rate: '1/8',
    depth: 0.025,
    glide: 0.04,
  });
  const random = instrument('random-mod', 460, 470, { rate: '1/4', depth: 0.3, glide: 0.07 });
  const xy = instrument('xy-controller', 780, 470, { x: 0.9, y: -0.2, depth: 0.7 });
  const sampler = instrument('mic-sampler', 40, 1000, { level: 0.5 });
  sampler.samples = { clip: createDemoClap() };
  const sampleFilter = instrument('filter', 400, 1000, { cutoff: 2800, resonance: 0.7 });
  const kit = instrument('drum-kit', 700, 1000, { kick: 'input' });
  const drums = instrument('drum-machine', 1120, 1000, { level: 0.5 });
  drums.drumPattern = drumPattern({ kick: [0, 4, 8, 12] });
  const merger = instrument('merger', 1300, 40, { level: 0.7 });
  const output = instrument('output', 1700, 40);
  return {
    ...createProject(true),
    name: 'Moving parts',
    tempo: 104,
    modules: [
      notes,
      oscillator,
      filter,
      envelope,
      modulation,
      random,
      xy,
      sampler,
      sampleFilter,
      kit,
      drums,
      merger,
      output,
    ],
    cables: [
      wire(notes, 'pitch', oscillator, 'pitch'),
      wire(notes, 'pitch', envelope, 'gate'),
      wire(envelope, 'out', filter, 'cutoff'),
      wire(modulation, 'out', oscillator, 'pitchMod'),
      wire(oscillator, 'out', filter, 'in'),
      wire(filter, 'out', merger, 'in1'),
      wire(xy, 'x', sampler, 'levelMod'),
      wire(xy, 'y', sampler, 'rateMod'),
      wire(random, 'out', sampleFilter, 'cutoff'),
      wire(sampler, 'out', sampleFilter, 'in'),
      wire(sampleFilter, 'out', kit, 'kick'),
      wire(kit, 'kit', drums, 'kit'),
      wire(drums, 'out', merger, 'in2'),
      wire(merger, 'out', output, 'in'),
    ],
  };
}

/** Five instrument rows run rhythm, bass, chords, hook, then live performance.
 * The original seventeen module types have a job; Switch chooses hook, keys, dry hook or duet.
 * Quarter-note sequences share a two-bar I–V–vi–IV progression in C major.
 */
function createNeonProject(): Project {
  const tempo = 116;
  const eighth = 60 / tempo / 2;
  const pads = instrument('pad-controller', -1600, -1120, { velocity: 0.75 });
  const drums = instrument('drum-machine', -1220, -1120, { level: 0.54, decay: 0.65 });
  drums.drumPattern = drumPattern({ kick: [0, 4, 8, 12], snare: [4, 12] });
  const sampler = instrument('mic-sampler', -680, -1120, { level: 0.6 });
  sampler.samples = { clip: createDemoClap() };
  const kit = instrument('drum-kit', -300, -1120, {
    kick: 'tambourine',
    snare: 'shaker',
    clap: 'input',
    'closed-hat': 'input',
    length: 0.045,
  });
  const percussion = instrument('drum-machine', 140, -1120, { level: 0.42, decay: 0.7 });
  percussion.drumPattern = drumPattern({
    kick: [2, 10],
    snare: [0, 3, 6, 8, 11, 14],
    clap: [4, 12],
    'closed-hat': [2, 6, 10, 14, 15],
  });
  const noise = instrument('noise', 680, -1120, { level: 0.17 });
  const rhythmMix = instrument('mixer', 980, -1120, { a: 0.85, b: 0.75 });

  const bassSequence = instrument('sequencer', -1600, -500, { rate: '1/4', gate: 0.7 });
  bassSequence.steps = [0, 0, 4, 4, 5, 5, 3, 3];
  const bass = instrument('oscillator', -1280, -500, {
    waveform: 'sawtooth',
    octave: -1,
    level: 0.3,
  });
  const bassFilter = instrument('filter', -960, -500, { cutoff: 550, resonance: 0.8 });
  const bassLfo = instrument('lfo', -640, -500, { rate: 0.2, depth: 140 });

  const rootSequence = instrument('sequencer', -1600, -80, { rate: '1/4', gate: 0.76 });
  rootSequence.steps = [0, 0, 4, 4, 5, 5, 3, 3];
  const root = instrument('oscillator', -1280, -80, { waveform: 'triangle', level: 0.18 });
  const thirdSequence = instrument('sequencer', -960, -80, { rate: '1/4', gate: 0.76 });
  thirdSequence.steps = [2, 2, 6, 6, 7, 7, 5, 5];
  const third = instrument('oscillator', -640, -80, { waveform: 'triangle', level: 0.16 });
  const fifthSequence = instrument('sequencer', -320, -80, { rate: '1/4', gate: 0.76 });
  fifthSequence.steps = [4, 4, 8, 8, 9, 9, 7, 7];
  const fifth = instrument('oscillator', 0, -80, { waveform: 'triangle', level: 0.15 });
  const chordMix = instrument('merger', 320, -80, { level: 0.7 });
  const chordFilter = instrument('filter', 720, -80, { cutoff: 2800, resonance: 0.6 });
  const chordRoom = instrument('reverb', 1040, -80, { mix: 0.18 });

  const hookSequence = instrument('sequencer', -1600, 340, { rate: '1/4', gate: 0.48 });
  hookSequence.steps = [9, 8, 8, 6, 7, 9, 7, 5];
  const hookSaw = instrument('oscillator', -1280, 340, {
    waveform: 'sawtooth',
    detune: -6,
    level: 0.14,
  });
  const hookTriangle = instrument('oscillator', -960, 340, {
    waveform: 'triangle',
    detune: 6,
    level: 0.18,
  });
  const hookMix = instrument('mixer', -640, 340, { a: 0.55, b: 0.7 });
  const hookFilter = instrument('filter', -360, 340, { cutoff: 3200, resonance: 0.8 });
  const hookEcho = instrument('delay', -40, 340, { time: eighth * 1.5, feedback: 0.24, mix: 0.22 });
  const hookLfo = instrument('lfo', 300, 340, { rate: 0.3, depth: 450 });

  const keyboard = instrument('keyboard', -1600, 780, { velocity: 0.7 });
  const liveVoice = instrument('oscillator', -1080, 780, { waveform: 'square', level: 0.18 });
  const liveFilter = instrument('filter', -760, 780, { cutoff: 1800, resonance: 0.7 });
  const liveEcho = instrument('delay', -440, 780, { time: eighth, feedback: 0.22, mix: 0.2 });
  const duet = instrument('merger', -100, 780, { level: 0.85 });
  const selector = instrument('switch', 300, 780);
  const effects = instrument('xy-effects', 700, 780, { x: 0.2, y: -0.2, mix: 0.25 });

  const voices = instrument('merger', 1320, -500, { level: 0.85, in1: 0.95, in2: 0.8, in3: 0.85 });
  const room = instrument('reverb', 1720, -500, { mix: 0.1 });
  const master = instrument('merger', 1320, -1120, { level: 0.85 });
  const output = instrument('output', 1720, -1120, { level: 0.85 });
  return {
    ...createProject(true),
    name: 'Neon chorus',
    tempo,
    rootNote: 'C',
    scale: 'major',
    modules: [
      pads,
      drums,
      sampler,
      kit,
      percussion,
      noise,
      rhythmMix,
      bassSequence,
      bass,
      bassFilter,
      bassLfo,
      rootSequence,
      root,
      thirdSequence,
      third,
      fifthSequence,
      fifth,
      chordMix,
      chordFilter,
      chordRoom,
      hookSequence,
      hookSaw,
      hookTriangle,
      hookMix,
      hookFilter,
      hookEcho,
      hookLfo,
      keyboard,
      liveVoice,
      liveFilter,
      liveEcho,
      duet,
      selector,
      effects,
      voices,
      room,
      master,
      output,
    ],
    cables: [
      wire(pads, 'trigger', drums, 'trigger'),
      // Direct sampler → kit wiring retriggers the saved clap independently on each backbeat.
      wire(sampler, 'out', kit, 'clap'),
      wire(noise, 'out', kit, 'closed-hat'),
      wire(kit, 'kit', percussion, 'kit'),
      wire(drums, 'out', rhythmMix, 'a'),
      wire(percussion, 'out', rhythmMix, 'b'),
      wire(bassSequence, 'pitch', bass, 'pitch'),
      wire(bass, 'out', bassFilter, 'in'),
      wire(bassLfo, 'out', bassFilter, 'cutoff'),
      wire(bassFilter, 'out', voices, 'in1'),
      wire(rootSequence, 'pitch', root, 'pitch'),
      wire(thirdSequence, 'pitch', third, 'pitch'),
      wire(fifthSequence, 'pitch', fifth, 'pitch'),
      wire(root, 'out', chordMix, 'in1'),
      wire(third, 'out', chordMix, 'in2'),
      wire(fifth, 'out', chordMix, 'in3'),
      wire(chordMix, 'out', chordFilter, 'in'),
      wire(chordFilter, 'out', chordRoom, 'in'),
      wire(chordRoom, 'out', voices, 'in2'),
      wire(hookSequence, 'pitch', hookSaw, 'pitch'),
      wire(hookSequence, 'pitch', hookTriangle, 'pitch'),
      wire(hookSaw, 'out', hookMix, 'a'),
      wire(hookTriangle, 'out', hookMix, 'b'),
      wire(hookMix, 'out', hookFilter, 'in'),
      wire(hookLfo, 'out', hookFilter, 'cutoff'),
      wire(hookFilter, 'out', hookEcho, 'in'),
      wire(keyboard, 'pitch', liveVoice, 'pitch'),
      wire(liveVoice, 'out', liveFilter, 'in'),
      wire(liveFilter, 'out', liveEcho, 'in'),
      // Alternate hook / live keys / dry hook / both. The backing always keeps playing.
      wire(hookEcho, 'out', duet, 'in1'),
      wire(liveEcho, 'out', duet, 'in2'),
      wire(hookEcho, 'out', selector, 'in1'),
      wire(liveEcho, 'out', selector, 'in2'),
      wire(hookMix, 'out', selector, 'in3'),
      wire(duet, 'out', selector, 'in4'),
      wire(selector, 'out', effects, 'in'),
      wire(effects, 'out', voices, 'in3'),
      wire(voices, 'out', room, 'in'),
      wire(room, 'out', master, 'in1'),
      wire(rhythmMix, 'out', master, 'in2'),
      wire(master, 'out', output, 'in'),
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
  {
    id: 'copper-currents',
    name: 'Copper currents',
    style: 'Dub playground',
    description: 'A laid-back bass groove, rim shots and congas, blended through XY Effects.',
    tryThis: 'Slide the XY point towards Echo or Space; change a corner to reshape the groove.',
    color: '#aa6c50',
    artwork: 'xy',
    create: createCopperProject,
  },
  {
    id: 'clockwork-garden',
    name: 'Clockwork garden',
    style: '23-module ensemble',
    description:
      'Three interlocking melodies, a detuned dual-oscillator lead, and two drum machines at 118 BPM.',
    tryThis:
      'Zoom into the lead row and blend its two oscillators with the Mixer; compare the two echo times.',
    color: '#537863',
    artwork: 'ensemble',
    create: createClockworkProject,
  },
  {
    id: 'moving-parts',
    name: 'Moving parts',
    style: 'Modulation · 13 modules',
    description:
      'A shaped melody and sampled rhythm: Envelope, Mod sequencer, Sample & Hold, and XY controller each move a different part.',
    tryThis:
      'Move the XY pad: left/right opens the sampled claps, up/down changes their speed. Try the eight modulation faders next.',
    color: '#52757a',
    artwork: 'xy',
    create: createMovingPartsProject,
  },
  {
    id: 'neon-chorus',
    name: 'Neon chorus',
    style: 'Pop · 38 modules',
    description:
      'A bright C-major pop arrangement at 116 BPM. The original seventeen instruments, with layered chords, a synth hook and sampled claps.',
    tryThis:
      'Switch: 1 hook, 2 live keys, 3 dry hook, 4 duet. Choose 2 or 4 and play the Keyboard over the backing.',
    color: '#ad627a',
    artwork: 'pop',
    create: createNeonProject,
  },
];
