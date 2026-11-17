import type { SignalType } from '../domain/types';

/** Keep the beginner glossary complete when a new socket signal is introduced. */
const PORT_GUIDE: Record<SignalType, { name: string; meaning: string; example: string }> = {
  audio: {
    name: 'AUDIO — the sound',
    meaning:
      'Carries the actual sound between instruments, effects, mixers and Output. This is the signal you hear and record.',
    example: 'Oscillator AUDIO OUT → Filter AUDIO IN → Output AUDIO IN.',
  },
  pitch: {
    name: 'PITCH / GATE — notes and note length',
    meaning:
      'Tells an instrument which note to play and when it is held or released. The gate is the note’s on/off state. It carries instructions, not audible sound.',
    example:
      'Keyboard PITCH / GATE → Oscillator PITCH. The same output can also open an Envelope’s NOTE / GATE input.',
  },
  control: {
    name: 'MOD — movement of a setting',
    meaning:
      'Short for modulation: a changing control signal moves a setting for you. An LFO can sweep a filter, an Envelope can shape sampler level, and an XY controller can bend pitch. MOD does not carry the sound itself.',
    example:
      'LFO MOD OUT → Filter MOD. PITCH MOD, SPEED MOD and LEVEL MOD name the particular setting being moved.',
  },
  trigger: {
    name: 'TRIGGER — a hit or a restart',
    meaning:
      'A brief “play now” event, including which pad was hit and how hard. It starts a drum hit, restarts a sampler, fires an Envelope, or chooses a new Sample & Hold value. It does not hold a note or carry audio.',
    example:
      'Pad controller PAD 1 → Mic sampler TRIGGER IN plays only pad 1. ALL → Drum machine TRIGGER IN sends every pad hit.',
  },
  kit: {
    name: 'KIT — a set of drum sounds',
    meaning:
      'Passes four voice assignments and their external audio inputs from Drum kit to Drum machine. The machine plays the rhythm and sends out the audible result.',
    example:
      'Drum kit KIT OUT → Drum machine KIT IN, then Drum machine AUDIO OUT → Output AUDIO IN.',
  },
};

export function PortGuide() {
  return (
    <section className="port-guide" aria-label="Patch cable and socket types">
      <h3>What do the ports mean?</h3>
      <p>
        A port is a cable socket. <strong>OUT sends</strong> a signal; <strong>IN receives</strong>{' '}
        one. Connect an output to an input of the same signal type. Each input takes one cable; an
        output can feed several inputs.
      </p>
      <dl>
        {Object.entries(PORT_GUIDE).map(([signal, guide]) => (
          <div key={signal}>
            <dt className={`signal-${signal}`}>{guide.name}</dt>
            <dd>
              {guide.meaning}
              <small>{guide.example}</small>
            </dd>
          </div>
        ))}
      </dl>
      <p>
        Route audio to Output to hear it. Other cables control the sound-making modules.
        Incompatible sockets and cable feedback loops are rejected.
      </p>
    </section>
  );
}
