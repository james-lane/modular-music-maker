import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIG } from '../src/config';
import {
  connectedDrumKit,
  drumLiveTailMs,
  drumVoiceLabel,
  kitSamplerSources,
} from '../src/domain/instruments';
import { compatiblePorts } from '../src/domain/module-guides';
import { connectionError, createModule, createPerformanceProject } from '../src/domain/project';
import { decodeSamplePcm, encodeSamplePcm, isValidSamplePcm } from '../src/domain/samples';
import { parseProject } from '../src/domain/validation';

function kitPatch() {
  const project = createPerformanceProject();
  const drums = project.modules.find((module) => module.type === 'drum-machine')!;
  const kit = project.modules.find((module) => module.type === 'drum-kit')!;
  return { project, drums, kit };
}

test('kit links preserve patterns and old patches, accept external audio and reject incompatible or cyclic wiring', () => {
  const { project, drums, kit } = kitPatch();
  const before = structuredClone(drums.drumPattern);
  assert.equal(connectedDrumKit(project, drums.id), kit);
  kit.parameters.kick = 'low-tom';
  assert.equal(drumVoiceLabel(kit, 'kick'), 'Low tom');
  kit.parameters.snare = 'sample';
  kit.samples = {
    snare: { name: 'My snare', pcm: encodeSamplePcm(new Float32Array([0, 0.5, -0.5, 0])) },
  };
  assert.equal(drumVoiceLabel(kit, 'snare'), 'My snare');
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))), project);
  assert.deepEqual(drums.drumPattern, before);
  assert.deepEqual(
    compatiblePorts('drum-kit', 'kit').map((match) => match.module),
    ['drum-machine'],
  );
  const from = { moduleId: kit.id, portId: 'kit' };
  assert.match(
    connectionError(project, from, { moduleId: drums.id, portId: 'trigger' })!,
    /Match socket types/,
  );
  assert.match(
    connectionError(
      project,
      { moduleId: drums.id, portId: 'out' },
      { moduleId: kit.id, portId: 'kick' },
    )!,
    /feedback loop/,
  );
  const oscillator = project.modules.find((module) => module.type === 'oscillator')!;
  assert.equal(
    connectionError(
      project,
      { moduleId: oscillator.id, portId: 'out' },
      { moduleId: kit.id, portId: 'kick' },
    ),
    null,
  );
  project.cables = project.cables.filter((cable) => cable.to.portId !== 'kit');
  assert.equal(connectedDrumKit(project, drums.id), undefined);
  assert.equal(drumVoiceLabel(undefined, 'kick'), 'Kick');
  assert.doesNotThrow(() => parseProject(createPerformanceProject()));
});

test('sample PCM round-trips signed audio and rejects corrupt, odd-length and oversized payloads', () => {
  const input = new Float32Array([0, 1, -1, 0.25, -0.5]);
  const encoded = encodeSamplePcm(input);
  assert.equal(isValidSamplePcm(encoded), true);
  decodeSamplePcm(encoded).forEach((sample, index) =>
    assert.ok(Math.abs(sample - input[index]) < 1 / 32767),
  );
  for (const value of [
    '',
    'hello',
    'AA==',
    'A===',
    'data:audio/wav;base64,AAAA',
    'A'.repeat(CONFIG.samples.maxEncodedLength + 4),
  ])
    assert.equal(isValidSamplePcm(value), false, value.slice(0, 30));
  assert.equal(
    isValidSamplePcm(
      encodeSamplePcm(new Float32Array(CONFIG.samples.sampleRate * CONFIG.samples.maxSeconds)),
    ),
    true,
  );
});

test('untrusted kit data is bounded and scoped to known voices and sample fields', () => {
  for (const mutate of [
    (kit: ReturnType<typeof createModule>) => {
      kit.parameters.kick = 'unknown';
    },
    (kit: ReturnType<typeof createModule>) => {
      kit.samples = { snare: { name: 'Broken', pcm: 'AA==' } };
    },
    (kit: ReturnType<typeof createModule>) => {
      kit.samples = { unknown: { name: 'Unknown', pcm: 'AAAA' } };
    },
    (kit: ReturnType<typeof createModule>) => {
      kit.samples = { snare: { name: '', pcm: 'AAAA' } };
    },
  ]) {
    const { project, kit } = kitPatch();
    mutate(kit);
    assert.throws(() => parseProject(project));
  }
  const { project, drums } = kitPatch();
  drums.samples = { kick: { name: 'Wrong module', pcm: 'AAAA' } };
  assert.throws(() => parseProject(project));
  const full = kitPatch();
  const pcm = encodeSamplePcm(
    new Float32Array(CONFIG.samples.sampleRate * CONFIG.samples.maxSeconds),
  );
  for (let index = 0; index < 5; index++) {
    const kit = createModule('drum-kit', 40, 40);
    kit.samples = { kick: { name: 'Full', pcm } };
    full.project.modules.push(kit);
  }
  assert.throws(() => parseProject(full.project), /storage limit/);
});

