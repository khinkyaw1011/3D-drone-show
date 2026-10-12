'use client';

import { useEffect, useRef } from 'react';
import { resolveColors } from '@/engine/formations/colors';
import { SHOW_VOLUME } from '@/engine/formations/fit';
import { droneLookSchema } from '@/engine/presets/schema';
import type { DroneLook } from '@/engine/types';
import { useFormation } from '@/hooks/useFormation';
import { cn } from '@/lib/utils';

const DEFAULT_LOOK = droneLookSchema.parse({});

interface FormationThumbProps {
  sourceId: string;
  input: unknown;
  /** Colours follow this look (show look merged with keyframe overrides). */
  look?: DroneLook;
  /** Dots to draw; small numbers keep lists of thumbnails cheap. */
  points?: number;
  debounceMs?: number;
  className?: string;
  label?: string;
}

/** 2D dot preview of a formation (front view), drawn additively like the real thing. */
export function FormationThumb({ sourceId, input, look = DEFAULT_LOOK, points = 700, debounceMs = 0, className, label }: FormationThumbProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { formation, loading, error } = useFormation(sourceId, input, points, debounceMs);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { width, height } = el.getBoundingClientRect();
    el.width = Math.max(1, Math.round(width * dpr));
    el.height = Math.max(1, Math.round(height * dpr));
    ctx.clearRect(0, 0, el.width, el.height);
    if (!formation) return;

    const colors = resolveColors(formation, look);
    const [vw, vh] = SHOW_VOLUME.size;
    const [cx, cy] = SHOW_VOLUME.center;
    const scale = Math.min(el.width / vw, el.height / vh) * 0.92;
    const radius = Math.max(0.7 * dpr, Math.min(el.width, el.height) / 110);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < formation.count; i++) {
      const x = el.width / 2 + (formation.positions[i * 3] - cx) * scale;
      const y = el.height / 2 - (formation.positions[i * 3 + 1] - cy) * scale;
      ctx.fillStyle = `rgb(${colors[i * 3] * 255} ${colors[i * 3 + 1] * 255} ${colors[i * 3 + 2] * 255} / 0.85)`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [formation, look]);

  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-[#05060a]', className)} role="img" aria-label={label}>
      <canvas ref={canvas} className={cn('size-full transition-opacity duration-200', loading && !formation ? 'opacity-0' : 'opacity-100')} />
      {loading && !formation && <div className="absolute inset-0 animate-pulse bg-white/[0.03]" />}
      {error && (
        <p className="absolute inset-0 flex items-center justify-center p-2 text-center text-[0.6875rem] leading-tight text-destructive">{error}</p>
      )}
    </div>
  );
}
