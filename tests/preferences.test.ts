import assert from 'node:assert/strict';
import test from 'node:test';
import { CONFIG } from '../src/config';
import {
  loadCableOpacity,
  loadCableStyle,
  loadTheme,
  saveCableOpacity,
  saveCableStyle,
  saveTheme,
} from '../src/domain/preferences';

test('theme follows the system by default and remembers overrides independently of patch data', () => {
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
    assert.equal(loadTheme(), 'system');
    for (const theme of ['dark', 'light', 'system'] as const) {
      assert.equal(saveTheme(theme), true);
      assert.equal(loadTheme(), theme);
      assert.equal(entries.get(CONFIG.storageKey), 'existing patch data');
    }
    for (const invalid of ['', 'auto', 'DARK', 'null', '{}']) {
      entries.set(CONFIG.appearance.themeKey, invalid);
      assert.equal(loadTheme(), 'system');
    }
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

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

test('unavailable browser storage keeps appearance usable for the current visit', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('Storage unavailable');
    },
  });
  try {
    assert.equal(loadTheme(), 'system');
    assert.equal(saveTheme('dark'), false);
    assert.equal(loadCableStyle(), 'classic');
    assert.equal(saveCableStyle('braided'), false);
    assert.equal(loadCableOpacity(), 1);
    assert.equal(saveCableOpacity(0.4), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
