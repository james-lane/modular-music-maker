import type { DrumSound } from '../domain/instruments';

/** Live gestures are ephemeral commands. They must never enter patch history or autosave. */
export interface LiveControls {
  noteOn: (moduleId: string, note: number, velocity?: number, source?: string) => void;
  noteOff: (moduleId: string, note: number, source?: string) => void;
  releaseKeyboard: (moduleId: string) => void;
  drumHit: (moduleId: string, sound: DrumSound, velocity?: number) => void;
  midiHit: (moduleId: string, index: number, velocity: number) => void;
  midiControl: (moduleId: string, index: number, value: number) => void;
  resetMidi: () => void;
  sampleHit: (moduleId: string) => void;
  padHit: (moduleId: string, index: number, velocity?: number) => void;
}
