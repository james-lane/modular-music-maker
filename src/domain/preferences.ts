import { CONFIG } from '../config';

/** Device preferences never enter exported patches or their Undo history. */
export type AnimationMode = 'auto' | 'full' | 'reduced';

export function isAnimationMode(value: unknown): value is AnimationMode {
  return value === 'auto' || value === 'full' || value === 'reduced';
}

export function loadAnimationMode(): AnimationMode {
  try {
    const saved = localStorage.getItem(CONFIG.appearance.animationKey);
    if (isAnimationMode(saved)) return saved;
  } catch {
    // Restricted storage still permits changing the current visit's visuals.
  }
  return CONFIG.appearance.defaultAnimation;
}

export function saveAnimationMode(mode: AnimationMode): boolean {
  if (!isAnimationMode(mode)) return false;
  try {
    localStorage.setItem(CONFIG.appearance.animationKey, mode);
    return true;
  } catch {
    return false;
  }
}

export function usesReducedAnimation(
  mode: AnimationMode,
  moduleCount: number,
  systemReduced: boolean,
): boolean {
  return (
    systemReduced ||
    mode === 'reduced' ||
    (mode === 'auto' && moduleCount >= CONFIG.appearance.reducedAnimationModuleCount)
  );
}

export type Theme = 'system' | 'light' | 'dark';

export function isTheme(value: unknown): value is Theme {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(CONFIG.appearance.themeKey);
    if (isTheme(saved)) return saved;
  } catch {
    // Theme selection must also work when browser storage is restricted.
  }
  return CONFIG.appearance.defaultTheme;
}

export function saveTheme(theme: Theme): boolean {
  try {
    localStorage.setItem(CONFIG.appearance.themeKey, theme);
    return true;
  } catch {
    return false;
  }
}

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
