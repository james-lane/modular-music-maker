import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlaybackPosition } from '../src/audio/playback-position';
import { FramePublisher } from '../src/utils/frame-publisher';

test('visual steps follow published audio ticks at independent rates and reset on Stop', () => {
  const position = new PlaybackPosition();
  const snapshots: number[][] = [];
  const unsubscribe = position.subscribe(() =>
    snapshots.push([position.step(1, 16), position.step(2, 8), position.step(4, 8)]),
  );
  assert.equal(position.step(4, 8), -1);
  for (const tick of [0, 1, 2, 3, 4, 16, 32, -1, -1]) position.publish(tick);
  assert.deepEqual(snapshots, [
    [0, 0, 0],
    [1, 0, 0],
    [2, 1, 0],
    [3, 1, 0],
    [4, 2, 1],
    [0, 0, 4],
    [0, 0, 0],
    [-1, -1, -1],
  ]);
  unsubscribe();
  position.publish(0);
  assert.equal(snapshots.length, 8, 'unmounted indicators no longer receive ticks');
  assert.equal(position.step(4, 8), 0, 'a fresh Play starts at the first step');
});

test('rapid gesture views publish the latest frame, and Fit/unmount can discard queued work', () => {
  let id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const views: { x: number; zoom: number }[] = [];
  const publisher = new FramePublisher(
    (view: { x: number; zoom: number }) => views.push(view),
    (callback) => {
      frames.set(++id, callback);
      return id;
    },
    (id) => {
      frames.delete(id);
    },
  );
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(0));
  };
  for (let move = 0; move < 50; move++) publisher.queue({ x: move, zoom: 0.5 + move / 100 });
  assert.equal(frames.size, 1);
  assert.deepEqual(views, []);
  flush();
  assert.deepEqual(views, [{ x: 49, zoom: 0.99 }], 'retain the final gesture position');
  publisher.queue({ x: 50, zoom: 1 });
  publisher.cancel();
  flush();
  assert.equal(views.length, 1, 'no stale gesture can replace a newer Fit/project view');
  publisher.queue({ x: -20, zoom: 0.3 });
  flush();
  assert.deepEqual(views.at(-1), { x: -20, zoom: 0.3 }, 'cleanup does not disable future gestures');
  publisher.queue({ x: 0, zoom: 1 });
  publisher.cancel();
  assert.equal(frames.size, 0, 'unmount releases its animation frame');
});

test('frame publication does not pass its own instance as the browser API receiver', () => {
  // Window animation APIs reject an arbitrary class instance as `this`. Keep the
  // default wrappers covered as well as the injectable scheduler used above.
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  const publisher = new FramePublisher(() => {});
  let requested = false;
  let cancelled = false;
  try {
    globalThis.requestAnimationFrame = function () {
      assert.notEqual(this, publisher);
      requested = true;
      return 7;
    };
    globalThis.cancelAnimationFrame = function (id) {
      assert.notEqual(this, publisher);
      assert.equal(id, 7);
      cancelled = true;
    };
    publisher.queue(1);
    publisher.cancel();
    assert(requested && cancelled);
  } finally {
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  }
});

test('playback view throttling retains the latest gesture and cancels deferred frames', () => {
  let frame: FrameRequestCallback | null = null;
  const published: number[] = [];
  const publisher = new FramePublisher<number>(
    (value) => published.push(value),
    (callback) => {
      frame = callback;
      return 1;
    },
    () => {
      frame = null;
    },
  );
  const advance = (time: number) => {
    const callback = frame as FrameRequestCallback | null;
    frame = null;
    callback?.(time);
  };
  publisher.queue(1, 32);
  advance(0);
  publisher.queue(2, 32);
  advance(16);
  assert.deepEqual(published, [1]);
  publisher.queue(3, 32);
  advance(33);
  assert.deepEqual(published, [1, 3]);
  publisher.queue(4, 32);
  advance(48);
  publisher.cancel();
  advance(66);
  assert.deepEqual(published, [1, 3], 'deferred work cannot replace Fit or a project switch');
});
