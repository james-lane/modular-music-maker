import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createModule, createProject } from '../src/domain/project';
import { PatchHistory } from '../src/domain/history';
import {
  setSwitchSchedule,
  switchInputAtBar,
  switchScheduleError,
  ticksPerBar,
} from '../src/domain/switch-schedule';
import { parseProject } from '../src/domain/validation';

test('Switch bar cues hold sections, repeat on the chosen length, and finish one-shot arrangements', () => {
  const module = createModule('switch', 0, 0);
  module.parameters.automatic = true;
  module.parameters.loopBars = 8;
  module.switchCues = [
    { bar: 5, input: 2 },
    { bar: 1, input: 1 },
    { bar: 7, input: 4 },
  ];
  assert.deepEqual(
    Array.from({ length: 16 }, (_, bar) => switchInputAtBar(module, bar)),
    [1, 1, 1, 1, 2, 2, 4, 4, 1, 1, 1, 1, 2, 2, 4, 4],
  );
  module.parameters.repeat = false;
  assert.equal(switchInputAtBar(module, 1000), 4);
  module.parameters.automatic = false;
  module.parameters.selected = 3;
  assert.equal(switchInputAtBar(module, 1000), 3);
  assert.deepEqual((['4/4', '3/4', '6/8'] as const).map(ticksPerBar), [16, 12, 12]);
});

test('Switch schedule edits validate cue bounds, uniqueness, first bar and repeat coverage', () => {
  const module = createModule('switch', 40, 40);
  const project = { ...createProject(true), modules: [module] };
  const history = new PatchHistory(project);
  const schedule = {
    cues: [
      { bar: 5, input: 3 },
      { bar: 1, input: 2 },
    ],
    repeat: true,
    loopBars: 8,
  };
  history.commit((current) => setSwitchSchedule(current, module.id, schedule));
  assert.deepEqual(history.project.modules[0].switchCues, [...schedule.cues].reverse());
  assert.equal(history.project.modules[0].parameters.automatic, true);
  assert.equal(module.parameters.automatic, false);
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(history.project))), history.project);
  history.undo();
  assert.deepEqual(history.project.modules, project.modules);
  for (const bad of [
    { ...schedule, cues: [] },
    { ...schedule, cues: [{ bar: 2, input: 1 }] },
    {
      ...schedule,
      cues: [
        { bar: 1, input: 1 },
        { bar: 1, input: 2 },
      ],
    },
    { ...schedule, cues: [{ bar: 1, input: 0 }] },
    {
      ...schedule,
      cues: [
        { bar: 1, input: 1 },
        { bar: 1.5, input: 2 },
      ],
    },
    {
      ...schedule,
      cues: [
        { bar: 1, input: 1 },
        { bar: 129, input: 2 },
      ],
    },
    { ...schedule, loopBars: 4 },
    { ...schedule, loopBars: NaN },
    { ...schedule, loopBars: 2.5 },
  ]) {
    assert(switchScheduleError(bad));
    assert.equal(setSwitchSchedule(project, module.id, bad), project);
    assert.throws(() =>
      parseProject({
        ...project,
        modules: [
          {
            ...module,
            parameters: { ...module.parameters, repeat: bad.repeat, loopBars: bad.loopBars },
            switchCues: bad.cues,
          },
        ],
      }),
    );
  }
  assert.throws(() => parseProject({ ...project, modules: [{ ...module, type: 'noise' }] }));
});

test('legacy Switch patches stay manual and retain selection, IDs, positions and source data', () => {
  const module = { ...createModule('switch', -200, 40), parameters: { selected: 4 } };
  delete module.switchCues;
  const project = { ...createProject(true), modules: [module] },
    original = structuredClone(project);
  for (const version of [1, 2]) {
    const migrated = parseProject({ ...project, version });
    assert.equal(migrated.modules[0].parameters.automatic, false);
    assert.equal(migrated.modules[0].parameters.selected, 4);
    assert.equal(migrated.modules[0].switchCues![0].input, 4);
    assert.equal(migrated.modules[0].id, module.id);
    assert.equal(migrated.modules[0].x, -200);
    assert.deepEqual(parseProject(migrated), migrated);
  }
  assert.deepEqual(project, original);
  assert.throws(
    () =>
      parseProject({
        ...project,
        modules: [{ ...module, parameters: { ...module.parameters, automatic: true } }],
      }),
    'partial new schedules must not be silently repaired',
  );
});
