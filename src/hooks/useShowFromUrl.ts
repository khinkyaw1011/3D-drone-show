'use client';

import { useEffect, useState } from 'react';
import { getBuiltinShow } from '@/engine/presets/builtin';
import type { Show } from '@/engine/types';
import { showFromHash } from '@/lib/share';

interface UrlShow {
  show: Show | null;
  error: string | null;
  /** True once the URL has been read (always after mount). */
  ready: boolean;
}

/** A show named by the URL: `#s=<compressed show>` (share link) or `?p=<built-in id>` (gallery link). */
export function useShowFromUrl(): UrlShow {
  const [state, setState] = useState<UrlShow>({ show: null, error: null, ready: false });
  useEffect(() => {
    const read = () => {
      try {
        const shared = showFromHash(window.location.hash);
        const preset = new URLSearchParams(window.location.search).get('p');
        setState({ show: shared ?? (preset ? (getBuiltinShow(preset) ?? null) : null), error: null, ready: true });
      } catch (error) {
        setState({ show: null, error: error instanceof Error ? error.message : String(error), ready: true });
      }
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  return state;
}
