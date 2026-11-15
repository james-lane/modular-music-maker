import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIG } from '../src/config';
import { readSampleAudio } from '../src/audio/sample-reader';

/** A real PCM container exercises demuxing/iteration without browser codecs.
 * No decoder mock can accidentally hide a whole-file allocation regression.
 */
function wav(seconds: number, sampleRate = 24000, channels = 1, floating = false) {
  const frames = Math.ceil(seconds * sampleRate);
  const sampleBytes = floating ? 4 : 2;
  const bytes = new ArrayBuffer(44 + frames * channels * sampleBytes);
  const view = new DataView(bytes);
  const tag = (offset: number, text: string) => {
    [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  };
  tag(0, 'RIFF');
  view.setUint32(4, bytes.byteLength - 8, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, floating ? 3 : 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * sampleBytes, true);
  view.setUint16(32, channels * sampleBytes, true);
  view.setUint16(34, sampleBytes * 8, true);
  tag(36, 'data');
  view.setUint32(40, bytes.byteLength - 44, true);
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const offset = 44 + (frame * channels + channel) * sampleBytes;
      const value = channel % 2 === 0 ? 0.75 : -0.25;
      if (floating) view.setFloat32(offset, value, true);
      else view.setInt16(offset, value * 32768, true);
    }
  }
  return bytes;
}

test('bounded reader imports real PCM without WebCodecs and downmixes channels before resampling', async () => {
  const decoded = await readSampleAudio(new Blob([wav(0.25, 48000, 2)]));
  assert.equal(decoded.sampleRate, 48000);
  assert.equal(decoded.mono.length, 12000);
  assert.ok(decoded.mono.every((value) => Math.abs(value - 0.25) < 0.0001));
  const full = await readSampleAudio(new Blob([wav(4)]));
  assert.equal(full.mono.length, 4 * CONFIG.samples.sampleRate);
});

test('overlong audio is rejected by actual decoded frames, not optional duration metadata', async () => {
  await assert.rejects(readSampleAudio(new Blob([wav(5)])), /no longer than 4 seconds/);
  await assert.rejects(readSampleAudio(new Blob([wav(4 + 1 / 24000)])), /no longer than 4 seconds/);
  // Bytes outside a declared RIFF container may be ignored, but must never
  // produce an unbounded decoded result.
  const forged = wav(6);
  new DataView(forged).setUint32(4, 44, true);
  const truncated = await readSampleAudio(new Blob([forged]));
  assert.ok(truncated.mono.length <= CONFIG.samples.maxSeconds * truncated.sampleRate);
});

test('decoded memory, channel count and sample rate are independently bounded', async () => {
  await assert.rejects(readSampleAudio(new Blob([wav(3, 192000, 8)])), /too much memory/);
  await assert.rejects(readSampleAudio(new Blob([wav(0.1, 24000, 9)])), /up to 8 channels/);
  await assert.rejects(readSampleAudio(new Blob([wav(0.1, 384000)])), /192 kHz/);
  const tooLarge = new Blob([new Uint8Array(CONFIG.samples.maxFileBytes + 1)]);
  await assert.rejects(readSampleAudio(tooLarge), /smaller than 20 MB/);
});

test('malformed, empty and non-finite sample data fail safely without losing later imports', async () => {
  const notAudio = new Blob(['not an audio file']);
  await assert.rejects(readSampleAudio(notAudio), /could not be read/);
  await assert.rejects(readSampleAudio(new Blob([wav(0)])));
  const invalid = wav(0.1, 24000, 1, true);
  new DataView(invalid).setFloat32(44, NaN, true);
  await assert.rejects(readSampleAudio(new Blob([invalid])), /invalid audio/);
  const next = await readSampleAudio(new Blob([wav(0.1)]));
  assert.equal(next.mono.length, 2400);
});
