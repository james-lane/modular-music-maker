import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createModule, createProject } from '../src/domain/project';
import { XY_CORNERS, XY_EFFECTS, xyBlend } from '../src/domain/xy-effects';
import { parseProject } from '../src/domain/validation';

test('XY blending is continuous, bounded, clean at the centre and isolates each corner', () => {
  assert.deepEqual(xyBlend(0, 0, 1), { dry: 1, corners: [0, 0, 0, 0] });
  const positions = [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ];
  positions.forEach(([x, y], corner) => {
    const blend = xyBlend(x, y, 0.7);
    assert.ok(Math.abs(blend.dry - 0.3) < 1e-12);
    assert.deepEqual(
      blend.corners,
      positions.map((_, index) => (index === corner ? 0.7 : 0)),
    );
  });
  for (let x = -1; x <= 1; x += 0.1) {
    for (let y = -1; y <= 1; y += 0.1) {
      const blend = xyBlend(x, y, 1);
      const values = [blend.dry, ...blend.corners];
      assert.ok(values.every((value) => value >= 0 && value <= 1));
      assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
      const adjacent = xyBlend(x + 0.00001, y, 1);
      assert.ok(
        adjacent.corners.every((value, index) => Math.abs(value - blend.corners[index]) < 0.0001),
      );
    }
  }
  assert.equal(xyBlend(100, -100, 100).corners[3], 1);
  assert.deepEqual(xyBlend(1, -1, 0), { dry: 1, corners: [0, 0, 0, 0] });
});

test('XY choices and coordinates round-trip, while invalid or missing settings are rejected', () => {
  const project = createProject(true);
  const module = createModule('xy-effects', 40, 40);
  project.modules.push(module);
  for (const effect of XY_EFFECTS) {
    // Assigning the same effect several times is valid and must remain saveable.
    for (const corner of XY_CORNERS) module.parameters[corner.id] = effect.id;
    Object.assign(module.parameters, { x: -0.73, y: 0.48, mix: 0.62 });
    assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))), project);
  }
  for (const corner of XY_CORNERS) {
    const invalid = structuredClone(project);
    invalid.modules.at(-1)!.parameters[corner.id] = 'not-an-effect';
    assert.throws(() => parseProject(invalid), /Unknown XY Effects/);
    delete invalid.modules.at(-1)!.parameters[corner.id];
    assert.throws(() => parseProject(invalid), /Unknown XY Effects/);
  }
  for (const [parameter, value] of [
    ['x', 1.1],
    ['y', -1.1],
    ['mix', 2],
  ] as const) {
    const invalid = structuredClone(project);
    invalid.modules.at(-1)!.parameters[parameter] = value;
    assert.throws(() => parseProject(invalid), /Invalid XY Effects/);
  }
});
