'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { ShowHandle } from '@/components/canvas/ShowCanvas';
import type { StageProps } from '@/components/canvas/Stage';
import { cn } from '@/lib/utils';

// WebGPU needs the browser: never server-render the canvas.
const ShowCanvas = dynamic(() => import('@/components/canvas/ShowCanvas'), { ssr: false });

const NOTICE_KEY = 'skyloom:webgl-notice';

interface ShowStageProps extends StageProps {
  className?: string;
  /** Hide the "launching" overlay (e.g. when the page has its own). */
  quiet?: boolean;
}

/** Drifting dots that read as drones waiting on the ground. */
function LaunchLoader({ label, hidden }: { label: string; hidden: boolean }) {
  return (
    <div
      aria-hidden={hidden}
      role="status"
      className={cn(
        'pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-ink transition-opacity duration-700 ease-out',
        hidden && 'opacity-0',
      )}
    >
      <div className="grid grid-cols-5 gap-2.5">
        {Array.from({ length: 15 }, (_, i) => (
          <span
            key={i}
            className="size-1.5 animate-pulse rounded-full bg-glow shadow-[0_0_10px_var(--glow)]"
            style={{ animationDelay: `${((i * 7) % 15) * 90}ms`, animationDuration: '1.6s' }}
          />
        ))}
      </div>
      <p className="eyebrow">{label}</p>
    </div>
  );
}

/**
 * The live show plus its loading / error / fallback states. Every page that shows drones
 * (landing, studio, viewer) renders this, so those states look and behave the same everywhere.
 */
export function ShowStage({ className, quiet = false, onStatus, onReady, ...stage }: ShowStageProps) {
  const t = useTranslations('Stage');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [everReady, setEverReady] = useState(false);

  const handleStatus = useCallback<NonNullable<StageProps['onStatus']>>(
    (next, message) => {
      setStatus(next);
      setError(message);
      if (next === 'ready') setEverReady(true);
      onStatus?.(next, message);
    },
    [onStatus],
  );

  const handleReady = useCallback(
    (handle: ShowHandle | null) => {
      onReady?.(handle);
      if (!handle || handle.capabilities.webgpu) return;
      // Tell people once per session why they see fewer drones.
      try {
        if (sessionStorage.getItem(NOTICE_KEY)) return;
        sessionStorage.setItem(NOTICE_KEY, '1');
      } catch {
        /* private mode: showing the notice again is harmless */
      }
      toast(t('fallbackTitle'), { description: t('fallbackBody', { count: handle.capabilities.tier.maxDrones }), duration: 8000 });
    },
    [onReady, t],
  );

  return (
    <div className={cn('absolute inset-0 overflow-hidden bg-ink', className)}>
      <ShowCanvas {...stage} onStatus={handleStatus} onReady={handleReady} />
      {!quiet && <LaunchLoader label={t('launching')} hidden={everReady} />}
      {status === 'error' && (
        <div role="alert" className="glass absolute inset-x-4 top-20 z-20 mx-auto max-w-md p-4 text-sm">
          <p className="font-medium text-destructive">{t('errorTitle')}</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </div>
      )}
    </div>
  );
}
