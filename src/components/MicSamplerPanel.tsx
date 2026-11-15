import { useMemo } from 'react';
import type { LiveControls } from '../audio/live';
import { CONFIG } from '../config';
import { decodeSamplePcm, sampleWav } from '../domain/samples';
import { downloadFile, fileSlug } from '../domain/storage';
import type { PatchModule } from '../domain/types';
import type { MicrophoneControls } from '../hooks/useMicrophoneSampler';

export function MicSamplerPanel({
  module,
  microphone,
  live,
  onClear,
}: {
  module: PatchModule;
  microphone: MicrophoneControls;
  live: LiveControls;
  onClear: () => void;
}) {
  const clip = module.samples?.clip;
  const ownsCapture = microphone.moduleId === module.id;
  const busy = microphone.phase !== 'idle';
  const recording = ownsCapture && microphone.phase === 'recording';
  const requesting = ownsCapture && microphone.phase === 'requesting';
  const processing = ownsCapture && microphone.phase === 'processing';
  const waveform = useMemo(() => {
    if (!clip) return '';
    const data = decodeSamplePcm(clip.pcm);
    // Peak buckets retain short transients without redrawing the entire PCM on every tick.
    return Array.from({ length: 64 }, (_, index) => {
      let peak = 0;
      const start = Math.floor((index * data.length) / 64);
      const end = Math.floor(((index + 1) * data.length) / 64);
      for (let frame = start; frame < end; frame++) peak = Math.max(peak, Math.abs(data[frame]));
      const x = index * 4 + 2;
      const height = Math.max(1, peak * 24);
      return `M${x},${30 - height}V${30 + height}`;
    }).join(' ');
  }, [clip]);
  const duration = clip ? decodeDuration(clip.pcm) : 0;
  return (
    <div className="mic-instrument">
      <div className="mic-grille" aria-hidden="true">
        <span>MONO FIELD RECORDER</span>
      </div>
      <div className={`mic-display ${recording ? 'capturing' : ''}`}>
        <div>
          <span>
            {recording
              ? '● REC'
              : requesting
                ? 'ALLOW MIC'
                : processing
                  ? 'SAVING'
                  : clip
                    ? 'CLIP READY'
                    : 'NO CLIP'}
          </span>
          <strong>
            {(recording ? microphone.seconds : duration).toFixed(1)}{' '}
            <small>/ {CONFIG.samples.maxSeconds}s</small>
          </strong>
        </div>
        <svg
          viewBox="0 0 256 60"
          role="img"
          aria-label={clip ? 'Recorded snippet waveform' : 'No recorded snippet'}
        >
          <path d={waveform || 'M0 30H256'} />
        </svg>
        <span className="mic-clip-name">{clip?.name ?? 'Your next sound starts here'}</span>
      </div>
      <div className="mic-transport">
        <button
          className="mic-record"
          disabled={busy && !recording}
          onClick={() => (recording ? microphone.finish() : microphone.start(module.id))}
          aria-label={recording ? 'Finish microphone recording' : 'Record mic'}
        >
          <i />
          {recording
            ? 'Finish'
            : requesting
              ? 'Waiting…'
              : processing
                ? 'Saving…'
                : clip
                  ? 'Record again'
                  : 'Record mic'}
        </button>
        <button
          disabled={!clip || busy}
          onClick={() => live.sampleHit(module.id)}
          aria-label="Play snippet"
        >
          ▶ Play snippet
        </button>
      </div>
      <div className="mic-tools">
        {ownsCapture && busy ? (
          <button onClick={microphone.cancel}>Cancel capture</button>
        ) : (
          <>
            <button
              disabled={!clip || busy}
              onClick={() => {
                if (clip) downloadFile(sampleWav(clip.pcm), `${fileSlug(clip.name)}.wav`);
              }}
            >
              Download WAV
            </button>
            <button disabled={!clip || busy} onClick={onClear} aria-label="Clear recorded snippet">
              Clear
            </button>
          </>
        )}
      </div>
      <p className="mic-caption" role="status">
        {recording
          ? 'Listening to microphone · finishes at 4s'
          : requesting
            ? 'Allow microphone access in your browser.'
            : processing
              ? 'Preparing your snippet…'
              : busy
                ? 'Another sampler is using the microphone.'
                : '4 seconds · saved in patch · no live monitoring'}
      </p>
    </div>
  );
}
function decodeDuration(pcm: string) {
  const padding = pcm.endsWith('==') ? 2 : pcm.endsWith('=') ? 1 : 0;
  return ((pcm.length / 4) * 3 - padding) / 2 / CONFIG.samples.sampleRate;
}
