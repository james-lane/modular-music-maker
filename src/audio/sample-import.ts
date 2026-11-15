import { CONFIG } from '../config';
import { encodeSamplePcm } from '../domain/samples';
import type { DrumSample } from '../domain/types';

/** Offline contexts decode/resample silently; importing never wakes the studio audio device. */
export async function importDrumSample(file: File): Promise<DrumSample> {
  if (file.size > CONFIG.samples.maxFileBytes)
    throw new Error('Choose an audio file smaller than 20 MB.');
  const decoder = new OfflineAudioContext(1, 1, CONFIG.samples.sampleRate);
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error(
      'This audio file could not be read. Try WAV, MP3, or another browser-supported format.',
    );
  }
  if (decoded.duration > CONFIG.samples.maxSeconds)
    throw new Error(
      `Choose a sample no longer than ${CONFIG.samples.maxSeconds} seconds. Trim it first, then import it again.`,
    );
  if (!decoded.length) throw new Error('This audio file is empty.');
  const renderer = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * CONFIG.samples.sampleRate),
    CONFIG.samples.sampleRate,
  );
  const source = renderer.createBufferSource();
  source.buffer = decoded;
  source.connect(renderer.destination);
  source.start();
  try {
    const mono = await renderer.startRendering();
    return {
      name: file.name.slice(0, 80).trim() || 'Sample',
      pcm: encodeSamplePcm(mono.getChannelData(0)),
    };
  } finally {
    source.disconnect();
  }
}
