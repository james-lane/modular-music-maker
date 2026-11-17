import { MODULE_LIST, MODULES } from './modules';
import type { ModuleType, Parameters, PortDefinition } from './types';

export interface GuideEndpoint {
  module: ModuleType;
  port: string;
  /** Optional teaching name identifies another instance of the same module type. */
  instance?: string;
}

export interface GuideConnection {
  from: GuideEndpoint;
  to: GuideEndpoint;
}

export const guideInstance = (endpoint: GuideEndpoint): string =>
  endpoint.instance ?? endpoint.module;

export interface ModuleGuide {
  overview: string;
  steps: string[];
  /** Keys match the registry's numeric control IDs; their labels come from the registry. */
  controls: Record<string, string>;
  extraControls?: { label: string; description: string }[];
  tip: string;
  example: {
    title: string;
    description: string;
    connections: GuideConnection[];
    /** Settings shared by the loadable demo and development fixtures. */
    parameters?: Partial<Record<ModuleType, Parameters>>;
    instanceParameters?: Record<string, Parameters>;
    /** Optional registry-sized rows keep parallel teaching paths easy to follow. */
    rows?: string[][];
    interaction?: 'transport' | 'keyboard' | 'pads';
    instructions?: string;
  };
}

const wire = (
  from: ModuleType,
  output: string,
  to: ModuleType,
  input: string,
  fromInstance?: string,
  toInstance?: string,
): GuideConnection => ({
  from: { module: from, port: output, ...(fromInstance ? { instance: fromInstance } : {}) },
  to: { module: to, port: input, ...(toInstance ? { instance: toInstance } : {}) },
});

