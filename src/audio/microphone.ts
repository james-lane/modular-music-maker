import { CONFIG } from '../config';
import type { DrumSample } from '../domain/types';
import { preferredRecordingType } from './recordings';
import { decodeAudioSample } from './sample-import';

export type CapturePhase = 'idle' | 'requesting' | 'recording' | 'processing';
interface CaptureDependencies {
  getMedia: () => Promise<MediaStream>;
  format: () => string;
  createRecorder: (stream: MediaStream, mimeType: string) => MediaRecorder;
  decode: (bytes: ArrayBuffer) => Promise<DrumSample>;
}
const defaults: CaptureDependencies = {
  getMedia: () => {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error('Microphone access needs HTTPS or localhost and a supported browser.');
    // Speech processing can erase quiet textures or reshape transients in musical snippets.
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
  },
  format: () => preferredRecordingType().mimeType,
  createRecorder: (stream, mimeType) => new MediaRecorder(stream, { mimeType }),
  decode: (bytes) => decodeAudioSample(bytes, 'Mic snippet', true),
};

/** One capture owner, independent of transport and speaker output. Cancellation invalidates
 * permission and decoding promises too: late grants are immediately released, never saved.
 */
export class MicrophoneCapture {
  private generation = 0;
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private timer?: ReturnType<typeof setTimeout>;
  private settle?: (blob: Blob | null) => void;
  constructor(
    private readonly onPhase: (phase: CapturePhase) => void,
    private readonly dependencies: CaptureDependencies = defaults,
  ) {}

  private release() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }

  finish() {
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.release();
  }

  cancel() {
    this.generation++;
    this.finish();
    this.settle?.(null);
    this.settle = undefined;
    this.recorder = undefined;
    this.onPhase('idle');
  }

  async record(): Promise<DrumSample | null> {
    this.cancel();
    const token = this.generation;
    this.onPhase('requesting');
    try {
      const mimeType = this.dependencies.format();
      const stream = await this.dependencies.getMedia();
      if (token !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return null;
      }
      this.stream = stream;
      const recorder = this.dependencies.createRecorder(stream, mimeType);
      this.recorder = recorder;
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        const chunks: BlobPart[] = [];
        this.settle = resolve;
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        recorder.onerror = () =>
          reject(new Error('Microphone recording was interrupted. Try again.'));
        recorder.start();
        this.onPhase('recording');
        this.timer = setTimeout(() => this.finish(), CONFIG.samples.maxSeconds * 1000);
      });
      if (token !== this.generation || !blob) return null;
      this.release();
      this.recorder = undefined;
      this.settle = undefined;
      if (!blob.size) throw new Error('No sound was captured. Try recording a little longer.');
      this.onPhase('processing');
      const sample = await this.dependencies.decode(await blob.arrayBuffer());
      return token === this.generation ? sample : null;
    } catch (error) {
      if (token !== this.generation) return null;
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError')
          throw new Error(
            'Microphone permission was denied. Allow microphone access in your browser’s site settings, then try again.',
          );
        if (error.name === 'NotFoundError')
          throw new Error('No microphone was found. Connect one and try again.');
        if (error.name === 'NotReadableError')
          throw new Error(
            'The microphone is busy or unavailable. Close other apps using it and try again.',
          );
      }
      throw error;
    } finally {
      if (token === this.generation) {
        this.release();
        if (this.recorder?.state === 'recording') this.recorder.stop();
        this.recorder = undefined;
        this.settle = undefined;
        this.onPhase('idle');
      }
    }
  }
}
