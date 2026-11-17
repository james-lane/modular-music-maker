import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PatchHistory } from '../src/domain/history';
import { moduleDefinition, PAD_LAYOUTS } from '../src/domain/modules';
import { padLabel, padTargets, setPadCount } from '../src/domain/pad-controller';
import { connectionError, createModule, createProject } from '../src/domain/project';
import { parseProject } from '../src/domain/validation';
import { moduleBounds } from '../src/domain/workspace';

function fixture() {
  const pads = createModule('pad-controller', 0, 0);
  const targets = Array.from({ length: 3 }, (_, index) =>
    createModule('mic-sampler', 900 + index * 360, 0),
  );
  const ports = ['trigger', 'pad1', 'pad16'];
  const project = {
    ...createProject(true),
    modules: [pads, ...targets],
    cables: targets.map((target, index) => ({
      id: crypto.randomUUID(),
      from: { moduleId: pads.id, portId: ports[index] },
      to: { moduleId: target.id, portId: 'trigger' },
    })),
  };
  return { project, pads, targets };
}

test('numbered pad routes isolate hits while preserving the shared output and fan-out', () => {
  const { project, pads, targets } = fixture();
  assert.deepEqual(padTargets(project, pads.id, 0), [targets[0].id, targets[1].id]);
  assert.deepEqual(padTargets(project, pads.id, 1), [targets[0].id]);
  assert.deepEqual(padTargets(project, pads.id, 15), [targets[0].id, targets[2].id]);
  const extra = createModule('envelope', 2000, 0);
  project.modules.push(extra);
  project.cables.push({
    id: crypto.randomUUID(),
    from: { moduleId: pads.id, portId: 'pad1' },
    to: { moduleId: extra.id, portId: 'trigger' },
  });
  assert.deepEqual(padTargets(project, pads.id, 0), [targets[0].id, targets[1].id, extra.id]);
  assert.doesNotThrow(() => parseProject(project));
  for (const index of [-1, 16, 1.5, NaN]) assert.deepEqual(padTargets(project, pads.id, index), []);
  assert.deepEqual(padTargets(project, targets[0].id, 0), []);
});

test('pad labels describe sampler/control routing without advertising a different drum sound', () => {
  const { project, pads } = fixture();
  assert.equal(padLabel({ ...project, cables: [] }, pads.id, 1), 'SNARE');
  assert.equal(padLabel({ ...project, cables: project.cables.slice(1) }, pads.id, 0), 'SAMPLE');
  assert.equal(
    padLabel(project, pads.id, 0),
    'PAD 1',
    'multiple receivers use a neutral pad label',
  );
  project.modules[1].type = 'envelope';
  assert.equal(padLabel(project, pads.id, 1), 'ENV');
  project.modules[1].type = 'random-mod';
  assert.equal(padLabel(project, pads.id, 1), 'S&H');
});

test('each pad configuration round-trips and rejects cables to absent or incompatible sockets', () => {
  const { project, pads, targets } = fixture();
  for (const layout of PAD_LAYOUTS) {
    const next = setPadCount(project, pads.id, layout.count);
    assert.deepEqual(parseProject(JSON.parse(JSON.stringify(next))), next);
    const configured = next.modules[0];
    assert.equal(moduleBounds([configured]).width, moduleDefinition(configured).width);
    const empty = { ...next, cables: [] };
    assert.equal(
      connectionError(
        empty,
        { moduleId: pads.id, portId: `pad${layout.count}` },
        { moduleId: targets[0].id, portId: 'trigger' },
      ),
      null,
    );
    assert.match(
      connectionError(
        empty,
        { moduleId: pads.id, portId: `pad${layout.count + 1}` },
        { moduleId: targets[0].id, portId: 'trigger' },
      )!,
      /no longer exists/,
    );
    const oscillator = createModule('oscillator', 2500, 0);
    empty.modules = [...empty.modules, oscillator];
    assert.match(
      connectionError(
        empty,
        { moduleId: pads.id, portId: 'pad1' },
        { moduleId: oscillator.id, portId: 'pitch' },
      )!,
      /Match socket types/,
    );
  }
  for (const count of [0, 12, 5, 16.1, '8', false, null]) {
    const invalid = {
      ...project,
      modules: [{ ...pads, parameters: { ...pads.parameters, padCount: count } }, ...targets],
    };
    assert.throws(() => parseProject(invalid));
    assert.equal(setPadCount(project, pads.id, count), project);
  }
});

test('shrinking removes only discarded pad cables and undo restores the count, routes and position', () => {
  const { project, pads, targets } = fixture();
  const history = new PatchHistory(project);
  history.commit((current) => setPadCount(current, pads.id, 4));
  assert.equal(history.project.modules[0].parameters.padCount, 4);
  assert.deepEqual(history.project.cables, project.cables.slice(0, 2));
  assert.deepEqual(padTargets(history.project, pads.id, 4), []);
  assert.deepEqual(history.project.modules.slice(1), targets);
  history.undo();
  assert.deepEqual(history.project.modules, project.modules);
  assert.deepEqual(history.project.cables, project.cables);
  history.redo();
  assert.equal(history.project.cables.length, 2);
  assert.equal(setPadCount(history.project, pads.id, 4), history.project);
  // Re-expanding offers fresh sockets; only Undo restores a deliberately removed cable.
  assert.equal(setPadCount(history.project, pads.id, 16).cables.length, 2);
});

test('enlarging a pad controller clears neighbours without moving or changing them', () => {
  const pads = createModule('pad-controller', 0, 0);
  pads.parameters.padCount = 4;
  const neighbour = createModule('noise', 330, 0);
  const project = { ...createProject(true), modules: [pads, neighbour] };
  const next = setPadCount(project, pads.id, 16);
  assert.deepEqual(next.modules[1], neighbour);
  assert.notDeepEqual([next.modules[0].x, next.modules[0].y], [pads.x, pads.y]);
  const first = next.modules[0],
    a = moduleDefinition(first),
    b = moduleDefinition(neighbour);
  assert(
    first.x + a.width <= neighbour.x ||
      neighbour.x + b.width <= first.x ||
      first.y + a.height <= neighbour.y ||
      neighbour.y + b.height <= first.y,
  );
  assert.deepEqual(project.modules, [pads, neighbour]);
});

test('legacy controllers gain sixteen outputs without losing routes or mutating stored data', () => {
  const { project, pads } = fixture();
  delete pads.parameters.padCount;
  // A panel just beyond the former 300px width needs clearance after migration.
  project.modules[1].x = 330;
  const stored = structuredClone(project);
  const migrated = parseProject(project);
  assert.equal(migrated.modules[0].parameters.padCount, 16);
  assert.equal(migrated.modules[0].id, pads.id);
  assert.deepEqual(migrated.cables, project.cables);
  assert.deepEqual(migrated.modules.slice(1), project.modules.slice(1));
  assert.notDeepEqual([migrated.modules[0].x, migrated.modules[0].y], [pads.x, pads.y]);
  assert.deepEqual(project, stored);
  assert.deepEqual(parseProject(migrated), migrated, 'migration is idempotent');
  stored.modules[1].x = 900;
  assert.deepEqual([parseProject(stored).modules[0].x, parseProject(stored).modules[0].y], [0, 0]);
});
