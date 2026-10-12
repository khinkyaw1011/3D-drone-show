'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { dispatch } from '@/store/dispatch';
import { useStudio } from '@/store';

/** True while the first-person walk view is active. */
export const useWalking = () => useStudio((s) => s.show.scene.cameraPreset === 'walk');

const exitWalk = () => void dispatch({ type: 'scene.set', patch: { cameraPreset: 'spectator' } });

/**
 * Heads-up display for walk mode: how to move, and a way out (button or Esc).
 * While walking, the page behind must not scroll, so keys and drags belong to the 3D world.
 */
export function WalkOverlay() {
  const t = useTranslations('Walk');
  const walking = useWalking();

  useEffect(() => {
    if (!walking) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && exitWalk();
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = 'hidden';
    window.scrollTo({ top: 0 });
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [walking]);

  if (!walking) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-3 p-4 pb-6">
      <p className="glass px-4 py-2 text-center text-xs text-paper/85">
        <span className="hidden [@media(pointer:fine)]:inline">{t('hintKeys')}</span>
        <span className="[@media(pointer:fine)]:hidden">{t('hintTouch')}</span>
      </p>
      <Button size="sm" variant="outline" className="glass pointer-events-auto rounded-full px-4" onClick={exitWalk}>
        <X />
        {t('exit')}
      </Button>
    </div>
  );
}
