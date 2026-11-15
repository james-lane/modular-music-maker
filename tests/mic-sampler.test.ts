import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIG } from '../src/config';
import { MicrophoneCapture, type CapturePhase } from '../src/audio/microphone';
import { createModule, createProject } from '../src/domain/project';
import { encodeSamplePcm, sampleWav } from '../src/domain/samples';
import { drumLiveTailMs } from '../src/domain/instruments';
import { parseProject } from '../src/domain/validation';

const sample = { name: 'Clap', pcm: encodeSamplePcm(new Float32Array([0, 0.5, -1, 0])) };

function captureFixture(
  getMedia?: () => Promise<MediaStream>,
  decode?: () => Promise<typeof sample>,
) {
  let stopped = 0;
  let requests = 0;
  const phases: CapturePhase[] = [];
  const stream = { getTracks: () => [{ stop: () => stopped++ }] } as unknown as MediaStream;
  const recorder = {
    state: 'inactive',
    ondataavailable: (_event: { data: Blob }) => {},
    onstop: () => {},
    onerror: () => {},
    start() {
      this.state = 'recording';
    },
    stop() {
      this.state = 'inactive';
      queueMicrotask(() => {
        this.ondataavailable({ data: new Blob(['audio']) });
        this.onstop();
      });
    },
  };
  const capture = new MicrophoneCapture((phase) => phases.push(phase), {
    getMedia:
      getMedia ??
      (async () => {
        requests++;
        return stream;
      }),
    format: () => 'audio/webm',
    createRecorder: () => recorder as unknown as MediaRecorder,
    decode: decode ?? (async () => sample),
  });
  return { capture, recorder, phases, stream, stopped: () => stopped, requests: () => requests };
}

test('microphone capture is opt-in, finishes with portable audio, and releases the device', async () => {
  const f = captureFixture();
  assert.equal(f.requests(), 0);
  const recorded = f.capture.record();
  await Promise.resolve();
  assert.equal(f.recorder.state, 'recording');
  f.capture.finish();
  assert.equal(f.stopped(), 1);
  assert.deepEqual(await recorded, sample);
  assert.deepEqual(f.phases, ['idle', 'requesting', 'recording', 'processing', 'idle']);
});

test('automatic four-second capture limit stops tracks and completes the snippet', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = captureFixture();
  const recorded = f.capture.record();
  await Promise.resolve();
  t.mock.timers.tick(CONFIG.samples.maxSeconds * 1000);
  assert.equal(f.recorder.state, 'inactive');
  assert.equal(f.stopped(), 1);
  assert.deepEqual(await recorded, sample);
});

test('cancel handles pending permission, late grants, active recording, and in-flight decoding', async () => {
  let grant: (stream: MediaStream) => void = () => {};
  const permission = new Promise<MediaStream>((resolve) => {
    grant = resolve;
  });
  const pending = captureFixture(() => permission);
  const request = pending.capture.record();
  pending.capture.cancel();
  grant(pending.stream);
  assert.equal(await request, null);
  assert.equal(pending.stopped(), 1);
  assert.equal(pending.recorder.state, 'inactive');
  assert.equal(pending.phases.at(-1), 'idle');

  const active = captureFixture();
  const recording = active.capture.record();
  await Promise.resolve();
  active.capture.cancel();
  assert.equal(await recording, null);
  assert.equal(active.stopped(), 1);

  let decoded: (value: typeof sample) => void = () => {};
  let decoding: () => void = () => {};
  const beganDecoding = new Promise<void>((resolve) => {
    decoding = resolve;
  });
  const slow = captureFixture(undefined, () => {
    decoding();
    return new Promise((resolve) => {
      decoded = resolve;
    });
  });
  const processing = slow.capture.record();
  await Promise.resolve();
  slow.capture.finish();
  await beganDecoding;
  slow.capture.cancel();
  decoded(sample);
  assert.equal(await processing, null);
  assert.equal(slow.stopped(), 1);
});

test('denied permission and recorder errors recover to idle and release tracks', async () => {
  const denied = captureFixture(async () => {
    throw new DOMException('Denied', 'NotAllowedError');
  });
  await assert.rejects(denied.capture.record(), /permission was denied/);
  assert.equal(denied.phases.at(-1), 'idle');
  const failed = captureFixture();
  const recording = failed.capture.record();
  await Promise.resolve();
  failed.recorder.onerror();
  await assert.rejects(recording, /interrupted/);
  assert.equal(failed.stopped(), 1);
  assert.equal(failed.recorder.state, 'inactive');
  assert.equal(failed.phases.at(-1), 'idle');
});

