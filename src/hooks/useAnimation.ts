import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { loadAnimationMode, usesReducedAnimation } from '../domain/preferences';

export const AnimationContext = createContext({ reduced: false, systemReduced: false });
export const useAnimation = () => useContext(AnimationContext);

export function useAnimationPreference(moduleCount: number) {
  const [mode, setMode] = useState(loadAnimationMode);
  const [systemReduced, setSystemReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useLayoutEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setSystemReduced(media.matches);
    changed();
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const reduced = usesReducedAnimation(mode, moduleCount, systemReduced);
  useLayoutEffect(() => {
    document.documentElement.dataset.animation = reduced ? 'reduced' : 'full';
    return () => {
      delete document.documentElement.dataset.animation;
    };
  }, [reduced]);
  const policy = useMemo(() => ({ reduced, systemReduced }), [reduced, systemReduced]);
  return { mode, setMode, policy };
}
