/** Serializable domain data only. Audio nodes and UI state never enter a saved patch. */
export type ModuleType =
  | 'sequencer'
  | 'oscillator'
  | 'noise'
  | 'lfo'
  | 'filter'
  | 'delay'
  | 'reverb'
  | 'mixer'
  | 'output'
  | 'drum-machine'
  | 'keyboard'
  | 'pad-controller';
export type SignalType = 'audio' | 'pitch' | 'control' | 'trigger';
export type Category = 'Sources' | 'Modulation' | 'Effects' | 'Utility';
export type Parameters = Record<string, number | string | boolean>;

export interface PortDefinition {
  id: string;
  label: string;
  direction: 'input' | 'output';
  signal: SignalType;
}

export interface ControlDefinition {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
  logarithmic?: boolean;
}

export interface ModuleDefinition {
  type: ModuleType;
  name: string;
  subtitle: string;
  description: string;
  category: Category;
  color: string;
  code: string;
  width: number;
  height: number;
  ports: PortDefinition[];
  controls: ControlDefinition[];
  defaults?: Parameters;
  maxInstances?: number;
}

export interface PatchModule {
  id: string;
  type: ModuleType;
  x: number;
  y: number;
  parameters: Parameters;
  /** Scale degrees; -1 is a rest. Kept explicit so the sequencer is easy to extend. */
  steps?: number[];
  /** Optional additive v1 field: only drum machines persist a per-voice step pattern. */
  drumPattern?: Record<string, boolean[]>;
}

export interface Endpoint {
  moduleId: string;
  portId: string;
}
export interface Cable {
  id: string;
  from: Endpoint;
  to: Endpoint;
}

export interface Project {
  version: 1;
  id: string;
  name: string;
  updatedAt: string;
  tempo: number;
  rootNote: string;
  scale: 'minor' | 'major' | 'pentatonic';
  timeSignature: '4/4' | '3/4' | '6/8';
  masterVolume: number;
  modules: PatchModule[];
  cables: Cable[];
}
