import { useLayoutEffect, useState } from 'react';
import { loadTheme, type Theme } from '../domain/preferences';

/** CSS owns system-mode resolution, including the background before React first renders. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', getComputedStyle(root).backgroundColor);
}

export function useTheme() {
  const [theme, setTheme] = useState(loadTheme);

  useLayoutEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme(theme);
    update();
    // Keep the browser chrome in step with live system changes as well as the studio CSS.
    system.addEventListener('change', update);
    return () => system.removeEventListener('change', update);
  }, [theme]);

  return { theme, setTheme };
}
