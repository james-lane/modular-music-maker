import type { AudioSample } from 'mediabunny';
import { CONFIG } from '../config';

class SampleImportError extends Error {}

/** Limit actual decoded frames, not file duration metadata (which an import can
 * lie about). The sink applies decoder backpressure; closing each sample and
 * disposing the input also release its small look-ahead queue on every exit.
 */
export async function readSampleAudio(file: Blob): Promise<{
  mono: Float32Array<ArrayBuffer>;
  sampleRate: number;
}> {
  if (file.size > CONFIG.samples.maxFileBytes)
    throw new SampleImportError('Choose an audio file smaller than 20 MB.');
  const { Input, BlobSource, AudioSampleSink, WAVE, MP3, MP4, OGG, FLAC, WEBM, ADTS } =
    await import('mediabunny');
  // Deliberately exclude playlists/network sources. Imports are one local file.
  const input = new Input({
    source: new BlobSource(file, { maxCacheSize: CONFIG.samples.maxFileBytes }),
    formats: [WAVE, MP3, MP4, OGG, FLAC, WEBM, ADTS],
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    input.dispose();
  }, CONFIG.samples.importTimeoutMs);
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new SampleImportError('This file has no audio track.');
    const sampleRate = await track.getSampleRate();
    const channels = await track.getNumberOfChannels();
    checkFormat(sampleRate, channels);
    if (!(await track.canDecode()))
      throw new SampleImportError(
        'This browser cannot safely import this audio format. Convert it to PCM WAV and try again.',
      );
    const mono = new Float32Array(Math.ceil(sampleRate * CONFIG.samples.maxSeconds));
    let frames = 0;
    let decodedBytes = 0;
    for await (const sample of new AudioSampleSink(track).samples()) {
      try {
        checkFormat(sample.sampleRate, sample.numberOfChannels);
        if (sample.sampleRate !== sampleRate || sample.numberOfChannels !== channels)
          throw new SampleImportError('The audio format changes inside this file. Use PCM WAV.');
        if (sample.numberOfFrames > mono.length - frames)
          throw new SampleImportError(
            `Choose a sample no longer than ${CONFIG.samples.maxSeconds} seconds. Trim it first, then import it again.`,
          );
        decodedBytes += sample.numberOfFrames * channels * Float32Array.BYTES_PER_ELEMENT;
        if (decodedBytes > CONFIG.samples.maxImportDecodedBytes)
          throw new SampleImportError('This sample needs too much memory. Convert it to mono WAV.');
        downmix(sample, mono, frames);
        frames += sample.numberOfFrames;
      } finally {
        sample.close();
      }
    }
    if (!frames) throw new SampleImportError('This audio file is empty.');
    return { mono: mono.subarray(0, frames), sampleRate };
  } catch (error) {
    if (timedOut) throw new SampleImportError('Audio import took too long. Try a shorter PCM WAV.');
    if (error instanceof SampleImportError) throw error;
    throw new SampleImportError('This audio file could not be read. Try a short PCM WAV.');
  } finally {
    clearTimeout(timer);
    input.dispose();
  }
}

function checkFormat(sampleRate: number, channels: number) {
  if (
    !Number.isInteger(sampleRate) ||
    sampleRate < 3000 ||
    sampleRate > CONFIG.samples.maxImportSampleRate ||
    !Number.isInteger(channels) ||
    channels < 1 ||
    channels > CONFIG.samples.maxImportChannels
  )
    throw new SampleImportError('Use audio with up to 8 channels and a sample rate up to 192 kHz.');
}

function downmix(sample: AudioSample, mono: Float32Array, offset: number) {
  const plane = new Float32Array(sample.numberOfFrames);
  for (let channel = 0; channel < sample.numberOfChannels; channel++) {
    sample.copyTo(plane, { format: 'f32-planar', planeIndex: channel });
    for (let frame = 0; frame < plane.length; frame++) {
      const value = plane[frame];
      if (!Number.isFinite(value))
        throw new SampleImportError('The sample contains invalid audio.');
      mono[offset + frame] += value / sample.numberOfChannels;
    }
  }
}
