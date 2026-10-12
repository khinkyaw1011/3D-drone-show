'use client';

import { useEffect, useState } from 'react';
import type { FormationData } from '@/engine/types';
import { isAbort, requestFormation } from '@/lib/formations';

interface FormationState {
  formation: FormationData | null;
  loading: boolean;
  error: string | null;
}

/** One formation, generated in the worker and cached; debounced so live previews follow slider drags cheaply. */
export function useFormation(sourceId: string, input: unknown, count: number, debounceMs = 0): FormationState {
  const [state, setState] = useState<FormationState>({ formation: null, loading: true, error: null });
  const key = JSON.stringify(input);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, loading: true, error: null }));
      requestFormation(sourceId, JSON.parse(key), count, controller.signal).then(
        (formation) => setState({ formation, loading: false, error: null }),
        (error) => {
          if (!isAbort(error)) setState({ formation: null, loading: false, error: error instanceof Error ? error.message : String(error) });
        },
      );
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [sourceId, key, count, debounceMs]);

  return state;
}
