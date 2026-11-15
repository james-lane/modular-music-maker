import { CONFIG } from '../config';
import { encodeSamplePcm } from '../domain/samples';
import type { DrumSample } from '../domain/types';
import { readSampleAudio } from './sample-reader';

/** Offline contexts decode/resample silently; importing never wakes the studio audio device. */
export async function importDrumSample(file: File): Promise<DrumSample> {
  const { mono, sampleRate } = await readSampleAudio(file);
  const buffer = new AudioBuffer({ numberOfChannels: 1, length: mono.length, sampleRate });
  buffer.copyToChannel(mono, 0);
  return encodeAudioSample(buffer, file.name);
}

/** Only internally captured, time-limited microphone blobs use this compatibility
 * decoder. Untrusted file imports must go through the bounded sample reader above.
 * Recorder containers may add encoder padding, so captures trim to the PCM limit.
 */
export async function decodeMicrophoneSample(bytes: ArrayBuffer): Promise<DrumSample> {
  const decoder = new OfflineAudioContext(1, 1, CONFIG.samples.sampleRate);
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(bytes);
  } catch {
    throw new Error(
      'This audio file could not be read. Try WAV, MP3, or another browser-supported format.',
    );
  }
  return encodeAudioSample(decoded, 'Mic snippet');
}

async function encodeAudioSample(decoded: AudioBuffer, name: string): Promise<DrumSample> {
  if (!decoded.length) throw new Error('This audio file is empty.');
  const renderer = new OfflineAudioContext(
    1,
    Math.min(
      Math.ceil(decoded.duration * CONFIG.samples.sampleRate),
      CONFIG.samples.maxSeconds * CONFIG.samples.sampleRate,
    ),
    CONFIG.samples.sampleRate,
  );
  const source = renderer.createBufferSource();
  source.buffer = decoded;
  source.connect(renderer.destination);
  source.start();
  try {
    const mono = await renderer.startRendering();
    return {
      name: name.slice(0, 80).trim() || 'Sample',
      pcm: encodeSamplePcm(mono.getChannelData(0)),
    };
  } finally {
    source.disconnect();
  }
}
