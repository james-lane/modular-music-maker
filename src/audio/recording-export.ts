import { CONFIG } from '../config';
import type { Recording } from './recordings';
import type { RecordingEncodeResponse, RecordingExportFormat } from './recording-encoder';

/** Original takes stay untouched in IndexedDB. Conversion is silent, never
 * resumes the studio or requests a device, and owns its worker until settled. */
export async function exportRecording(
  recording: Recording,
  format: RecordingExportFormat,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
): Promise<{ blob: Blob; extension: string }> {
  signal.throwIfAborted();
  if (format === 'original') return { blob: recording.blob, extension: recording.extension };

  // Native decoding covers the recording codec used by this browser, including
  // browsers without WebCodecs. Only trusted studio takes use whole-blob decoding.
  const context = new OfflineAudioContext(2, 1, CONFIG.audio.recordingExport.sampleRate);
  const audio = await context.decodeAudioData(await recording.blob.arrayBuffer());
  signal.throwIfAborted();
  const channels = Array.from({ length: audio.numberOfChannels }, (_, channel) =>
    audio.getChannelData(channel),
  );
  const worker = new Worker(new URL('./recording-export-worker.ts', import.meta.url), {
    type: 'module',
  });
  let abort: (() => void) | undefined;
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      abort = () => reject(new DOMException('Export cancelled.', 'AbortError'));
      signal.addEventListener('abort', abort, { once: true });
      worker.onmessage = (event: MessageEvent<RecordingEncodeResponse>) => {
        const message = event.data;
        if (message.type === 'progress') onProgress(message.progress);
        else {
          if (message.type === 'complete') resolve(message.blob);
          else reject(new Error(message.message));
        }
      };
      worker.onerror = () => {
        reject(new Error('Audio conversion failed. Try downloading the original format.'));
      };
      worker.postMessage(
        { channels, format },
        channels.map((channel) => channel.buffer),
      );
    });
    signal.throwIfAborted();
    return { blob, extension: format };
  } finally {
    if (abort) signal.removeEventListener('abort', abort);
    worker.terminate();
  }
}
