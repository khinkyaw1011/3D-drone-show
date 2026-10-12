'use client';

import { useSyncExternalStore } from 'react';

/** Subscribe to a CSS media query. `fallback` is used during SSR / before hydration. */
export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

/** Tailwind `lg` and up: side panels fit beside the canvas. Below it, panels become bottom sheets. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)', true);
