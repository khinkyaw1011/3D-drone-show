'use client';

import { useEffect, useState } from 'react';
import { type CompiledShow, compileShow } from '@/engine/timeline/compile';
import type { Show } from '@/engine/types';
import { isAbort, requestFormation } from '@/lib/formations';

export interface CompiledState {
  compiled: CompiledShow | null;
  /** The show `compiled` was built from (may lag `show` while regenerating). */
  show: Show | null;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
}

/** Generate every keyframe's formation (cached, in the worker) and chain the assignment. */
export function useCompiledShow(show: Show | null, droneCount?: number): CompiledState {
  const [state, setState] = useState<CompiledState>({ compiled: null, show: null, status: 'loading', error: null });

  useEffect(() => {
    if (!show) return;
    const controller = new AbortController();
    const effective = droneCount && droneCount !== show.droneCount ? { ...show, droneCount } : show;
    // Debounce so slider drags do not queue a compile per pixel.
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, status: 'loading', error: null }));
      try {
        const formations = await Promise.all(
          effective.keyframes.map((kf) =>
            requestFormation(kf.formation.sourceId, kf.formation.input, effective.droneCount, controller.signal),
          ),
        );
        if (controller.signal.aborted) return;
        setState({ compiled: compileShow(effective, formations), show: effective, status: 'ready', error: null });
      } catch (error) {
        if (isAbort(error)) return;
        setState((s) => ({ ...s, status: 'error', error: error instanceof Error ? error.message : String(error) }));
      }
    }, 90);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [show, droneCount]);

  return state;
}
