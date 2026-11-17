import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIG } from '../src/config';
import { AUDIO_FACTORIES } from '../src/audio/factories';
import { connectionError, createModule, createProject } from '../src/domain/project';
import { parseProject } from '../src/domain/validation';

test('Switch accepts audio, rejects event cables, occupied inputs and cycles, and saves its selection', () => {
  const project = createProject(true);
  const selector = createModule('switch', 300, 60);
  const sources = Array.from({ length: 4 }, () => createModule('oscillator', 40, 40));
  const lfo = createModule('lfo', 40, 40);
  project.modules.push(selector, ...sources, lfo);
  for (const [index, source] of sources.entries()) {
    const from = { moduleId: source.id, portId: 'out' };
    const to = { moduleId: selector.id, portId: `in${index + 1}` };
    assert.equal(connectionError(project, from, to), null);
    project.cables.push({ id: crypto.randomUUID(), from, to });
  }
  assert.match(
    connectionError(
      project,
      { moduleId: lfo.id, portId: 'out' },
      { moduleId: selector.id, portId: 'in1' },
    )!,
    /Match socket types/,
  );
  assert.match(
    connectionError(
      project,
      { moduleId: sources[0].id, portId: 'out' },
      { moduleId: selector.id, portId: 'in1' },
    )!,
    /already has a cable/,
  );
  const next = createModule('switch', 700, 60);
  project.modules.push(next);
  project.cables.push({
    id: crypto.randomUUID(),
    from: { moduleId: selector.id, portId: 'out' },
    to: { moduleId: next.id, portId: 'in1' },
  });
  project.cables = project.cables.filter(
    (cable) => cable.to.moduleId !== selector.id || cable.to.portId !== 'in4',
  );
  assert.match(
    connectionError(
      project,
      { moduleId: next.id, portId: 'out' },
      { moduleId: selector.id, portId: 'in4' },
    )!,
    /feedback loop/,
  );
  for (const selected of [1, 2, 3, 4]) {
    selector.parameters.selected = selected;
    assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))), project);
  }
  for (const selected of [0, 5, 1.5, '2', Number.NaN, undefined]) {
    const invalid = structuredClone(project);
    const module = invalid.modules.find((module) => module.id === selector.id)!;
    if (selected === undefined) delete module.parameters.selected;
    else module.parameters.selected = selected;
    assert.throws(() => parseProject(invalid));
  }
});

test('Switch closes unused inputs, smoothly retargets rapid changes and releases its whole graph', () => {
  const nodes: ReturnType<typeof makeNode>[] = [];
  function makeNode() {
    return {
      gain: {
        value: 1,
        targets: [] as { value: number; time: number; smoothing: number }[],
        holds: [] as number[],
        cancelAndHoldAtTime(time: number) {
          this.holds.push(time);
        },
        cancelScheduledValues() {},
        setTargetAtTime(value: number, time: number, smoothing: number) {
          this.targets.push({ value, time, smoothing });
        },
      },
      connections: new Set<unknown>(),
      connect(node: unknown) {
        this.connections.add(node);
      },
      disconnect() {
        this.connections.clear();
      },
    };
  }
  const context = {
    currentTime: 3,
    createGain() {
      const node = makeNode();
      nodes.push(node);
      return node;
    },
  };
  // The fake only checks scheduling and ownership; production-browser QA checks actual audio.
  const runtime = AUDIO_FACTORIES.switch(context as unknown as AudioContext, {} as AudioNode);
  const inputs = Object.values(runtime.inputs) as unknown as ReturnType<typeof makeNode>[];
  assert.equal(new Set(inputs).size, 4);
  assert(inputs.every((input) => input.gain.value === 0));
  const originalNodes = [...nodes];
  for (const selected of [1, 4, 2, 3, 1]) {
    runtime.update({ selected });
    assert.deepEqual(
      inputs.map((input) => input.gain.targets.at(-1)?.value),
      [1, 2, 3, 4].map((input) => Number(input === selected)),
    );
    assert(inputs.every((input) => input.connections.has(runtime.outputs.out)));
    assert(
      inputs.every(
        (input) => input.gain.targets.at(-1)?.smoothing === CONFIG.audio.parameterRampSeconds,
      ),
    );
    assert(inputs.every((input) => input.gain.targets.at(-1)?.time === context.currentTime));
    context.currentTime += 0.005;
  }
  assert.deepEqual(nodes, originalNodes, 'selection changes allocate no nodes or sources');
  runtime.selectInput!(2, context.currentTime + 1);
  assert(inputs.every((input) => input.gain.targets.at(-1)?.time === context.currentTime + 1));
  runtime.update({ selected: 3 });
  assert(
    inputs.every((input) => input.gain.holds.at(-1) === context.currentTime),
    'manual takeover cancels queued cues at the audio time',
  );
  runtime.silence!();
  assert(inputs.every((input) => input.gain.targets.at(-1)?.value === 0));
  runtime.dispose();
  assert(nodes.every((node) => node.connections.size === 0));
});