/** Keep teaching copy beside the domain. Every new module must supply a guide. */
export const MODULE_GUIDES: Record<ModuleType, ModuleGuide> = {
  'drum-machine': {
    overview:
      'A drum kit with a repeating rhythm. Its four voices default to kick, snare, clap, and closed hat; connect a Drum kit to replace them with built-in sounds, imported samples, or external audio. A Pad controller can play the full sixteen-sound kit.',
    steps: [
      'Connect AUDIO OUT to an Output AUDIO IN socket, or route it through a Mixer or an effect first.',
      'Press Play in the top bar. The sixteen steps follow the composition tempo.',
      'Click a step to switch a hit on or off. Click a voice name to audition that drum.',
    ],
    controls: {
      level: 'Sets the volume of the whole kit.',
      tone: 'Tunes the drum sounds up or down in semitones.',
      decay:
        'For built-in drums and ordinary live inputs, multiplies the envelope length. For imported samples and Mic sampler clips connected directly or through serial effects, shapes the tail fade without shortening playback: 1× or higher preserves the natural tail; lower values fade earlier. Each sampled hit overlaps independently.',
    },
    extraControls: [
      {
        label: 'Pattern on/off',
        description:
          'Enables the repeating pattern. Live drum audition and pad hits still work when Pattern is off.',
      },
    ],
    tip: 'Connect Drum kit KIT OUT to KIT IN to change the four voice sounds. The first four pads follow these assignments; the other twelve retain their printed sounds. Unplug KIT IN to restore the internal kit. To finger-drum without a backing loop, turn Pattern off and connect a Pad controller to TRIGGER IN.',
    example: {
      title: 'Play a beat',
      description: 'Start with this direct connection. Press Play to hear and edit the pattern.',
      connections: [wire('drum-machine', 'out', 'output', 'in')],
    },
  },
  'mic-sampler': {
    overview:
      'A pocket recorder for your voice, claps, and found sounds. Capture up to four seconds from your device microphone, then play the saved snippet through the studio. Recordings stay on this device and travel inside patch exports.',
    steps: [
      'Press Record mic and allow microphone access. Use HTTPS or localhost. Speak, clap, or make a sound; press Finish or let the four-second limit finish the capture.',
      'Connect AUDIO OUT to an effect, Mixer, Merger, or Output AUDIO IN. The microphone is never monitored live.',
      'Press Play snippet to hear a direct dry preview, with studio playback stopped or running. No Output connection is needed. Connect Pad controller ALL to TRIGGER IN to retrigger it from any pad, or a numbered PAD output for one pad.',
    ],
    controls: {
      level: 'Sets the saved snippet’s output volume without changing the recording.',
      trimStart:
        'Sets where the kept section begins, on the original recording’s timeline. Move Start past unwanted silence or noise; it cannot cross End.',
      trimEnd:
        'Sets where the kept section ends. The highlighted waveform section is used for playback, pad hits, and WAV downloads. Trimming preserves the original recording and takes effect on the next hit.',
      rate: 'Changes playback speed and pitch together on the next hit. Half speed is an octave lower and twice as long; double speed is an octave higher and half as long.',
    },
    extraControls: [
      {
        label: 'Record mic / Finish / Cancel',
        description:
          'Only Record mic requests microphone permission. Finish keeps the captured sound; Cancel discards it. Capture stops automatically after four seconds. Replacing a clip keeps the old one until the new capture succeeds. Stop, switching patches, removing the module, and hiding the app cancel capture and release the microphone.',
      },
      {
        label: 'Reset trim / Download WAV',
        description:
          'Reset trim restores the full original recording. Download WAV exports only the kept section at its original speed and level, ready to load into Drum kit. Trim changes save with the patch and support Undo/Redo. A successful new recording resets the selection; a failed/cancelled replacement preserves it.',
      },
      {
        label: 'Play snippet / Clear',
        description:
          'Play snippet restarts a direct dry preview of the selected part each time, using trim, Speed, and Level. It works while the studio is stopped or playing, without cables and even with Output muted. It bypasses patch effects and master volume and is excluded from studio recordings. Pad hits use connected cables. Playback does not follow the transport automatically. Clear removes the saved clip; Undo restores it. Empty modules are silent.',
      },
    ],
    tip: 'SPEED MOD bends pitch and length by up to an octave each way; LEVEL MOD opens 0–100% of Level (negative values mute). These also reach independently triggered Drum kit clips. Dry Play snippet preview bypasses MOD cables. Try a clap through Delay for a homemade percussion hit. All pads trigger the same snippet. To sequence this recording, connect AUDIO OUT to a Drum kit IN socket, optionally through Filter, Delay, Reverb, or XY Effects, select its Audio input voice, and link KIT OUT to Drum machine KIT IN. Each drum hit plays the full trimmed clip independently, with overlaps; no manual sampler playback is needed. Mic capture requires browser permission; saved sounds work offline without microphone access. Headphones keep your backing track out of the recording.',
    example: {
      title: 'Echo a found sound',
      description:
        'Record a clap, then tap any pad to play it through Delay. The top-bar Play button is optional for this live patch.',
      connections: [
        wire('pad-controller', 'trigger', 'mic-sampler', 'trigger'),
        wire('mic-sampler', 'out', 'delay', 'in'),
        wire('delay', 'out', 'output', 'in'),
      ],
    },
  },
  'drum-kit': {
    overview:
      'A four-voice sound cartridge for the Drum machine. Give each voice a built-in percussion sound, an imported audio sample, or a sound patched in from another module. The drum machine keeps the rhythm and produces the final audio.',
    steps: [
      'Connect KIT OUT to Drum machine KIT IN, then Drum machine AUDIO OUT to Output AUDIO IN.',
      'Choose a sound for each numbered voice. The drum machine updates its lane labels while keeping your steps.',
      'For Imported sample, use Load audio. For Audio input, connect a source to the matching numbered input. A Mic sampler connected directly or through serial effects is retriggered from its saved recording on each hit; do not press Play snippet. Other sources use their current live audio. Press Play or click a voice button to audition through the drum machine.',
    ],
    controls: {
      length:
        'Sets the envelope length for ordinary live audio inputs such as Noise. Drum machine Decay multiplies this length. A Mic sampler connected directly or through serial effects supplies its saved clip instead: each hit plays the full selected section independently, using sampler Speed/Level plus drum Tone/Level. Input decay does not gate saved clips; drum Decay fades their tails.',
    },
    extraControls: [
      {
        label: 'Voice sound selectors',
        description:
          'Each of four voices can use any of sixteen built-in percussion sounds, an imported sample, or its corresponding audio input. Voices 1–4 correspond to the original kick, snare, clap, and hat lanes and the first four pads.',
      },
      {
        label: 'Load / Replace / Remove sample',
        description:
          'Choose a short WAV, MP3, M4A, Ogg, WebM, or FLAC, up to four seconds and 20 MB per file. Compressed-format support depends on your browser; if it cannot read the file, convert it to PCM WAV. Unusually large multichannel clips may need converting to mono first. Samples are converted to mono at 24 kHz and embedded in the patch for saving, export, and offline use. A patch holds about sixteen seconds of samples in total. Remove deletes that voice’s stored sample and restores its original sound; switching sound modes retains it for later.',
      },
      {
        label: 'Voice audition buttons',
        description:
          'Play a voice through all connected drum machines without starting the pattern. A silent sample slot or unpatched Audio input is silent. The module has no direct audio output: connect KIT OUT first.',
      },
    ],
    tip: 'Try Noise AUDIO OUT into IN 4 and choose Audio input 4 for a textured hat. Input decay shapes each hit. Kit cables carry voice assignments and external sounds, so they only connect to KIT IN. Browsing this guide is silent.',
    example: {
      title: 'Build a hybrid kit',
      description:
        'Connect the kit and choose Audio input 4 for the fourth voice. Noise becomes a short burst on each hat step; the other voices keep their built-in sounds. Try a sample on voice 2 next. For a recorded snippet, connect a Mic sampler instead of Noise, optionally through serial effects; its full trimmed clip will retrigger and overlap on every hit.',
      connections: [
        wire('noise', 'out', 'drum-kit', 'closed-hat'),
        wire('drum-kit', 'kit', 'drum-machine', 'kit'),
        wire('drum-machine', 'out', 'output', 'in'),
      ],
    },
  },
  keyboard: {
    overview:
      'A 25-, 37-, 49- or 61-key controller for playing melodies. It sends notes and note releases to an Oscillator, which creates the sound.',
    steps: [
      'Connect PITCH / GATE to an Oscillator PITCH input.',
      'Connect the Oscillator AUDIO OUT to an Output AUDIO IN socket.',
      'Tap or hold a piano key, or slide across the keys with a finger, mouse, or pen. Focus the keys to play A W S E D F T G Y H U J K O L P ; on your computer keyboard.',
    ],
    controls: {
      octave:
        'Moves the keyboard up or down by whole octaves. The Oscillator octave setting adds to this.',
      velocity: 'Sets how strongly each note plays the connected oscillator.',
    },
    extraControls: [
      {
        label: 'Keys',
        description:
          'Choose 25, 37, 49 or 61 keys. Extra octaves widen the enclosure without shrinking the keys. Resizing releases held notes and keeps the pitch cable; Undo restores size and any clearance move together.',
      },
      {
        label: 'Piano keys',
        description:
          'Each finger can slide independently between white and black keys. Swiping left/right above or below the keybed still changes notes. Beyond the left or right end, the nearest end key stays held. Lift to release. Cancellation or switching tools also ends the hold. Enter or Space on a focused piano key plays a short note.',
      },
    ],
    tip: 'Choose the bottom-left arrow (Play / edit) to hold notes while using other modules. The hand (Pan / zoom) navigates over instruments without playing or editing them. Live playing works with the transport stopped. Notes are chromatic, and the last held note takes priority on each oscillator.',
    example: {
      title: 'Play your first melody',
      parameters: { keyboard: { keyCount: 37 } },
      description:
        'The pitch cable controls the note; the audio cable carries the sound to your speakers.',
      connections: [
        wire('keyboard', 'pitch', 'oscillator', 'pitch'),
        wire('oscillator', 'out', 'output', 'in'),
      ],
    },
  },
  'pad-controller': {
    overview:
      'Choose 4, 8 or 16 playable pads. Each numbered PAD output fires only its matching pad, so different pads can play different instruments. ALL sends every hit through one cable and keeps older patches working. A Drum machine supplies the printed percussion sounds; its first four pads follow any connected Drum kit assignments. A Mic sampler plays its saved snippet instead.',
    steps: [
      'Choose a pad count. Connect PAD 1 to a Drum machine TRIGGER IN and PAD 2 to a Mic sampler TRIGGER IN, or use ALL to send every pad to one instrument.',
      'Route each instrument’s AUDIO OUT through a Mixer to Output. Trigger cables carry events, not sound.',
      'Tap a pad without pressing Play. Focus the grid to use the shortcuts printed on visible pads; hidden pads do not play.',
    ],
    controls: {
      velocity: 'Sets the strength of each pad hit. Lower values give a softer performance.',
    },
    extraControls: [
      {
        label: 'Pad count and numbered outputs',
        description:
          '4, 8 or 16 pads resize the enclosure and its shared bottom socket row. Reducing the count unplugs removed outputs; one Undo restores the count, position and cables. If a wider enclosure needs room, only the controller moves. Every PAD socket can fan out to multiple compatible instruments.',
      },
    ],
    tip: 'Use a numbered output to retrigger a Mic sampler, Envelope or Sample & Hold independently. ALL still fires alongside numbered outputs. Turn the Drum machine’s Pattern off to hear only live hits.',
    example: {
      title: 'Two pads, two instruments',
      description:
        'Pad 1 plays a kick; pad 2 plays the bundled clap through a separate sampler. The other pads stay unpatched.',
      parameters: { 'pad-controller': { padCount: 4 }, 'drum-machine': { enabled: false } },
      connections: [
        wire('pad-controller', 'pad1', 'drum-machine', 'trigger'),
        wire('pad-controller', 'pad2', 'mic-sampler', 'trigger'),
        wire('drum-machine', 'out', 'mixer', 'a'),
        wire('mic-sampler', 'out', 'mixer', 'b'),
        wire('mixer', 'out', 'output', 'in'),
      ],
    },
  },
  sequencer: {
    overview:
      'An eight-step melody that repeats in time with the composition. It tells an Oscillator which notes to play.',
    steps: [
      'Connect PITCH to an Oscillator PITCH input, then route the Oscillator AUDIO OUT to Output AUDIO IN.',
      'Choose a Step rate and press Play. Each button lasts a quarter, eighth, or sixteenth note; the default is an eighth note.',
      'Tap a step to advance its note, or press and swipe up/down to raise/lower it. Right-click makes a rest. Change the composition key and scale in the top bar.',
    ],
    controls: {
      gate: 'Sets how long each note lasts within its step. Short gates make a more clipped rhythm.',
    },
    extraControls: [
      {
        label: 'Step rate',
        description:
          'Choose 1/4, 1/8, or 1/16 for the length of each step. Each sequencer has its own rate, synced to the composition tempo. Changes join the transport grid without restarting playback. Gate sets the sounding portion of that step.',
      },
      {
        label: 'Note buttons',
        description:
          'Tap to cycle through scale degrees across two octaves. Swipe up/down or use arrow keys to adjust without wrapping; a rest sits below the lowest note. Hold Shift for finer dragging. A dash is a rest; the lit step follows playback.',
      },
    ],
    tip: 'A pitch cable needs an Oscillator to turn the notes into sound. Each oscillator pitch input accepts one controller at a time.',
    example: {
      title: 'Make a repeating melody',
      description: 'Set the notes here and shape their sound on the Oscillator.',
      connections: [
        wire('sequencer', 'pitch', 'oscillator', 'pitch'),
        wire('oscillator', 'out', 'output', 'in'),
      ],
    },
  },
  oscillator: {
    overview:
      'The starting point for a synthesized tone. Choose a waveform, tune it, then send its audio to effects or an Output.',
    steps: [
      'Connect AUDIO OUT to Output AUDIO IN and press Play to hear a sustained root note.',
      'Choose a waveform to change the tone, then adjust Octave, Fine tune, and Level.',
      'Connect a Keyboard or Step sequencer to PITCH to play notes instead of a sustained tone.',
    ],
    controls: {
      octave: 'Changes the pitch in whole octaves.',
      detune:
        'Makes small pitch adjustments in cents for tuning or a slight beating effect with another oscillator.',
      level: 'Sets the loudness sent through AUDIO OUT.',
    },
    extraControls: [
      {
        label: 'PITCH MOD',
        description:
          'Adds bounded pitch bend independently of PITCH notes and Fine tune. A full-scale control signal bends up to one octave; a zero signal preserves the original note.',
      },
      {
        label: 'Waveform buttons',
        description:
          'Sine is smooth, triangle is mellow, sawtooth is bright, and square is hollow and buzzy.',
      },
    ],
    tip: 'Try routing it through a Filter to soften a bright waveform. A connected Keyboard is silent until you play a key.',
    example: {
      title: 'Shape a warm synth tone',
      description: 'Start with a sawtooth waveform, then lower the Filter cutoff.',
      connections: [
        wire('oscillator', 'out', 'filter', 'in'),
        wire('filter', 'out', 'output', 'in'),
      ],
    },
  },
  noise: {
    overview:
      'A continuous wash of random sound. Use it for texture, hiss, wind-like effects, or layering with other sources.',
    steps: [
      'Connect AUDIO OUT to a Filter AUDIO IN socket.',
      'Connect the Filter AUDIO OUT to Output AUDIO IN, then press Play.',
      'Start with a low Noise Level and move the Filter cutoff to shape the texture.',
    ],
    controls: {
      level:
        'Sets the volume of the noise source. Raise it gradually when layering with other sounds.',
    },
    tip: 'Send it through Reverb for a spacious wash, or use a Mixer to blend it with an Oscillator.',
    example: {
      title: 'Make a textured atmosphere',
      description: 'Filter the noise before adding space with Reverb.',
      connections: [
        wire('noise', 'out', 'filter', 'in'),
        wire('filter', 'out', 'reverb', 'in'),
        wire('reverb', 'out', 'output', 'in'),
      ],
    },
  },
  envelope: {
    overview:
      'An attack/hold/release control envelope. Notes hold its peak until release; a pad or Trigger envelope button plays one attack/release sweep. It produces control data, not sound.',
    steps: [
      'Connect MOD OUT to Filter MOD, Oscillator PITCH MOD, or Mic sampler LEVEL MOD.',
      'Connect Keyboard PITCH / GATE or Step sequencer PITCH to NOTE / GATE. For one-shot sweeps, connect Pad controller PAD 1 (or ALL) to TRIGGER IN.',
      'Set Attack, Release and Depth, then play a note or press Trigger envelope.',
    ],
    controls: {
      attack: 'Time to rise from the current value to the peak.',
      release: 'Time to return to zero after note release or the one-shot peak.',
      depth:
        'Peak amount. 100% is 1500 Hz at Filter MOD, one octave at pitch/speed inputs, or full sampler Level at LEVEL MOD. Velocity scales the peak.',
    },
    extraControls: [
      {
        label: 'Trigger envelope',
        description:
          'Auditions a one-shot control sweep without starting the transport. A connected audio source and Output are needed to hear the change.',
      },
    ],
    tip: 'For a plucked filter sound, use a short Attack and longer Release. NOTE / GATE and TRIGGER IN share one envelope; simultaneous events retrigger it from its current value.',
    example: {
      title: 'Play a filter envelope',
      description:
        'The Keyboard sends notes to both the Oscillator and Envelope. The second cable shapes the Filter without changing note pitch.',
      connections: [
        wire('keyboard', 'pitch', 'oscillator', 'pitch'),
        wire('keyboard', 'pitch', 'envelope', 'gate'),
        wire('envelope', 'out', 'filter', 'cutoff'),
        wire('oscillator', 'out', 'filter', 'in'),
        wire('filter', 'out', 'output', 'in'),
      ],
    },
  },
  'mod-sequencer': {
    overview:
      'Eight bipolar control values repeat at the project tempo. This is a modulation pattern; the Step sequencer remains the separate note and gate instrument.',
    steps: [
      'Connect MOD OUT to a MOD input, then press Play.',
      'Move the eight faders above or below zero to draw a repeating control pattern.',
      'Choose a step rate; adjust Depth and Glide for strong steps or smooth movement.',
    ],
    controls: {
      ...Object.fromEntries(
        Array.from({ length: 8 }, (_, index) => [
          `step${index + 1}`,
          `Signed value for step ${index + 1}, from −1 to +1. Zero leaves the destination at its base setting.`,
        ]),
      ),
      depth:
        'Scales the pattern. At 100%, ±1 means ±1500 Hz for Filter MOD or ±one octave for pitch/speed MOD. Sampler LEVEL MOD clamps values to 0–100% of Level.',
      glide: 'Smoothing time for changes between steps. Zero retains a tiny click-prevention ramp.',
    },
    extraControls: [
      {
        label: 'Step rate',
        description:
          'Quarter, eighth, or sixteenth notes on the shared audio clock. Changes join the existing transport grid; Stop clears the held value and Play restarts at step 1.',
      },
    ],
    tip: 'Keep the note sequencer for melody and use this module for a repeating filter or pitch contour. It never emits notes, triggers, or audio.',
    example: {
      title: 'A stepped filter groove',
      description: 'A sustained Oscillator is sculpted by an independent modulation pattern.',
      connections: [
        wire('mod-sequencer', 'out', 'filter', 'cutoff'),
        wire('oscillator', 'out', 'filter', 'in'),
        wire('filter', 'out', 'output', 'in'),
      ],
    },
  },
  'random-mod': {
    overview:
      'Sample & Hold chooses a random bipolar control value and holds it until the next clock step or pad hit. Glide softens the transitions. It does not sample or store microphone audio.',
    steps: [
      'Connect MOD OUT to a MOD input.',
      'Press Play for tempo-synced random changes. A cable at TRIGGER IN replaces that clock with pad hits.',
      'Try New random value while stopped, then set Depth and Glide.',
    ],
    controls: {
      depth:
        'Scales random values within ±1500 Hz at Filter MOD or ±one octave at pitch/speed MOD when at 100%. Sampler level is always bounded to 0–100% of its Level.',
      glide:
        'Smoothing time toward the next random value. Higher settings wander rather than jump.',
    },
    extraControls: [
      {
        label: 'Step rate',
        description:
          'Quarter, eighth or sixteenth-note random updates while transport runs, unless TRIGGER IN is patched.',
      },
      {
        label: 'New random value',
        description:
          'Chooses one new value without starting transport. The value is ephemeral; reload starts at zero.',
      },
    ],
    tip: 'Unlike the LFO, values do not follow a repeating wave. Unlike Mic sampler, this module captures no sound and requests no device permission.',
    example: {
      title: 'Three kinds of controlled randomness',
      description:
        'Press Play, then compare Switch 1 for rhythmic filter changes, 2 for a gently drifting pitch, and 3 for sampled-clap variation when you tap pad 1. Switch 4 is the dry tone. The three rows each have their own Sample & Hold: try Depth at zero to hear its contribution, or raise Glide to soften the changes. The pad row changes only when you hit pad 1.',
      interaction: 'transport',
      instructions:
        'Press Play. Switch 1: random filter rhythm; 2: gentle pitch drift; 3: tap pad 1 for varied claps; 4: dry reference. Try Depth and Glide in each row.',
      parameters: {
        oscillator: { waveform: 'sawtooth', level: 0.18 },
        filter: { cutoff: 900, resonance: 6 },
        'pad-controller': { padCount: 4 },
        'mic-sampler': { level: 0.45 },
        switch: { automatic: false, selected: 1 },
      },
      instanceParameters: {
        'Filter rhythm': { rate: '1/8', depth: 0.45, glide: 0.005 },
        'Pitch drift': { rate: '1/4', depth: 0.02, glide: 0.15 },
        'Pad variation': { depth: 0.25, glide: 0 },
      },
      rows: [
        ['Filter tone', 'Filter rhythm', 'filter', 'switch', 'output'],
        ['Pitch drift', 'Drifting tone'],
        ['pad-controller', 'Pad variation', 'mic-sampler'],
      ],
      connections: [
        wire('random-mod', 'out', 'filter', 'cutoff', 'Filter rhythm'),
        wire('oscillator', 'out', 'filter', 'in', 'Filter tone'),
        wire('random-mod', 'out', 'oscillator', 'pitchMod', 'Pitch drift', 'Drifting tone'),
        wire('pad-controller', 'pad1', 'random-mod', 'trigger', undefined, 'Pad variation'),
        wire('random-mod', 'out', 'mic-sampler', 'rateMod', 'Pad variation'),
        wire('pad-controller', 'pad1', 'mic-sampler', 'trigger'),
        wire('filter', 'out', 'switch', 'in1'),
        wire('oscillator', 'out', 'switch', 'in2', 'Drifting tone'),
        wire('mic-sampler', 'out', 'switch', 'in3'),
        wire('oscillator', 'out', 'switch', 'in4', 'Filter tone'),
        wire('switch', 'out', 'output', 'in'),
      ],
    },
  },
  'xy-controller': {
    overview:
      'A hands-on two-axis controller with independent X MOD and Y MOD outputs. It sends no audio and applies no built-in effects; XY Effects remains the separate audio processor.',
    steps: [
      'Connect X MOD and/or Y MOD to control inputs on other modules.',
      'Slide the pad, use its arrow keys, or adjust the accessible X/Y sliders.',
      'Set Depth to control the range. Centre returns both axes to zero.',
    ],
    controls: {
      x: 'Horizontal position from −1 (left) to +1 (right).',
      y: 'Vertical position from −1 (bottom) to +1 (top).',
      depth:
        'Shared scale for both outputs. 100% spans ±1500 Hz at Filter MOD or ±one octave at pitch/speed MOD. Sampler level clamps to 0–100% of Level.',
    },
    extraControls: [
      {
        label: 'Pad and Centre',
        description:
          'Position stays on release and saves with the patch. Arrow keys move; Shift is finer; Home or Centre resets both axes. X and Y remain independent and can fan out.',
      },
    ],
    tip: 'Try X for filter colour and Y for oscillator pitch. Centre is zero modulation, not muted audio. This controller does not replace the audio effects console.',
    example: {
      title: 'Two-axis tone and pitch',
      parameters: { 'xy-controller': { x: 0.45, y: -0.04 } },
      description: 'X moves the Filter while Y bends the Oscillator pitch.',
      connections: [
        wire('xy-controller', 'x', 'filter', 'cutoff'),
        wire('xy-controller', 'y', 'oscillator', 'pitchMod'),
        wire('oscillator', 'out', 'filter', 'in'),
        wire('filter', 'out', 'output', 'in'),
      ],
    },
  },
  lfo: {
    overview:
      'A slow modulation wave that moves another module’s setting over time. It controls Filter cutoff, Oscillator pitch, or Mic sampler speed/level through their MOD sockets.',
    steps: [
      'Build an audio path: Oscillator AUDIO OUT to Filter AUDIO IN, then Filter AUDIO OUT to Output AUDIO IN.',
      'Connect LFO MOD OUT to Filter MOD.',
      'Press Play and adjust Rate and Depth to hear the filter open and close.',
    ],
    controls: {
      rate: 'Controls how fast the modulation repeats, in cycles per second (Hz).',
      depth: 'Sets how far the Filter cutoff moves, in Hz. Smaller values make a subtler change.',
    },
    extraControls: [
      {
        label: 'Display',
        description:
          'While stopped, a two-second preview responds to Rate and Depth without starting audio. During playback it shows measured MOD output history. Zero Depth is flat; no decorative caption covers the trace.',
      },
    ],
    tip: 'The LFO changes a setting rather than producing your main audio. You still need a sound source in the Filter audio path.',
    example: {
      title: 'Give a sustained tone movement',
      description: 'Audio and modulation use separate cables into the same Filter.',
      connections: [
        wire('oscillator', 'out', 'filter', 'in'),
        wire('lfo', 'out', 'filter', 'cutoff'),
        wire('filter', 'out', 'output', 'in'),
      ],
    },
  },
  filter: {
    overview:
      'Shapes a sound by letting some frequencies through and reducing others. Use it to soften, brighten, or narrow a sound.',
    steps: [
      'Connect a sound source AUDIO OUT to AUDIO IN, then connect AUDIO OUT to Output AUDIO IN.',
      'Press Play and move Cutoff while listening to the sound change.',
      'Choose Low pass, High pass, or Band. Add an LFO to MOD for automatic movement.',
    ],
    controls: {
      cutoff:
        'Sets the frequency where the filter focuses its action. Low pass keeps lower frequencies; high pass keeps higher ones.',
      resonance:
        'Emphasizes frequencies around the cutoff point. Higher settings give a more pronounced peak.',
    },
    extraControls: [
      {
        label: 'Response display',
        description:
          'Shows the filter’s frequency response on a fixed logarithmic frequency scale. Cutoff, Resonance and mode update the curve even while stopped. During playback it also follows the connected MOD signal; reduced motion uses the base control response. This is a response curve, not an audio waveform.',
      },
      {
        label: 'Filter mode',
        description:
          'Low pass softens highs, High pass removes lows, and Band keeps a narrower region around Cutoff.',
      },
    ],
    tip: 'If the sound disappears, check the filter mode and cutoff. A very low low-pass cutoff can remove most of a bright sound.',
    example: {
      title: 'Sweep a synth tone',
      description: 'Use the LFO to animate the cutoff while audio flows through the Filter.',
      connections: [
        wire('oscillator', 'out', 'filter', 'in'),
        wire('lfo', 'out', 'filter', 'cutoff'),
        wire('filter', 'out', 'output', 'in'),
      ],
    },
  },
  delay: {
    overview:
      'Adds repeating echoes to anything patched into it. Turn a short sound into a rhythmic trail or add space to a melody.',
    steps: [
      'Connect a sound source AUDIO OUT to AUDIO IN.',
      'Connect AUDIO OUT to Output AUDIO IN and press Play.',
      'Adjust Time for echo spacing, Feedback for repeats, and Mix for the balance.',
    ],
    controls: {
      time: 'Sets the space between echoes in seconds. It is adjusted manually, independently of tempo.',
      feedback: 'Sends some echo back into the delay to create more repeats.',
      mix: 'Blends the original dry signal with the echoes. Zero is dry; full Mix is the delayed sound.',
    },
    extraControls: [
      {
        label: 'Echo display',
        description:
          'The millisecond readout follows Time. The four-second impulse preview shows dry sound at the start and repeated echoes: Time changes spacing, Feedback changes later echo heights, and Mix balances dry/wet amplitudes. It previews the controls rather than monitoring incoming audio.',
      },
    ],
    tip: 'Try short Time and low Mix for a subtle doubling effect. The Feedback knob creates repeats without needing a cable loop.',
    example: {
      title: 'Add echoes to a beat',
      description: 'Start with a modest Mix so the original drum hits remain clear.',
      connections: [
        wire('drum-machine', 'out', 'delay', 'in'),
        wire('delay', 'out', 'output', 'in'),
      ],
    },
  },
  reverb: {
    overview:
      'Adds a decaying sense of space, from a little ambience to a distant wash. It processes the sound connected to AUDIO IN.',
    steps: [
      'Connect an instrument or effect AUDIO OUT to AUDIO IN.',
      'Connect AUDIO OUT to Output AUDIO IN.',
      'Press Play and turn Mix up gradually to move the sound into a larger space.',
    ],
    controls: {
      mix: 'Balances the original sound and the reverberated sound. Higher values make it more spacious and less direct.',
    },
    tip: 'Reverb works well after Delay. Keep Mix lower when you want the original rhythm or melody to stay distinct.',
    example: {
      title: 'Give a melody some room',
      description: 'Play the Keyboard while its Oscillator is sent through Reverb.',
      connections: [
        wire('keyboard', 'pitch', 'oscillator', 'pitch'),
        wire('oscillator', 'out', 'reverb', 'in'),
        wire('reverb', 'out', 'output', 'in'),
      ],
    },
  },
  'xy-effects': {
    overview:
      'A touch effects console that blends four assignable corners. Slide a point around the pad to reshape incoming audio. The centre is clean; moving outward increases the effect up to the Mix setting. Release to leave the point where you put it.',
    steps: [
      'Connect an instrument AUDIO OUT to AUDIO IN, then XY Effects AUDIO OUT to Output AUDIO IN.',
      'Play the source, then tap or slide on the pad. Start near the centre and explore the four corners.',
      'Choose a sound for each corner using its selector. Any effect can occupy any number of corners. Choices and position save with your patch.',
    ],
    controls: {
      x: 'Horizontal position, from −1 at the left to +1 at the right. The X slider is an accessible alternative to dragging.',
      y: 'Vertical position, from −1 at the bottom to +1 at the top. The Y slider is an accessible alternative to dragging.',
      mix: 'Maximum processed amount at the pad edges. Zero is clean everywhere; the centre remains clean at any Mix setting.',
    },
    extraControls: [
      {
        label: 'Corner effect selectors',
        description:
          'Defaults are Filter (top left), Echo (top right), Grit (bottom left), and Space (bottom right). Each corner can choose Filter (warm low-pass), Echo (repeating delay), Grit (soft distortion), Space (reverb), Thin (high-pass), or Clean (unprocessed audio). Effects blend smoothly across quadrant boundaries; they do not switch abruptly.',
      },
      {
        label: 'XY pad / Centre',
        description:
          'Tap anywhere or drag the point with a finger, mouse, or pen. Focus the pad and use arrow keys; hold Shift for smaller movements. Home or Centre returns to the clean centre. The point stays after release, and a workspace pinch cancels the drag.',
      },
    ],
    tip: 'Try the Drum machine through the default corners: Filter softens the beat, Grit roughens it, and Echo/Space add tails. Set two corners to the same effect to give it a wider region. The module processes audio; a Keyboard must reach it through an Oscillator.',
    example: {
      title: 'A beat you can reshape',
      parameters: { 'xy-effects': { x: 0.45, y: 0.35 } },
      description:
        'Press Play, set Mix to taste, and slide from the clean centre towards each corner. Change a corner to Thin for a lighter beat.',
      connections: [
        wire('drum-machine', 'out', 'xy-effects', 'in'),
        wire('xy-effects', 'out', 'output', 'in'),
      ],
    },
  },
  mixer: {
    overview:
      'Combines 2–8 audio signals into one output, with a separate fader for each input. Use it to balance instruments or blend effects with dry sounds.',
    steps: [
      'Choose 2–8 Inputs, then connect a source AUDIO OUT to each input you want to use.',
      'Connect AUDIO OUT to Output AUDIO IN, or send the mix through an effect.',
      'Press Play and drag the channel faders up or down to balance the sources. A drag keeps following your finger outside the fader until you lift. Arrow keys also adjust a focused fader.',
    ],
    controls: {
      a: 'Sets the gain of the signal connected to IN A.',
      b: 'Sets the gain of the signal connected to IN B.',
      c: 'Sets IN C gain when at least 3 inputs are selected.',
      d: 'Sets IN D gain when at least 4 inputs are selected.',
      e: 'Sets IN E gain when at least 5 inputs are selected.',
      f: 'Sets IN F gain when at least 6 inputs are selected.',
      g: 'Sets IN G gain when at least 7 inputs are selected.',
      h: 'Sets IN H gain when 8 inputs are selected.',
    },
    extraControls: [
      {
        label: 'Inputs',
        description:
          'Choose 2–8 channels. Reducing the count unplugs removed input cables; Undo restores the count, position and cables. Fader settings are kept for re-expansion.',
      },
    ],
    tip: 'Each input accepts one audio cable. The enclosure widens for extra channels and moves only if it needs room. Existing A/B patches keep their balance.',
    example: {
      title: 'Blend a beat, a synth and a little noise',
      description: 'Three separate channel faders balance the instruments before Output.',
      parameters: { mixer: { inputCount: 3 }, noise: { level: 0.035 } },
      connections: [
        wire('drum-machine', 'out', 'mixer', 'a'),
        wire('oscillator', 'out', 'mixer', 'b'),
        wire('noise', 'out', 'mixer', 'c'),
        wire('mixer', 'out', 'output', 'in'),
      ],
    },
  },
  merger: {
    overview:
      'Sums up to four audio signals into one output. Combine instruments, parallel effects, or submixes before an Output or another effect.',
    steps: [
      'Connect instrument or effect audio outputs to IN 1, IN 2, IN 3, or IN 4. Each input takes one cable; unused inputs stay silent.',
      'Connect SUM OUT to Output AUDIO IN, or route it through an effect first.',
      'Press Play or play a connected live instrument. Each knob sits above its matching socket: Input 1–4 set individual levels; Sum level above SUM OUT sets the combined volume.',
    ],
    controls: {
      in1: 'Sets the level of IN 1 before summing. Starts at 100%; zero mutes only this input without unplugging its cable.',
      in2: 'Sets the level of IN 2 before summing, independently of the other inputs. Starts at 100%; zero mutes this input.',
      in3: 'Sets the level of IN 3 before summing, independently of the other inputs. Starts at 100%; zero mutes this input.',
      in4: 'Sets the level of IN 4 before summing, independently of the other inputs. Starts at 100%; zero mutes this input.',
      level:
        'Sets the gain of the whole sum. It starts at 50% to leave room for several sources. Zero silences the output; it does not erase your cables.',
    },
    extraControls: [
      {
        label: 'Input indicators',
        description:
          'Shows which inputs have cables attached. The amber indicators mean wired, rather than measuring audio level.',
      },
    ],
    tip: 'Adding inputs can make the sum louder. Balance them with Input 1–4, then lower Sum level if needed. Connect SUM OUT to another Merger input when you need more than four sources. Pitch, modulation, and trigger cables need their own compatible modules.',
    example: {
      title: 'Combine a band and an echo return',
      parameters: { merger: { in3: 0.2, in4: 0.45 }, delay: { mix: 1 } },
      description:
        'Blend a synth, drums, filtered noise, and an echoed copy of the synth. Lower Merger Input 3 for subtle noise and Input 4 to balance the echoes; set Delay Mix to 100% for an echo-only return.',
      connections: [
        wire('oscillator', 'out', 'merger', 'in1'),
        wire('drum-machine', 'out', 'merger', 'in2'),
        wire('noise', 'out', 'filter', 'in'),
        wire('filter', 'out', 'merger', 'in3'),
        wire('oscillator', 'out', 'delay', 'in'),
        wire('delay', 'out', 'merger', 'in4'),
        wire('merger', 'out', 'output', 'in'),
      ],
    },
  },
  switch: {
    overview:
      'Routes one of four audio inputs to a single output. Select inputs by hand or arrange bar-start cues to change song sections automatically, once or in a repeating pattern.',
    steps: [
      'Connect instrument or effect audio outputs to IN 1–4, then connect AUDIO OUT to an effect, a Mixer, a Merger, or Output.',
      'Open Schedule, choose an input at bar 1, then add the later bar-start changes. Choose whether the pattern repeats and how many bars it lasts. Use schedule enables Auto without starting playback.',
      'Press Play. The lit key shows the current routed input. Tap a numbered key to take manual control; use Auto to rejoin the current bar. Selecting an unpatched input gives silence.',
    ],
    controls: {
      selected:
        'Keys 1–4 take manual control of one input and turn Auto off. Changes crossfade briefly to reduce clicks; sources and effect tails keep running. Manual selection and schedule edits support Undo/Redo; automatic playback never changes saved selection or adds history entries.',
    },
    extraControls: [
      {
        label: 'Schedule / Auto',
        description:
          'Store up to 16 cues at bars 1–128, with one input per bar. A bar 1 cue chooses the starting sound. Repeat length must include all cues; without Repeat, the final input stays selected. Stop clears queued changes and the next Play starts at bar 1. Applying edits while playing takes effect at the current position.',
      },
    ],
    tip: 'The schedule follows project tempo and time signature: 4/4 bars contain four quarter notes; 3/4 and 6/8 contain three quarter notes. Inputs are audio only. Upstream loops keep their own place when you switch between them.',
    example: {
      title: 'Alternate rhythm and melody',
      description:
        'Press Play: bar 1 routes the drums, bar 2 routes the sequenced melody, then the two-bar pattern repeats. Open Schedule to arrange longer parts. Keys 3 and 4 are unpatched and silent.',
      parameters: { switch: { automatic: true } },
      connections: [
        wire('drum-machine', 'out', 'switch', 'in1'),
        wire('sequencer', 'pitch', 'oscillator', 'pitch'),
        wire('oscillator', 'out', 'switch', 'in2'),
        wire('switch', 'out', 'output', 'in'),
      ],
    },
  },
  output: {
    overview:
      'The final stop for your patch. Audio connected here reaches your speakers and the recorder; its screen shows the live waveform.',
    steps: [
      'Connect an instrument, effect, Mixer, or Merger audio output to AUDIO IN.',
      'Press Play, or play a connected live Keyboard or Pad controller.',
      'Adjust Output level and the top-bar master volume. Use Record to capture the routed sound.',
    ],
    controls: { level: 'Sets the gain of the final signal before the studio’s master volume.' },
    extraControls: [
      {
        label: 'Scope and meters',
        description: 'Show the actual signal arriving at the output while audio is active.',
      },
    ],
    tip: 'There is one Output per patch and one cable per input. Combine multiple instruments in a Mixer or Merger before connecting them here.',
    example: {
      title: 'Hear two instruments together',
      description: 'The Mixer combines the sources so they can share a single Output input.',
      connections: [
        wire('drum-machine', 'out', 'mixer', 'a'),
        wire('oscillator', 'out', 'mixer', 'b'),
        wire('mixer', 'out', 'output', 'in'),
      ],
    },
  },
};

export interface CompatiblePort {
  module: ModuleType;
  port: PortDefinition;
}

/** Derive potential partners from the same directions and signal types used for wiring.
 * This describes module capabilities; a particular workspace input may already be occupied.
 */
export function compatiblePorts(type: ModuleType, portId: string): CompatiblePort[] {
  const socket = MODULES[type].ports.find((port) => port.id === portId);
  if (!socket) return [];
  return MODULE_LIST.filter((module) => module.type !== type).flatMap((module) =>
    module.ports
      .filter((port) => port.direction !== socket.direction && port.signal === socket.signal)
      .map((port) => ({ module: module.type, port })),
  );
}
