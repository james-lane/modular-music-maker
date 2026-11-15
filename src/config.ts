/** Product and behavior defaults live here, rather than being scattered through the UI. */
export const CONFIG = {
  name: 'Patchwork',
  storageKey: 'patchwork.projects.v1',
  activeProjectKey: 'patchwork.active.v1',
  appearance: {
    cableStyleKey: 'patchwork.cable-style.v1',
    defaultCableStyle: 'classic',
  },
  autosaveDelayMs: 650,
  offline: {
    statusTimeoutMs: 4000,
    activationTimeoutMs: 15000,
    updateDownloadTimeoutMs: 30000,
    updateCheckIntervalMs: 15 * 60 * 1000,
    minCheckIntervalMs: 60 * 1000,
  },
  localApi: { hosts: ['localhost', '127.0.0.1', '[::1]'], timeoutMs: 1500 },
  historyLimit: 60,
  sequencerGesture: {
    dragThresholdPx: 6,
    pixelsPerDegree: 12,
    finePixelsPerDegree: 48,
  },
  canvas: {
    width: 1800,
    height: 1200,
    grid: 20,
    minZoom: 0.45,
    maxZoom: 1.4,
    defaultZoom: 0.9,
    wheelZoomSpeed: 0.002,
  },
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
  samples: {
    sampleRate: 24000,
    maxSeconds: 4,
    maxFileBytes: 20 * 1024 * 1024,
    maxEncodedLength: 256000,
    maxProjectEncodedLength: 1024000,
  },
  maxPatchBytes: 2 * 1024 * 1024,
  maxModules: 40,
  maxCables: 100,
} as const;

export const ROOT_NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  pentatonic: [0, 3, 5, 7, 10],
};
