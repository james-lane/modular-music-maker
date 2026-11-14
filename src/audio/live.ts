import type { DrumSound } from '../domain/instruments';

/** Live gestures are ephemeral commands. They must never enter patch history or autosave. */
export interface LiveControls {
  noteOn: (moduleId: string, note: number) => void;
  noteOff: (moduleId: string, note: number) => void;
  releaseKeyboard: (moduleId: string) => void;
  drumHit: (moduleId: string, sound: DrumSound) => void;
  padHit: (moduleId: string, sound: DrumSound) => void;
}
