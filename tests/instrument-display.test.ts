import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filterMagnitude,
  filterResponsePath,
  lfoPreviewPath,
} from '../src/components/instrument-display';

const yValues = (path: string) =>
  [...path.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((match) => Number(match[1]));

test('LFO preview uses a fixed scale so rate changes spacing, depth changes height and zero depth is flat', () => {
  const slow = lfoPreviewPath(0.5, 500);
  assert.notEqual(slow, lfoPreviewPath(2, 500));
  const small = yValues(slow),
    full = yValues(lfoPreviewPath(0.5, 1500));
  assert.equal(Math.max(...full) - Math.min(...full), 72);
  assert.equal(Math.max(...small) - Math.min(...small), 24);
  assert(yValues(lfoPreviewPath(15, 0)).every((value) => value === 45));
});

test('filter response distinguishes modes, cutoff and resonance with the Web Audio Q conventions', () => {
  const low = filterMagnitude('lowpass', 1000, 6, 100, 48000);
  const high = filterMagnitude('lowpass', 1000, 6, 10000, 48000);
  assert(low > 0.99 && high < 0.01);
  assert(filterMagnitude('highpass', 1000, 6, 10000, 48000) > 0.99);
  assert(filterMagnitude('highpass', 1000, 6, 100, 48000) < 0.02);
  assert(Math.abs(filterMagnitude('lowpass', 1000, 6, 1000, 48000) - 10 ** (6 / 20)) < 1e-9);
  assert(Math.abs(filterMagnitude('bandpass', 1000, 6, 1000, 48000) - 1) < 1e-9);
  assert(
    filterMagnitude('bandpass', 1000, 15, 800, 48000) <
      filterMagnitude('bandpass', 1000, 1, 800, 48000),
  );
  const path = filterResponsePath('lowpass', 1000, 1, 48000);
  assert.notEqual(path, filterResponsePath('lowpass', 7000, 1, 48000));
  assert.notEqual(path, filterResponsePath('lowpass', 1000, 15, 48000));
  assert.notEqual(path, filterResponsePath('highpass', 1000, 1, 48000));
});

test('filter plots remain finite through control extremes, sample rates and modulated cutoff limits', () => {
  for (const rate of [8000, 44100, 48000, 96000])
    for (const mode of ['lowpass', 'highpass', 'bandpass'])
      for (const cutoff of [-1000, 0, 80, 1800, 16000, 100000])
        for (const resonance of [0.1, 2.4, 15]) {
          const path = filterResponsePath(mode, cutoff, resonance, rate);
          assert(!/NaN|Infinity/.test(path));
          assert(yValues(path).every((y) => y >= 4 && y <= 86));
        }
});

test('delay impulse preview responds to time, feedback and mix, with dry-only and single-echo limits', async () => {
  const { delayPreviewPath } = await import('../src/components/instrument-display');
  const path = delayPreviewPath(0.25, 0.5, 0.5);
  assert.notEqual(path, delayPreviewPath(0.5, 0.5, 0.5));
  assert.notEqual(path, delayPreviewPath(0.25, 0.8, 0.5));
  assert.notEqual(path, delayPreviewPath(0.25, 0.5, 1));
  assert.equal((delayPreviewPath(0.25, 0, 0.5).match(/V/g) ?? []).length, 2);
  assert.equal((delayPreviewPath(0.25, 0.8, 0).match(/V/g) ?? []).length, 1);
});
