import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BlobSource, Input, MP3 } from 'mediabunny';
import { encodeRecording } from '../src/audio/recording-encoder';
import { CONFIG } from '../src/config';
import { exportRecording } from '../src/audio/recording-export';
import type { Recording } from '../src/audio/recordings';
import type { RecordingEncodeResponse } from '../src/audio/recording-encoder';

test('WAV export preserves stereo order, partial blocks, signed PCM and duration', async () => {
  const left = new Float32Array(1301);
  const right = new Float32Array(left.length);
  left.set([-2, -0.5, 0, 0.5, 2]);
  right.set([1, 0, -1, 0.25, -0.25]);
  left[left.length - 1] = 1;
  const progress: number[] = [];
  const wav = encodeRecording({ channels: [left, right], format: 'wav' }, (p) => progress.push(p));
  const bytes = await wav.arrayBuffer();
  const view = new DataView(bytes);
  assert.equal(wav.type, 'audio/wav');
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), 'WAVE');
  assert.equal(view.getUint32(4, true), bytes.byteLength - 8);
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), CONFIG.audio.recordingExport.sampleRate);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), left.length * 4);
  assert.deepEqual(
    Array.from({ length: 10 }, (_, i) => view.getInt16(44 + i * 2, true)),
    [-32768, 32767, -16384, 0, 0, -32768, 16384, 8192, 32767, -8192],
  );
  assert.equal(view.getInt16(bytes.byteLength - 4, true), 32767);
  assert.equal(progress.at(-1), 100);
  assert.equal(left[0], -2, 'conversion does not mutate its input');
});

test('MP3 export produces readable mono and stereo MPEG audio, including its final block', async () => {
  const sampleRate = CONFIG.audio.recordingExport.sampleRate;
  const tone = Float32Array.from(
    { length: sampleRate + 137 },
    (_, frame) => 0.3 * Math.sin((frame * 2 * Math.PI * 440) / sampleRate),
  );
  for (const channels of [[tone], [tone, new Float32Array(tone.length)]]) {
    const mp3 = encodeRecording({ channels, format: 'mp3' });
    assert.equal(mp3.type, 'audio/mpeg');
    const input = new Input({ source: new BlobSource(mp3), formats: [MP3] });
    try {
      const track = await input.getPrimaryAudioTrack();
      assert(track);
      assert.equal(await track.getSampleRate(), sampleRate);
      assert.equal(await track.getNumberOfChannels(), channels.length);
      const duration = await input.computeDuration();
      assert(duration >= tone.length / sampleRate, 'flush retains the last partial MP3 frame');
      assert(duration < tone.length / sampleRate + 0.1, 'only codec padding extends the take');
      assert(mp3.size > 20000 && mp3.size < 30000, '192 kbps output size');
    } finally {
      input.dispose();
    }
  }
});

test('conversion rejects empty, mismatched, excessive and non-finite PCM', () => {
  for (const channels of [
    [],
    [new Float32Array()],
    [new Float32Array(1), new Float32Array(2)],
    Array.from({ length: 3 }, () => new Float32Array(1)),
    [new Float32Array([NaN])],
    [new Float32Array([Infinity])],
  ])
    assert.throws(() => encodeRecording({ channels, format: 'wav' }));
});

const legacyTake: Recording = {
  id: 'legacy-take',
  name: 'Existing recording',
  createdAt: '2026-11-15T12:00:00Z',
  duration: 1,
  blob: new Blob(['original captured bytes'], { type: 'audio/mp4' }),
  extension: 'm4a',
};

test('original download keeps a legacy take byte-for-byte without a decoder or worker', async () => {
  const result = await exportRecording(
    legacyTake,
    'original',
    new AbortController().signal,
    () => {},
  );
  assert.equal(result.blob, legacyTake.blob);
  assert.equal(result.extension, 'm4a');
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    exportRecording(legacyTake, 'original', controller.signal, () => {}),
    {
      name: 'AbortError',
    },
  );
});

test('export owns and terminates its worker on completion, failure and cancellation', async () => {
  const descriptors = ['OfflineAudioContext', 'Worker'].map((key) =>
    Object.getOwnPropertyDescriptor(globalThis, key),
  );
  const workers: ExportWorker[] = [];
  const pcm = [new Float32Array(100), new Float32Array(100)];
  class Decoder {
    decodeAudioData = async () => ({
      numberOfChannels: 2,
      getChannelData: (index: number) => pcm[index],
    });
  }
  class ExportWorker {
    onmessage: ((event: MessageEvent<RecordingEncodeResponse>) => void) | null = null;
    onerror: (() => void) | null = null;
    terminated = false;
    constructor() {
      workers.push(this);
    }
    postMessage(_request: unknown, transfers: ArrayBuffer[]) {
      assert.deepEqual(
        transfers,
        pcm.map((channel) => channel.buffer),
      );
    }
    terminate() {
      this.terminated = true;
    }
    send(message: RecordingEncodeResponse) {
      this.onmessage?.(new MessageEvent('message', { data: message }));
    }
  }
  Object.defineProperty(globalThis, 'OfflineAudioContext', { configurable: true, value: Decoder });
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: ExportWorker });
  try {
    for (const outcome of ['complete', 'error', 'abort', 'worker-error'] as const) {
      const controller = new AbortController();
      const progress: number[] = [];
      const result = exportRecording(legacyTake, 'mp3', controller.signal, (p) => progress.push(p));
      await new Promise((resolve) => setImmediate(resolve));
      const worker = workers.at(-1);
      assert(worker);
      worker.send({ type: 'progress', progress: 40 });
      assert.deepEqual(progress, [40]);
      if (outcome === 'complete') {
        const blob = new Blob(['encoded'], { type: 'audio/mpeg' });
        worker.send({ type: 'complete', blob });
        assert.deepEqual(await result, { blob, extension: 'mp3' });
      } else {
        const rejected = assert.rejects(result);
        if (outcome === 'abort') controller.abort();
        else if (outcome === 'worker-error') worker.onerror?.();
        else worker.send({ type: 'error', message: 'Cannot encode' });
        await rejected;
      }
      assert(worker.terminated, `${outcome} releases the export worker`);
    }
    assert.equal(workers.length, 4);
  } finally {
    ['OfflineAudioContext', 'Worker'].forEach((key, index) => {
      const descriptor = descriptors[index];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
});
