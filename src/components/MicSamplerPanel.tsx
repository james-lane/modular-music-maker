import { useMemo } from 'react';
import type { LiveControls } from '../audio/live';
import { CONFIG } from '../config';
import { decodeSamplePcm, sampleRegion, sampleWav } from '../domain/samples';
import { downloadFile, fileSlug } from '../domain/storage';
import type { Parameters, PatchModule } from '../domain/types';
import { SAMPLER_TRIM } from '../domain/modules';
import { SampleTrimControls } from './SampleTrimControls';
import type { MicrophoneControls } from '../hooks/useMicrophoneSampler';

export function MicSamplerPanel({
  module,
  microphone,
  live,
  onClear,
  onParameters,
}: {
  module: PatchModule;
  microphone: MicrophoneControls;
  live: LiveControls;
  onClear: () => void;
  onParameters: (values: Parameters, group?: string) => void;
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
  const region = clip ? sampleRegion(clip.pcm, module.parameters) : null;
  const start = Number(module.parameters.trimStart);
  const end = Number(module.parameters.trimEnd);
  const trimmed = start !== SAMPLER_TRIM.start || end !== SAMPLER_TRIM.end;
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
            {(recording ? microphone.seconds : (region?.duration ?? 0)).toFixed(2)}{' '}
            <small>/ {region?.sourceDuration.toFixed(2) ?? CONFIG.samples.maxSeconds}s</small>
          </strong>
        </div>
        <svg
          viewBox="0 0 256 60"
          role="img"
          aria-label={
            region
              ? `Recorded snippet waveform, selected ${region.startSeconds.toFixed(2)} to ${region.endSeconds.toFixed(2)} seconds`
              : 'No recorded snippet'
          }
        >
          <path d={waveform || 'M0 30H256'} />
          {clip && (
            <>
              <rect className="mic-trim-outside" x={0} y={0} width={start * 256} height={60} />
              <rect
                className="mic-trim-outside"
                x={end * 256}
                y={0}
                width={(1 - end) * 256}
                height={60}
              />
              <path className="mic-trim-boundary" d={`M${start * 256} 0V60M${end * 256} 0V60`} />
            </>
          )}
        </svg>
        <span className="mic-clip-name">{clip?.name ?? 'Your next sound starts here'}</span>
      </div>
      <SampleTrimControls
        parameters={module.parameters}
        duration={region?.sourceDuration ?? 0}
        disabled={!clip || busy}
        onParameters={onParameters}
      />
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
                if (clip)
                  downloadFile(
                    sampleWav(clip.pcm, module.parameters),
                    `${fileSlug(clip.name)}.wav`,
                  );
              }}
            >
              Download WAV
            </button>
            <button
              disabled={!clip || busy || !trimmed}
              onClick={() =>
                onParameters({ trimStart: SAMPLER_TRIM.start, trimEnd: SAMPLER_TRIM.end })
              }
            >
              Reset trim
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
                : 'Trim the part to keep · original saved in patch'}
      </p>
    </div>
  );
}
