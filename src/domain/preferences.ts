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
