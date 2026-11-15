import { Mp3Encoder } from '@breezystack/lamejs';
import { CONFIG } from '../config';

export type ConvertedRecordingFormat = 'wav' | 'mp3';
export type RecordingExportFormat = ConvertedRecordingFormat | 'original';

export interface RecordingEncodeRequest {
  channels: Float32Array<ArrayBuffer>[];
  format: ConvertedRecordingFormat;
}

export type RecordingEncodeResponse =
  | { type: 'progress'; progress: number }
  | { type: 'complete'; blob: Blob }
  | { type: 'error'; message: string };

/** The source is an internally captured, ten-minute-bounded take. Keep channel
 * order and timing intact; clamp only values outside the PCM file range. */
export function encodeRecording(
  { channels, format }: RecordingEncodeRequest,
  onProgress: (progress: number) => void = () => {},
): Blob {
  const frames = channels[0]?.length ?? 0;
  const { sampleRate, mp3BitrateKbps, blockFrames } = CONFIG.audio.recordingExport;
  if (
    !frames ||
    channels.length > 2 ||
    channels.some((channel) => channel.length !== frames) ||
    frames > (CONFIG.audio.maxRecordingSeconds + 5) * sampleRate
  )
    throw new Error('This take cannot be converted. Download its original format instead.');

  const parts: BlobPart[] = [];
  const mp3 = format === 'mp3' ? new Mp3Encoder(channels.length, sampleRate, mp3BitrateKbps) : null;
  if (!mp3) parts.push(waveHeader(frames, channels.length, sampleRate));
  let lastProgress = -1;
  for (let start = 0; start < frames; start += blockFrames) {
    const length = Math.min(blockFrames, frames - start);
    const pcm = channels.map((channel) => {
      const result = new Int16Array(length);
      for (let frame = 0; frame < length; frame++) {
        const value = channel[start + frame];
        if (!Number.isFinite(value)) throw new Error('This take contains invalid audio.');
        const clamped = Math.max(-1, Math.min(1, value));
        result[frame] = Math.round(clamped * (clamped < 0 ? 0x8000 : 0x7fff));
      }
      return result;
    });
    if (mp3) {
      // LAME reuses its internal output buffer; own every emitted block.
      const encoded = mp3.encodeBuffer(pcm[0], pcm[1]);
      if (encoded.length) parts.push(new Uint8Array(encoded));
    } else {
      const interleaved = new ArrayBuffer(length * channels.length * 2);
      const view = new DataView(interleaved);
      for (let frame = 0; frame < length; frame++)
        for (let channel = 0; channel < channels.length; channel++)
          view.setInt16((frame * channels.length + channel) * 2, pcm[channel][frame], true);
      parts.push(interleaved);
    }
    const progress = Math.floor(((start + length) / frames) * 100);
    if (progress !== lastProgress) onProgress(progress);
    lastProgress = progress;
  }
  if (mp3) parts.push(new Uint8Array(mp3.flush()));
  return new Blob(parts, { type: mp3 ? 'audio/mpeg' : 'audio/wav' });
}

function waveHeader(frames: number, channels: number, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      view.setUint8(offset + index, value.charCodeAt(index));
  };
  const dataBytes = frames * channels * 2;
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, dataBytes, true);
  return buffer;
}
