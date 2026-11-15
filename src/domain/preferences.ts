import { CONFIG } from '../config';

/** Appearance belongs to the browser, so opening/importing a patch keeps the user's choice. */
export type CableStyle = 'classic' | 'braided';

export function isCableStyle(value: unknown): value is CableStyle {
  return value === 'classic' || value === 'braided';
}

export function loadCableStyle(): CableStyle {
  try {
    const saved = localStorage.getItem(CONFIG.appearance.cableStyleKey);
    if (isCableStyle(saved)) return saved;
  } catch {
    // Private/restricted storage must not prevent the studio from opening.
  }
  return CONFIG.appearance.defaultCableStyle;
}

export function saveCableStyle(style: CableStyle): boolean {
  try {
    localStorage.setItem(CONFIG.appearance.cableStyleKey, style);
    return true;
  } catch {
    return false;
  }
}

export function isCableOpacity(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= CONFIG.appearance.cableOpacity.min &&
    value <= CONFIG.appearance.cableOpacity.max
  );
}

export function loadCableOpacity(): number {
  try {
    const saved = localStorage.getItem(CONFIG.appearance.cableOpacityKey);
    const value: unknown = saved === null ? null : JSON.parse(saved);
    if (isCableOpacity(value)) return value;
  } catch {
    // Invalid or unavailable storage falls back without blocking the studio.
  }
  return CONFIG.appearance.cableOpacity.default;
}

export function saveCableOpacity(opacity: number): boolean {
  if (!isCableOpacity(opacity)) return false;
  try {
    localStorage.setItem(CONFIG.appearance.cableOpacityKey, JSON.stringify(opacity));
    return true;
  } catch {
    return false;
  }
}
