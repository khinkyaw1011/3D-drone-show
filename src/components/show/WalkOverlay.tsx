'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { walkInput } from '@/lib/walkInput';
import { dispatch } from '@/store/dispatch';
import { useStudio } from '@/store';

const STICK_RANGE = 44; // px the thumb may travel from the centre

/** Thumb-stick for touch screens: drag to walk, release to stop. Writes to the shared walk input. */
function Joystick({ label }: { label: string }) {
  const [thumb, setThumb] = useState({ x: 0, y: 0 });
  const origin = useRef<{ x: number; y: number } | null>(null);

  const release = () => {
    origin.current = null;
    walkInput.strafe = walkInput.forward = 0;
    setThumb({ x: 0, y: 0 });
  };
  useEffect(() => release, []);

  return (
    <div
      role="application"
      aria-label={label}
      className="glass pointer-events-auto absolute bottom-6 left-5 hidden size-28 touch-none select-none rounded-full [@media(pointer:coarse)]:block"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        origin.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!origin.current) return;
        const dx = e.clientX - origin.current.x;
        const dy = e.clientY - origin.current.y;
        const scale = Math.min(1, STICK_RANGE / Math.max(1, Math.hypot(dx, dy)));
        walkInput.strafe = (dx * scale) / STICK_RANGE;
        walkInput.forward = (-dy * scale) / STICK_RANGE;
        setThumb({ x: dx * scale, y: dy * scale });
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span
        className="absolute left-1/2 top-1/2 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper/80 shadow-[0_0_18px_rgb(255_255_255/0.25)]"
        style={{ marginLeft: thumb.x, marginTop: thumb.y }}
      />
    </div>
  );
}

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
      <Joystick label={t('joystick')} />
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
