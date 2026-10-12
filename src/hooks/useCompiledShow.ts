'use client';

import { useEffect, useRef, useState } from 'react';
import type { CompiledShow } from '@/engine/timeline/compile';
import type { Show } from '@/engine/types';
import { isAbort, requestFormation, sampler } from '@/lib/formations';

export interface CompiledState {
  compiled: CompiledShow | null;
  /** The show `compiled` was built from (may lag `show` while regenerating). */
  show: Show | null;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
}

/** Generate every keyframe's formation (cached) and compile the show, all off the main thread. */
export function useCompiledShow(show: Show | null, droneCount?: number): CompiledState {
  const [state, setState] = useState<CompiledState>({ compiled: null, show: null, status: 'loading', error: null });
  // Recompile only for changes that move or recolour drones; glow, sky, camera or FX tweaks must not re-plan the fleet.
  const key = show
    ? JSON.stringify([droneCount ?? show.droneCount, show.id, show.flight, show.look.colorMode, show.look.colors, show.look.gradientAxis, show.keyframes])
    : null;
  const latest = useRef(show);
  useEffect(() => {
    latest.current = show;
  });

  useEffect(() => {
    const show = latest.current;
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
        // Planning runs in the worker: the show keeps flying smoothly while an edit is being worked out.
        const compiled = await sampler().compile(effective, formations);
        if (controller.signal.aborted) return;
        setState({ compiled, show: effective, status: 'ready', error: null });
      } catch (error) {
        if (isAbort(error)) return;
        setState((s) => ({ ...s, status: 'error', error: error instanceof Error ? error.message : String(error) }));
      }
    }, 90);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures every input that matters
  }, [key]);

  return state;
}
