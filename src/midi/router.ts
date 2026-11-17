import type { LiveControls } from '../audio/live';
import { DRUM_SOUNDS } from '../domain/instruments';
import type { PatchModule, Project } from '../domain/types';

export type MidiMessage = {
  kind: 'on' | 'off' | 'cc';
  channel: number;
  number: number;
  value: number;
};
export function decodeMidi(data: ArrayLike<number>): MidiMessage | null {
  if (data.length !== 3) return null;
  const [status, number, value] = [data[0], data[1], data[2]];
  if (
    ![status, number, value].every(Number.isInteger) ||
    status < 0x80 ||
    status > 0xef ||
    number < 0 ||
    number > 127 ||
    value < 0 ||
    value > 127
  )
    return null;
  const command = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  if (command === 0x90) return { kind: value ? 'on' : 'off', channel, number, value };
  if (command === 0x80) return { kind: 'off', channel, number, value };
  if (command === 0xb0) return { kind: 'cc', channel, number, value };
  return null;
}

interface Hold {
  moduleId: string;
  note: number;
  source: string;
  device: string;
  channel: number;
  down: boolean;
}
/** Device notes are transient owners. Touch notes, separate devices/channels and
 * overlapping MIDI modules cannot release each other's holds. Sustain is scoped
 * to its input/channel; routing/configuration changes explicitly retire old notes.
 */
export class MidiRouter {
  private holds = new Map<string, Hold>();
  private sustained = new Set<string>();
  private signature = '';
  constructor(private readonly live: () => LiveControls) {}
  private channelKey(device: string, channel: number) {
    return JSON.stringify([device, channel]);
  }
  private key(moduleId: string, device: string, channel: number, note: number) {
    return JSON.stringify([moduleId, device, channel, note]);
  }
  sync(project: Project, devices: Readonly<Record<string, string>>) {
    const signature = JSON.stringify([
      project.id,
      project.cables,
      project.modules.map((module) => [
        module.id,
        module.type,
        module.type === 'midi-input' ? module.parameters : null,
      ]),
      devices,
    ]);
    if (signature !== this.signature) {
      this.panic();
      this.live().resetMidi();
      this.signature = signature;
    }
  }
  panic(device?: string, channel?: number) {
    for (const [key, hold] of this.holds) {
      if (
        device !== undefined &&
        (hold.device !== device || (channel !== undefined && hold.channel !== channel))
      )
        continue;
      this.live().noteOff(hold.moduleId, hold.note, hold.source);
      this.holds.delete(key);
    }
    if (device === undefined) this.sustained.clear();
    else
      for (let n = 1; n <= 16; n++)
        if (channel === undefined || n === channel)
          this.sustained.delete(this.channelKey(device, n));
  }
  receive(
    project: Project,
    devices: Readonly<Record<string, string>>,
    device: string,
    data: ArrayLike<number>,
  ) {
    this.sync(project, devices);
    const message = decodeMidi(data);
    if (!message) return;
    const { channel, number, value, kind } = message;
    const channelKey = this.channelKey(device, channel);
    if (kind === 'cc' && [120, 123].includes(number)) {
      this.panic(device, channel);
      return;
    }
    if (kind === 'cc' && number === 64) {
      if (value >= 64) this.sustained.add(channelKey);
      else {
        this.sustained.delete(channelKey);
        for (const [key, hold] of this.holds)
          if (hold.device === device && hold.channel === channel && !hold.down)
            this.release(key, hold);
      }
    }
    if (kind === 'off') {
      for (const [key, hold] of this.holds)
        if (hold.device === device && hold.channel === channel && hold.note === number) {
          hold.down = false;
          if (!this.sustained.has(channelKey)) this.release(key, hold);
        }
      return;
    }
    for (const module of project.modules) {
      if (
        module.type !== 'midi-input' ||
        (devices[module.id] && devices[module.id] !== device) ||
        (Number(module.parameters.channel) && module.parameters.channel !== channel)
      )
        continue;
      if (kind === 'cc') {
        for (let index = 1; index <= 4; index++)
          if (module.parameters[`cc${index}`] === number)
            this.live().midiControl(module.id, index, value);
      } else if (
        number >= Number(module.parameters.noteMin) &&
        number <= Number(module.parameters.noteMax)
      )
        this.press(module, device, channel, number, value);
    }
  }
  private press(
    module: PatchModule,
    device: string,
    channel: number,
    note: number,
    velocity: number,
  ) {
    const source = `midi:${this.channelKey(device, channel)}`;
    const key = this.key(module.id, device, channel, note);
    const hold = { moduleId: module.id, note, source, device, channel, down: true };
    this.holds.set(key, hold);
    this.live().noteOn(module.id, note, velocity / 127, source);
    const index = note - Number(module.parameters.firstNote);
    if (DRUM_SOUNDS[index]) this.live().midiHit(module.id, index, velocity / 127);
  }
  private release(key: string, hold: Hold) {
    this.live().noteOff(hold.moduleId, hold.note, hold.source);
    this.holds.delete(key);
  }
}
