import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  controllerTargets,
  createDrumPattern,
  drumHitsAtStep,
  DRUM_SOUNDS,
  midiFrequency,
  midiLabel,
} from '../src/domain/instruments';
import {
  connectionError,
  createModule,
  createPerformanceProject,
  createProject,
} from '../src/domain/project';
import { parseProject } from '../src/domain/validation';

test('performance preset round-trips with keyboard, pad and audio routes intact', () => {
  const project = createPerformanceProject();
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))), project);
  const find = (type: string) => project.modules.find((module) => module.type === type)!;
  assert.deepEqual(controllerTargets(project, find('keyboard').id, 'pitch'), [
    find('oscillator').id,
  ]);
  assert.deepEqual(controllerTargets(project, find('pad-controller').id, 'trigger'), [
    find('drum-machine').id,
  ]);
  assert.deepEqual(controllerTargets(project, find('keyboard').id, 'trigger'), []);
});

test('original version-one saves remain valid without any new pattern fields', () => {
  const original = createProject();
  assert.ok(original.modules.every((module) => !('drumPattern' in module)));
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify({ ...original, version: 1 }))), original);
});

test('drum patterns are independent and pattern mute does not erase hits', () => {
  const drums = createModule('drum-machine', 40, 40);
  assert.deepEqual(drumHitsAtStep(drums, 0), ['kick', 'closed-hat']);
  assert.deepEqual(drumHitsAtStep(drums, 4), ['snare', 'closed-hat']);
  assert.deepEqual(drumHitsAtStep(drums, 12), ['snare', 'clap', 'closed-hat']);
  assert.deepEqual(drumHitsAtStep(drums, 16), drumHitsAtStep(drums, 0));
  const other = createDrumPattern();
  drums.drumPattern!.kick[0] = false;
  assert.equal(other.kick[0], true);
  drums.parameters.enabled = false;
  assert.deepEqual(drumHitsAtStep(drums, 4), []);
  assert.equal(drums.drumPattern!.snare[4], true);
});

test('import rejects malformed drum data rather than scheduling unvalidated voices', () => {
  for (const mutate of [
    (drums: ReturnType<typeof createModule>) => {
      drums.drumPattern!.kick.pop();
    },
    (drums: ReturnType<typeof createModule>) => {
      delete drums.drumPattern!.snare;
    },
    (drums: ReturnType<typeof createModule>) => {
      drums.drumPattern!.unknown = Array(16).fill(true);
    },
    (drums: ReturnType<typeof createModule>) => {
      drums.parameters.enabled = 'yes';
    },
    (drums: ReturnType<typeof createModule>) => {
      drums.parameters.decay = 100;
    },
  ]) {
    const project = createPerformanceProject();
    mutate(project.modules.find((module) => module.type === 'drum-machine')!);
    assert.throws(() => parseProject(project));
  }
});

test('trigger cables accept drum inputs, reject pitch/audio inputs, and support fan-out', () => {
  const project = createPerformanceProject();
  const pads = project.modules.find((module) => module.type === 'pad-controller')!;
  const oscillator = project.modules.find((module) => module.type === 'oscillator')!;
  const extra = createModule('drum-machine', 1300, 60);
  project.modules.push(extra);
  const from = { moduleId: pads.id, portId: 'trigger' };
  assert.match(
    connectionError(project, from, { moduleId: oscillator.id, portId: 'pitch' })!,
    /Match socket types/,
  );
  assert.equal(connectionError(project, from, { moduleId: extra.id, portId: 'trigger' }), null);
  project.cables.push({
    id: crypto.randomUUID(),
    from,
    to: { moduleId: extra.id, portId: 'trigger' },
  });
  assert.equal(controllerTargets(project, pads.id, 'trigger').length, 2);
  assert.doesNotThrow(() => parseProject(project));
});

test('chromatic keyboard uses concert pitch independently of the sequencer scale', () => {
  assert.equal(midiFrequency(69), 440);
  assert.equal(midiFrequency(81), 880);
  assert.equal(midiLabel(48), 'C3');
  assert.equal(midiLabel(49), 'C♯3');
  assert.equal(midiLabel(72), 'C5');
  assert.equal(new Set(DRUM_SOUNDS.map((sound) => sound.id)).size, 16);
});
