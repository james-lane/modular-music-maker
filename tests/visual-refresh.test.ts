import assert from 'node:assert/strict';
import { test } from 'node:test';
import { refreshVisual } from '../src/components/visual-refresh';

test('display work stops outside the view, while hidden, and after disposal; returning draws the current signal', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const listeners = new Set<() => void>();
  let hidden = false;
  let visibility: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
  let disconnected = false;
  let reads = 0;
  const original = new Map(
    ['document', 'innerHeight', 'innerWidth', 'IntersectionObserver'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const define = (key: string, value: unknown) =>
    Object.defineProperty(globalThis, key, { configurable: true, value });
  define('document', {
    get visibilityState() {
      return hidden ? 'hidden' : 'visible';
    },
    addEventListener(_name: string, callback: () => void) {
      listeners.add(callback);
    },
    removeEventListener(_name: string, callback: () => void) {
      listeners.delete(callback);
    },
  });
  define('innerHeight', 600);
  define('innerWidth', 400);
  define(
    'IntersectionObserver',
    class {
      constructor(callback: typeof visibility) {
        visibility = callback;
      }
      observe() {}
      disconnect() {
        disconnected = true;
      }
    },
  );
  // Only the surface bounds are required: the timer never owns a DOM or audio node.
  const element = {
    getBoundingClientRect: () => ({ top: 20, bottom: 80, left: 20, right: 180 }),
  } as Element;
  try {
    const dispose = refreshVisual(
      element,
      () => {
        reads++;
      },
      true,
      250,
    );
    assert.equal(reads, 1);
    t.mock.timers.tick(249);
    assert.equal(reads, 1);
    t.mock.timers.tick(1);
    assert.equal(reads, 2);
    visibility?.([{ isIntersecting: false }]);
    t.mock.timers.tick(1000);
    assert.equal(reads, 2);
    visibility?.([{ isIntersecting: true }]);
    assert.equal(reads, 3);
    hidden = true;
    listeners.forEach((listener) => listener());
    t.mock.timers.tick(1000);
    assert.equal(reads, 3);
    hidden = false;
    listeners.forEach((listener) => listener());
    assert.equal(reads, 4);
    dispose();
    assert(disconnected);
    assert.equal(listeners.size, 0);
    visibility?.([{ isIntersecting: true }]);
    t.mock.timers.tick(1000);
    assert.equal(reads, 4);
    const stopIdle = refreshVisual(
      element,
      () => {
        reads++;
      },
      false,
      250,
    );
    t.mock.timers.tick(1000);
    assert.equal(reads, 5, 'stopped displays draw once without polling');
    stopIdle();
  } finally {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    t.mock.timers.reset();
  }
});