test('sampler patches round-trip independently, bound PCM/slots, and account for slow playback tails', () => {
  const sampler = createModule('mic-sampler', -100, 100);
  const project = { ...createProject(true), modules: [sampler] };
  assert.doesNotThrow(() => parseProject(project));
  sampler.samples = { clip: sample };
  const saved = parseProject(JSON.parse(JSON.stringify(project)));
  assert.deepEqual(saved, project);
  sampler.samples.clip.pcm = encodeSamplePcm(new Float32Array(96000));
  sampler.parameters.rate = 0.5;
  assert.equal(drumLiveTailMs(project), CONFIG.audio.liveTailMs + 8000);
  sampler.samples.extra = sample;
  assert.throws(() => parseProject(project), /one clip/);
  delete sampler.samples.extra;
  sampler.samples.clip = { name: 'Invalid', pcm: 'AA==' };
  assert.throws(() => parseProject(project), /Invalid sample PCM/);
  sampler.samples.clip = {
    name: 'Oversized',
    pcm: 'A'.repeat(CONFIG.samples.maxEncodedLength + 4),
  };
  assert.throws(() => parseProject(project));
  sampler.samples = {};
  sampler.parameters.rate = 0;
  assert.throws(() => parseProject(project), /Speed/);
});

test('downloaded WAV preserves PCM, duration, channel count and standard headers', async () => {
  const pcm = encodeSamplePcm(new Float32Array([0, 0.5, -1, 0]));
  const blob = sampleWav(pcm);
  const bytes = await blob.arrayBuffer();
  const view = new DataView(bytes);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), 'WAVE');
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), CONFIG.samples.sampleRate);
  assert.equal(view.getUint32(40, true), 8);
  assert.equal(view.getInt16(46, true), 16384);
  assert.equal(view.getInt16(48, true), -32768);
});

test('sampler retriggers are bounded and replacement, Stop, and disposal release owned sources', async () => {
  const { createMicSampler } = await import('../src/audio/mic-sampler');
  class Parameter {
    value = 0;
    setValueAtTime(value: number) {
      this.value = value;
    }
    setTargetAtTime(value: number) {
      this.value = value;
    }
    linearRampToValueAtTime(value: number) {
      this.value = value;
    }
    cancelScheduledValues() {}
  }
  class Node {
    gain = new Parameter();
    playbackRate = new Parameter();
    buffer: unknown;
    connections = new Set<Node>();
    onended: (() => void) | null = null;
    stopped = false;
    startTime = -1;
    stopTime = -1;
    connect(node: Node) {
      this.connections.add(node);
    }
    disconnect() {
      this.connections.clear();
    }
    start(time: number) {
      this.startTime = time;
    }
    stop(time = 0) {
      this.stopped = true;
      this.stopTime = time;
    }
  }
  const sources: Node[] = [];
  const nodes: Node[] = [];
  const context = {
    currentTime: 2,
    createGain() {
      const node = new Node();
      nodes.push(node);
      return node;
    },
    createBufferSource() {
      const node = new Node();
      sources.push(node);
      return node;
    },
    createBuffer(_channels: number, length: number, rate: number) {
      return { duration: length / rate, copyToChannel() {} };
    },
  };
  // The fake models only the native operations owned by this factory, including late onended.
  const runtime = createMicSampler(context as unknown as AudioContext);
  runtime.update({ level: 0.7, rate: 0.5 });
  runtime.trigger?.('kick', 0.8, 2.1);
  assert.equal(sources.length, 0, 'empty sampler is silent');
  runtime.configureSample?.({ name: 'Long', pcm: encodeSamplePcm(new Float32Array(96000)) });
  runtime.trigger?.('kick', 0.8, 2.1);
  assert.equal(sources[0].playbackRate.value, 0.5);
  assert.equal(sources[0].startTime, 2.1);
  assert.equal(sources[0].stopTime, 10.1);
  for (let index = 0; index < 30; index++) runtime.trigger?.('snare', 1, 2.2);
  assert(sources.filter((node) => node.connections.size).length <= CONFIG.audio.maxSamplerTails);
  runtime.configureSample?.(undefined);
  assert(sources.every((node) => node.stopped && !node.connections.size));
  runtime.configureSample?.({ name: 'Again', pcm: 'AAAA' });
  runtime.trigger?.('kick', 1, 3);
  const lateEnded = sources.at(-1)?.onended;
  runtime.silence?.();
  lateEnded?.();
  runtime.dispose();
  assert([...nodes, ...sources].every((node) => !node.connections.size));
});
