import assert from 'node:assert/strict';
import test from 'node:test';
import { CONFIG } from '../src/config';
import { clampZoom, touchPair, zoomScroll } from '../src/components/workspace-geometry';

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
  const anchor = { x: (240 + first.midpoint.x) / oldZoom, y: (120 + first.midpoint.y) / oldZoom };
  for (const requested of [(oldZoom * moved.distance) / first.distance, 0.1, 3]) {
    const zoom = clampZoom(requested);
    const scroll = zoomScroll(anchor, moved.midpoint, zoom);
    assert.equal((scroll.x + moved.midpoint.x) / zoom, anchor.x);
    assert.equal((scroll.y + moved.midpoint.y) / zoom, anchor.y);
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
