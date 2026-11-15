import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ModuleDrag } from '../src/components/module-drag';
import { createModule } from '../src/domain/project';

const pointer = (pointerId: number, clientX = 50, clientY = 60) => ({
  pointerId,
  clientX,
  clientY,
});

test('release uses the final world position even if the last move was not delivered', () => {
  const drag = new ModuleDrag();
  const module = createModule('oscillator', -200, 100);
  drag.start(module, pointer(1), { x: -190, y: 120 });
  drag.move(pointer(1, 90, 80), { x: -150, y: 140 });
  // A zoom/pan or a final mouse movement can change the world position at release.
  const released = drag.release(pointer(1, 160, 0), { x: 53, y: -92 });
  assert.equal(released?.id, module.id);
  assert.deepEqual([released?.x, released?.y], [40, -120]);
  assert.deepEqual([module.x, module.y], [-200, 100], 'previews never mutate patch data');
  assert.equal(drag.current, null);
  assert.equal(
    drag.lostCapture(1, 0),
    null,
    'normal post-release capture loss cannot duplicate an edit',
  );
});

test('released capture preserves the last preview if pointerup never reaches the rack', () => {
  const drag = new ModuleDrag();
  const module = createModule('oscillator', 40, 40);
  drag.start(module, pointer(3), { x: 50, y: 60 });
  drag.move(pointer(3, 200, 0), { x: 230, y: -10 });
  const preview = { ...drag.current! };
  assert.deepEqual(drag.lostCapture(3, 0), preview);
  assert.deepEqual([preview.x, preview.y], [220, -20]);
  assert.equal(drag.current, null);
  assert.equal(drag.release(pointer(3), { x: 50, y: 60 }), null);
});

test('other pointers cannot move, replace, finish or cancel an active module drag', () => {
  const drag = new ModuleDrag();
  const module = createModule('filter', 40, 40);
  drag.start(module, pointer(1), { x: 50, y: 60 });
  drag.move(pointer(1, 150, 160), { x: 150, y: 160 });
  const active = drag.current;
  drag.start(createModule('noise', 400, 40), pointer(2), { x: 450, y: 60 });
  assert.equal(drag.current, active);
  assert.equal(drag.move(pointer(2), { x: 0, y: 0 }), null);
  assert.equal(drag.release(pointer(2), { x: 0, y: 0 }), null);
  drag.cancel(2);
  assert.equal(drag.lostCapture(2, 0), null);
  assert.equal(drag.lostCapture(2, 1), null);
  assert.equal(drag.current, active);
  assert.equal(drag.release(pointer(1, 150, 160), { x: 150, y: 160 })?.id, module.id);
});

test('true interruption and explicit cancellation never commit or resurrect a preview', () => {
  const drag = new ModuleDrag();
  const module = createModule('noise', 0, 0);
  for (const cancel of [() => drag.cancel(1), () => drag.cancel(), () => drag.lostCapture(1, 1)]) {
    drag.start(module, pointer(1), { x: 50, y: 60 });
    drag.move(pointer(1, 150, 160), { x: 150, y: 160 });
    cancel();
    assert.equal(drag.current, null);
    assert.equal(drag.lostCapture(1, 0), null);
    assert.equal(drag.release(pointer(1), { x: 150, y: 160 }), null);
  }
});
