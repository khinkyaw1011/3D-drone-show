'use client';

import { useEffect, useRef } from 'react';

/**
 * While `active`, the page behind cannot scroll and Esc calls `onExit`: keys, wheel and
 * drags belong to the 3D view. Used by walk mode and the home page's explore mode.
 */
export function useImmersive(active: boolean, onExit: () => void) {
  const exit = useRef(onExit);
  useEffect(() => {
    exit.current = onExit;
  });
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && exit.current();
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = 'hidden';
    window.scrollTo({ top: 0 });
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [active]);
}
