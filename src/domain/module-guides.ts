import { MODULE_LIST, MODULES } from './modules';
import type { ModuleType, PortDefinition } from './types';

export interface GuideConnection {
  from: { module: ModuleType; port: string };
  to: { module: ModuleType; port: string };
}

export interface ModuleGuide {
  overview: string;
  steps: string[];
  /** Keys match the registry's numeric control IDs; their labels come from the registry. */
  controls: Record<string, string>;
  extraControls?: { label: string; description: string }[];
  tip: string;
  example: { title: string; description: string; connections: GuideConnection[] };
}

const wire = (
  from: ModuleType,
  output: string,
  to: ModuleType,
  input: string,
): GuideConnection => ({
  from: { module: from, port: output },
  to: { module: to, port: input },
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
        'Makes the drum sounds shorter or longer. The value multiplies each sound’s natural decay.',
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
      'Press Play snippet to hear it, even with the transport stopped. Connect Pad controller TRIGGER OUT to TRIGGER IN to retrigger it from any pad.',
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
          'Play the selected part once through connected cables; each hit restarts it. Playback does not follow the transport automatically. Clear removes the saved clip; Undo restores it. Empty modules are silent.',
      },
    ],
    tip: 'Try a clap through Delay for a homemade percussion hit. All pads trigger the same snippet. To sequence a recording as a drum voice, download the clip as WAV and load it into a Drum kit sample slot. Mic capture requires browser permission; saved sounds work offline without microphone access. Headphones keep your backing track out of the recording.',
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
      'For Imported sample, use Load audio. For Audio input, connect an audio source to the matching numbered input. Press Play or click a voice button to audition through the drum machine.',
    ],
    controls: {
      length:
        'Sets the envelope length for audio inputs. The drum machine Decay multiplies this length; its Level also applies. Tone tunes built-in sounds and samples, but does not transpose live audio inputs.',
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
          'Choose browser-supported audio such as WAV or MP3, up to four seconds and 20 MB per file. Samples are converted to mono at 24 kHz and embedded in the patch for saving, export, and offline use. A patch holds about sixteen seconds of samples in total. Remove deletes that voice’s stored sample and restores its original sound; switching sound modes retains it for later.',
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
        'Connect the kit and choose Audio input 4 for the fourth voice. Noise becomes a short burst on each hat step; the other voices keep their built-in sounds. Try a sample on voice 2 next.',
      connections: [
        wire('noise', 'out', 'drum-kit', 'closed-hat'),
        wire('drum-kit', 'kit', 'drum-machine', 'kit'),
        wire('drum-machine', 'out', 'output', 'in'),
      ],
    },
  },
  keyboard: {
    overview:
      'A two-octave controller for playing melodies. It sends notes and note releases to an Oscillator, which creates the sound.',
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
        label: 'Piano keys',
        description:
          'Each finger can slide independently between white and black keys. Moving outside the keybed releases its note; sliding back plays again. Release to end the note. Enter or Space on a focused piano key plays a short note.',
      },
    ],
    tip: 'Live playing works with the transport stopped. Notes are chromatic, and the last held note takes priority on each oscillator.',
    example: {
      title: 'Play your first melody',
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
      'Sixteen playable pads for the Drum machine’s percussion sounds. The first four pads follow a connected Drum kit’s voice assignments; the remaining pads keep their printed sounds. Its trigger cable carries the sound choice and velocity to the drum machine. Connect a Mic sampler instead to play its recorded snippet from every pad.',
    steps: [
      'Connect TRIGGER OUT to a Drum machine TRIGGER IN socket.',
      'Connect the Drum machine AUDIO OUT to an Output AUDIO IN socket.',
      'Click or tap a pad. Focus the pad grid to use 1 2 3 4 / Q W E R / A S D F / Z X C V.',
    ],
    controls: {
      velocity: 'Sets the strength of each pad hit. Lower values give a softer performance.',
    },
    extraControls: [
      {
        label: 'Sixteen pads',
        description:
          'Trigger kick, snare, clap, hats, toms, rim, shaker, crash, ride, cowbell, tambourine, claves, and congas. Shortcuts are printed on the pads.',
      },
    ],
    tip: 'Pads work without pressing Play. Turn the Drum machine’s Pattern off if you want to hear only your live hits.',
    example: {
      title: 'Build a playable drum kit',
      description: 'The controller selects each hit, while the Drum machine supplies the audio.',
      connections: [
        wire('pad-controller', 'trigger', 'drum-machine', 'trigger'),
        wire('drum-machine', 'out', 'output', 'in'),
      ],
    },
  },
  sequencer: {
    overview:
      'An eight-step melody that repeats in time with the composition. It tells an Oscillator which notes to play.',
    steps: [
      'Connect PITCH to an Oscillator PITCH input, then route the Oscillator AUDIO OUT to Output AUDIO IN.',
      'Press Play. Each button is one eighth-note in the repeating pattern.',
      'Tap a step to advance its note, or press and swipe up/down to raise/lower it. Right-click makes a rest. Change the composition key and scale in the top bar.',
    ],
    controls: {
      gate: 'Sets how long each note lasts within its step. Short gates make a more clipped rhythm.',
    },
    extraControls: [
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
  lfo: {
    overview:
      'A slow modulation wave that moves another module’s setting over time. It currently controls the Filter’s cutoff through its MOD socket.',
    steps: [
      'Build an audio path: Oscillator AUDIO OUT to Filter AUDIO IN, then Filter AUDIO OUT to Output AUDIO IN.',
      'Connect LFO MOD OUT to Filter MOD.',
      'Press Play and adjust Rate and Depth to hear the filter open and close.',
    ],
    controls: {
      rate: 'Controls how fast the modulation repeats, in cycles per second (Hz).',
      depth: 'Sets how far the Filter cutoff moves, in Hz. Smaller values make a subtler change.',
    },
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
      'Combines two audio signals into one output. Use it to balance instruments or blend an effect with a dry sound.',
    steps: [
      'Connect one source AUDIO OUT to IN A and another to IN B.',
      'Connect AUDIO OUT to Output AUDIO IN, or send the mix through an effect.',
      'Press Play and drag the channel faders up or down to balance the sources. Arrow keys also adjust a focused fader.',
    ],
    controls: {
      a: 'Sets the gain of the signal connected to IN A.',
      b: 'Sets the gain of the signal connected to IN B.',
    },
    tip: 'Each input accepts one cable. Use a Merger for up to four sources, or chain Mixers when you need separate channel faders.',
    example: {
      title: 'Blend a beat and a synth',
      description: 'Balance the two instruments before sending them to the speakers.',
      connections: [
        wire('drum-machine', 'out', 'mixer', 'a'),
        wire('oscillator', 'out', 'mixer', 'b'),
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
      'Press Play or play a connected live instrument. Adjust Sum level to set the combined volume.',
    ],
    controls: {
      level:
        'Sets the gain of the whole sum. It starts at 50% to leave room for several sources. Zero silences the output; it does not erase your cables.',
    },
    extraControls: [
      {
        label: 'Routing plate',
        description:
          'Shows which inputs have cables attached. The amber indicators mean wired, rather than measuring audio level.',
      },
    ],
    tip: 'Adding inputs can make the sum louder. Balance instruments at their source, or use a Mixer for individual faders. Connect SUM OUT to another Merger input when you need more than four sources. Pitch, modulation, and trigger cables need their own compatible modules.',
    example: {
      title: 'Combine a band and an echo return',
      description:
        'Blend a synth, drums, filtered noise, and an echoed copy of the synth. Lower Noise level for a subtle texture, and set Delay Mix to 100% for an echo-only return.',
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