test('live idle timing leaves room for long tuned samples and external input envelopes', () => {
  const { project, drums, kit } = kitPatch();
  assert.equal(drumLiveTailMs(project), CONFIG.audio.liveTailMs);
  kit.samples = { kick: { name: 'Long', pcm: encodeSamplePcm(new Float32Array(96000)) } };
  kit.parameters.kick = 'sample';
  drums.parameters.tone = -12;
  drums.parameters.decay = 1.5;
  assert.equal(drumLiveTailMs(project), CONFIG.audio.liveTailMs + 8000);
  kit.parameters.kick = 'input';
  kit.parameters.length = 2;
  assert.equal(drumLiveTailMs(project), CONFIG.audio.liveTailMs + 3000);
});

test('only direct sampler cables supply kit clips, with combined trim/speed/Tone live timing', () => {
  const { project, drums, kit } = kitPatch();
  const sampler = createModule('mic-sampler', 0, 0);
  sampler.samples = { clip: { name: 'Long', pcm: encodeSamplePcm(new Float32Array(96000)) } };
  sampler.parameters = { ...sampler.parameters, trimStart: 0.25, trimEnd: 0.75, rate: 0.5 };
  project.modules.push(sampler);
  project.cables.push({
    id: crypto.randomUUID(),
    from: { moduleId: sampler.id, portId: 'out' },
    to: { moduleId: kit.id, portId: 'kick' },
  });
  kit.parameters.kick = 'input';
  drums.parameters.tone = -12;
  drums.parameters.decay = 0.3;
  assert.equal(kitSamplerSources(project, kit).kick, sampler);
  assert.equal(drumLiveTailMs(project), CONFIG.audio.liveTailMs + 8000);
  const saved = parseProject(JSON.parse(JSON.stringify(project)));
  assert.equal(
    kitSamplerSources(
      saved,
      saved.modules.find((module) => module.id === kit.id),
    ).kick?.id,
    sampler.id,
  );
  project.cables = project.cables.filter((cable) => cable.from.moduleId !== sampler.id);
  assert.deepEqual(kitSamplerSources(project, kit), {});
});

test('sampler resolution crosses serial effects, retains timing and saved wiring, and excludes mixed sources', () => {
  const { project, drums, kit } = kitPatch();
  const sampler = createModule('mic-sampler', 0, 0);
  const filter = createModule('filter', 0, 500);
  const delay = createModule('delay', 350, 500);
  const mixer = createModule('mixer', 700, 500);
  sampler.samples = { clip: { name: 'Long', pcm: encodeSamplePcm(new Float32Array(96000)) } };
  sampler.parameters.rate = 0.5;
  drums.parameters.tone = -12;
  kit.parameters.kick = 'input';
  project.modules.push(sampler, filter, delay, mixer);
  const wire = (from: typeof sampler, to: typeof sampler, portId: string) => ({
    id: crypto.randomUUID(),
    from: { moduleId: from.id, portId: 'out' },
    to: { moduleId: to.id, portId },
  });
  project.cables.push(
    wire(sampler, filter, 'in'),
    wire(filter, delay, 'in'),
    wire(delay, kit, 'kick'),
  );
  assert.equal(kitSamplerSources(project, kit).kick, sampler);
  assert.equal(drumLiveTailMs(project), CONFIG.audio.liveTailMs + 16000);
  const saved = parseProject(JSON.parse(JSON.stringify(project)));
  assert.equal(
    kitSamplerSources(
      saved,
      saved.modules.find((m) => m.id === kit.id),
    ).kick?.id,
    sampler.id,
  );
  project.cables = project.cables.filter((c) => c.to.moduleId !== kit.id || c.to.portId !== 'kick');
  project.cables.push(wire(delay, mixer, 'a'), wire(mixer, kit, 'kick'));
  assert.equal(kitSamplerSources(project, kit).kick, undefined);
});
