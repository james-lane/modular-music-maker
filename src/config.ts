/** Product and behavior defaults live here, rather than being scattered through the UI. */
export const CONFIG = {
  name: 'Patchwork',
  storageKey: 'patchwork.projects.v1',
  activeProjectKey: 'patchwork.active.v1',
  autosaveDelayMs: 650,
  historyLimit: 60,
  canvas: { width: 1800, height: 1200, grid: 20, minZoom: 0.45, maxZoom: 1.4, defaultZoom: 0.9 },
  audio: {
    schedulerIntervalMs: 25,
    scheduleAheadSeconds: 0.12,
    parameterRampSeconds: 0.025,
    maxRecordingSeconds: 600,
    defaultMasterVolume: 0.65,
    liveTailMs: 3000,
    maxDrumHits: 96,
  },
  tempo: { min: 40, max: 240, default: 108 },
  maxModules: 40,
  maxCables: 100,
} as const;

export const ROOT_NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  pentatonic: [0, 3, 5, 7, 10],
};
