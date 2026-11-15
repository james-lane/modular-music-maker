import assert from 'node:assert/strict';
import test from 'node:test';
import { CONFIG } from '../src/config';
import {
  clampZoom,
  touchPair,
  viewAtAnchor,
  worldPoint,
} from '../src/components/workspace-geometry';

test('pinching and translating retain the original rack point beneath the finger midpoint', () => {
  const first = touchPair([
    { x: 200, y: 300 },
    { x: 400, y: 300 },
  ]);
  const moved = touchPair([
    { x: 180, y: 320 },
    { x: 480, y: 320 },
  ]);
  const oldZoom = 0.8;
  const anchor = worldPoint({ x: 240, y: 120, zoom: oldZoom }, first.midpoint);
  for (const requested of [(oldZoom * moved.distance) / first.distance, 0.1, 3]) {
    const zoom = clampZoom(requested);
    const next = viewAtAnchor(anchor, moved.midpoint, zoom);
    const retained = worldPoint(next, moved.midpoint);
    assert.ok(Math.abs(retained.x - anchor.x) < 1e-9);
    assert.ok(Math.abs(retained.y - anchor.y) < 1e-9);
    assert(zoom >= CONFIG.canvas.minZoom && zoom <= CONFIG.canvas.maxZoom);
  }
});

test('coincident touches cannot divide by zero when starting a pinch', () => {
  const pair = touchPair([
    { x: 200, y: 200 },
    { x: 200, y: 200 },
  ]);
  assert(Number.isFinite(clampZoom((0.8 * 100) / pair.distance)));
  assert.deepEqual(pair.midpoint, { x: 200, y: 200 });
});
