import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIG } from '../src/config';
import { createModule, createPerformanceProject, createProject } from '../src/domain/project';
import { MODULES } from '../src/domain/modules';
import { parseProject } from '../src/domain/validation';
import { findOpenPosition, moduleBounds, snapPosition } from '../src/domain/workspace';
import {
  fittedView,
  viewAtAnchor,
  worldPoint,
  edgePan,
} from '../src/components/workspace-geometry';
import { braidedCablePaths } from '../src/components/cable-geometry';

test('v1 patches migrate without changing IDs, positions, samples, sound or cables', () => {
  const current = createPerformanceProject();
  const kit = current.modules.find((module) => module.type === 'drum-kit')!;
  kit.samples = { kick: { name: 'Portable sample', pcm: 'AAAAAA==' } };
  kit.parameters.kick = 'sample';
  const legacy = { ...structuredClone(current), version: 1 };
  assert.deepEqual(parseProject(legacy), current);
  assert.equal(legacy.version, 1);
  assert.throws(() => parseProject({ ...legacy, version: 4 }));
  assert.throws(() =>
    parseProject({ ...legacy, modules: [{ ...legacy.modules[0], x: Infinity }] }),
  );
});

test('signed and distant positions save without the old rack border, with finite numeric guards', () => {
  const project = createProject();
  project.modules[0].x = -4200;
  project.modules[0].y = -1600;
  project.modules[1].x = 8500;
  project.modules[1].y = 3100;
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))), project);
  for (const x of [NaN, Infinity, -Infinity, CONFIG.canvas.maxCoordinate + 1]) {
    assert.throws(() => parseProject({ ...project, modules: [{ ...project.modules[0], x }] }));
  }
  assert.deepEqual(snapPosition(-4213, 8511), { x: -4220, y: 8520 });
});

test('camera zoom and pinch translation preserve world anchors in every quadrant', () => {
  for (const x of [-8000, 0, 8500])
    for (const y of [-3500, 0, 9000]) {
      const view = { x, y, zoom: 0.45 };
      const anchor = worldPoint(view, { x: 320, y: 180 });
      const next = viewAtAnchor(anchor, { x: 410, y: 270 }, 1.2);
      const result = worldPoint(next, { x: 410, y: 270 });
      assert.ok(Math.abs(result.x - anchor.x) < 1e-9);
      assert.ok(Math.abs(result.y - anchor.y) < 1e-9);
    }
  assert.deepEqual(edgePan({ x: 300, y: 250 }, { width: 800, height: 600 }), { x: 0, y: 0 });
  assert.ok(edgePan({ x: 2, y: 598 }, { width: 800, height: 600 }).x < 0);
  assert.ok(edgePan({ x: 2, y: 598 }, { width: 800, height: 600 }).y > 0);
});

test('fit includes negative positions and plus-placement keeps finding space near a distant view', () => {
  const modules = [createModule('keyboard', -4000, -2000), createModule('output', 2500, 1000)];
  const bounds = moduleBounds(modules),
    size = { width: 1194, height: 834 };
  const view = fittedView(bounds, size);
  for (const module of modules) {
    const x = (module.x - view.x) * view.zoom,
      y = (module.y - view.y) * view.zoom,
      definition = MODULES[module.type];
    assert.ok(x >= 0 && y >= 0);
    assert.ok(x + definition.width * view.zoom <= size.width + 1e-9);
    assert.ok(y + definition.height * view.zoom <= size.height + 1e-9);
  }
  for (let index = modules.length; index < CONFIG.maxModules; index++) {
    const type = index % 2 === 0 ? 'xy-effects' : 'drum-machine';
    const position = findOpenPosition(type, modules, { x: 8500, y: -5000 });
    const definition = MODULES[type];
    assert.equal(position.x % CONFIG.canvas.grid, 0);
    assert.equal(Math.abs(position.y % CONFIG.canvas.grid), 0);
    for (const other of modules) {
      const size = MODULES[other.type],
        gap = CONFIG.canvas.moduleGap;
      assert.ok(
        position.x >= other.x + size.width + gap ||
          position.x + definition.width + gap <= other.x ||
          position.y >= other.y + size.height + gap ||
          position.y + definition.height + gap <= other.y,
      );
    }
    modules.push(createModule(type, position.x, position.y));
  }
  assert.equal(modules.length, CONFIG.maxModules);
});

test('braid detail stays bounded even for a cable across distant world coordinates', () => {
  const paths = braidedCablePaths(
    { x: -CONFIG.canvas.maxCoordinate, y: 0 },
    { x: CONFIG.canvas.maxCoordinate, y: 2000 },
  );
  for (const strand of Object.values(paths))
    for (const path of Object.values(strand)) {
      assert.ok(path.length < CONFIG.cables.maxBraidSamples * 100);
      assert.ok(!/NaN|Infinity/.test(path));
    }
});

test('fit can recover an overview across the full guarded coordinate range', () => {
  const modules = [
    createModule('keyboard', -CONFIG.canvas.maxCoordinate, -CONFIG.canvas.maxCoordinate),
    createModule('output', CONFIG.canvas.maxCoordinate, CONFIG.canvas.maxCoordinate),
  ];
  const size = { width: 390, height: 600 };
  const view = fittedView(moduleBounds(modules), size);
  assert.ok(view.zoom > 0 && view.zoom < CONFIG.canvas.minZoom);
  for (const module of modules) {
    const x = (module.x - view.x) * view.zoom,
      y = (module.y - view.y) * view.zoom;
    assert.ok(x >= 0 && x <= size.width);
    assert.ok(y >= 0 && y <= size.height);
  }
});
