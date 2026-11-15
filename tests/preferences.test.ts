import assert from 'node:assert/strict';
import test from 'node:test';
import { CONFIG } from '../src/config';
import {
  loadCableOpacity,
  loadCableStyle,
  saveCableOpacity,
  saveCableStyle,
} from '../src/domain/preferences';

test('cable appearance persists independently of saved patches and rejects unknown styles', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const entries = new Map<string, string>([[CONFIG.storageKey, 'existing patch data']]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
    },
  });
  try {
    assert.equal(loadCableStyle(), 'classic');
    assert.equal(loadCableOpacity(), 1);
    for (const opacity of [0, 0.35, 1]) {
      assert.equal(saveCableOpacity(opacity), true);
      assert.equal(loadCableOpacity(), opacity);
    }
    assert.equal(saveCableStyle('braided'), true);
    assert.equal(loadCableStyle(), 'braided');
    assert.equal(entries.get(CONFIG.storageKey), 'existing patch data');
    assert.equal(saveCableStyle('classic'), true);
    assert.equal(loadCableStyle(), 'classic');
    entries.set(CONFIG.appearance.cableStyleKey, 'unsupported');
    assert.equal(loadCableStyle(), 'classic');
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('cable opacity rejects corrupt, nonnumeric, and out-of-range preferences', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let saved = '0.45';
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value;
      },
    },
  });
  try {
    for (const opacity of [-0.01, 1.01, NaN, Infinity, -Infinity]) {
      assert.equal(saveCableOpacity(opacity), false);
      assert.equal(loadCableOpacity(), 0.45);
    }
    for (const invalid of ['', 'null', 'true', '"0.5"', '{}', '[]', '-0.1', '1.1', 'NaN']) {
      saved = invalid;
      assert.equal(loadCableOpacity(), 1);
    }
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('unavailable browser storage keeps cable appearance usable for the current visit', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('Storage unavailable');
    },
  });
  try {
    assert.equal(loadCableStyle(), 'classic');
    assert.equal(saveCableStyle('braided'), false);
    assert.equal(loadCableOpacity(), 1);
    assert.equal(saveCableOpacity(0.4), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
