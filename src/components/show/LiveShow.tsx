'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { reducedFleet } from '@/engine/renderer/capabilities';
import { formatNumber } from '@/lib/utils';
import type { ShowHandle } from '@/components/canvas/ShowCanvas';
import { getShowHandle, setShowHandle } from '@/lib/showHandle';
import { mutate, useStudio } from '@/store';
import { ShowStage } from './ShowStage';

interface LiveShowProps {
  className?: string;
  interactive?: boolean;
  /** Stop rendering (e.g. scrolled off screen). */
  paused?: boolean;
  /** Shift the picture left by this many pixels to clear a panel on the right. */
  offsetX?: number;
}

/**
 * The studio store's show, live. The landing page and the studio both render this, so a
 * show customised on one is the show you find on the other.
 */
export function LiveShow({ className, interactive = true, paused = false, offsetX = 0 }: LiveShowProps) {
  const show = useStudio((s) => s.show);
  const playing = useStudio((s) => s.playback.playing);
  const loop = useStudio((s) => s.playback.loop);
  const speed = useStudio((s) => s.playback.speed);
  const seek = useStudio((s) => s.playback.seek);
  const pushToy = useStudio((s) => s.ui.pushToy);
  const deviceMax = useStudio((s) => s.runtime.deviceMax);
  const t = useTranslations('Stage');

  const onTime = useCallback((time: number, index: number, duration: number) => {
    mutate((s) => {
      s.playback.time = time;
      s.playback.index = index;
      s.playback.duration = duration;
      s.playback.stats = getShowHandle()?.player.stats ?? null;
    });
  }, []);
  const onReady = useCallback((handle: ShowHandle | null) => {
    setShowHandle(handle);
    if (handle) mutate((s) => void (s.runtime.capabilities = handle.capabilities));
  }, []);
  const onStatus = useCallback((status: 'loading' | 'ready' | 'error', error: string | null) => {
    mutate((s) => {
      s.runtime.status = status;
      s.runtime.error = error;
    });
  }, []);
  const onOverload = useCallback(
    (count: number) => {
      const next = reducedFleet(count);
      if (next >= count) return;
      mutate((s) => void (s.runtime.deviceMax = next));
      toast(t('overloadTitle'), { description: t('overloadBody', { count: formatNumber(next) }), duration: 9000 });
    },
    [t],
  );
  const onEnd = useCallback(() => mutate((s) => void (s.playback.playing = false)), []);

  return (
    <ShowStage
      className={className}
      show={show}
      playing={playing && !paused}
      loop={loop}
      speed={speed}
      seek={seek}
      pushToy={pushToy}
      interactive={interactive}
      paused={paused}
      onTime={onTime}
      onReady={onReady}
      onStatus={onStatus}
      onEnd={onEnd}
      offsetX={offsetX}
      maxDrones={deviceMax}
      onOverload={onOverload}
    />
  );
}
