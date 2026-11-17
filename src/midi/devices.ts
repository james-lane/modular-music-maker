export interface MidiDevice {
  id: string;
  name: string;
}
export interface MidiState {
  phase: 'off' | 'requesting' | 'enabled' | 'error' | 'unsupported';
  devices: MidiDevice[];
  error: string;
}

/** Own native listeners and input ports once per studio, with generation guards
 * for permission prompts that finish after Disable/unmount. Never request SysEx.
 */
export class MidiDevices {
  private access?: MIDIAccess;
  private inputs = new Map<string, MIDIInput>();
  private generation = 0;
  private state: MidiState;
  constructor(
    private readonly request: (() => Promise<MIDIAccess>) | undefined,
    private readonly changed: (state: MidiState) => void,
    private readonly received: (device: string, data: Uint8Array) => void,
    private readonly released: (device?: string) => void,
  ) {
    this.state = { phase: request ? 'off' : 'unsupported', devices: [], error: '' };
  }
  get snapshot() {
    return this.state;
  }
  private publish(state: MidiState) {
    this.state = state;
    this.changed(state);
  }
  async enable() {
    if (!this.request || this.state.phase === 'requesting' || this.access) return;
    const generation = ++this.generation;
    this.publish({ ...this.state, phase: 'requesting', error: '' });
    try {
      const access = await this.request();
      if (generation !== this.generation) return;
      this.access = access;
      access.addEventListener('statechange', this.refresh);
      this.refresh();
    } catch {
      if (generation === this.generation)
        this.publish({
          phase: 'error',
          devices: [],
          error:
            'MIDI access was not allowed or is unavailable. Check this site’s MIDI permission, then try again.',
        });
    }
  }
  private refresh = () => {
    if (!this.access) return;
    const current = [...this.access.inputs.values()].filter((input) => input.state === 'connected');
    for (const [id, input] of this.inputs)
      if (!current.includes(input)) {
        input.removeEventListener('midimessage', this.message);
        void input.close().catch(() => {});
        this.inputs.delete(id);
        this.released(id);
      }
    for (const input of current)
      if (!this.inputs.has(input.id)) {
        this.inputs.set(input.id, input);
        input.addEventListener('midimessage', this.message);
        void input.open().catch(() => {
          if (this.inputs.get(input.id) === input)
            this.publish({
              ...this.state,
              error: 'A MIDI input could not be opened. Reconnect it or choose another input.',
            });
        });
      }
    this.publish({
      phase: 'enabled',
      devices: current.map((input) => ({ id: input.id, name: input.name || 'MIDI input' })),
      error: '',
    });
  };
  private message = (event: MIDIMessageEvent) => {
    if (event.currentTarget instanceof EventTarget && event.data) {
      const input = [...this.inputs.values()].find((input) => input === event.currentTarget);
      if (input) this.received(input.id, event.data);
    }
  };
  disable() {
    ++this.generation;
    this.access?.removeEventListener('statechange', this.refresh);
    this.access = undefined;
    for (const input of this.inputs.values()) {
      input.removeEventListener('midimessage', this.message);
      void input.close().catch(() => {});
    }
    this.inputs.clear();
    this.released();
    this.publish({ phase: this.request ? 'off' : 'unsupported', devices: [], error: '' });
  }
}
