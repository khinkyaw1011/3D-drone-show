'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useStudio } from '@/store';

function Stat({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className={cn('font-mono text-xs tabular-nums', warn ? 'text-destructive' : 'text-paper')}>{value}</span>
      <span className="eyebrow">{label}</span>
    </span>
  );
}

/** Live flight telemetry: fleet size, peak speed and closest approach of the transition on stage. */
export function FleetStats({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations('Stats');
  const count = useStudio((s) => Math.min(s.show.droneCount, s.runtime.capabilities?.tier.maxDrones ?? s.show.droneCount));
  const stats = useStudio((s) => s.playback.stats);
  const realistic = useStudio((s) => s.show.flight.realistic);
  return (
    <div className={cn('flex items-center gap-4', className)} aria-live="off">
      <Stat value={count.toLocaleString()} label={t('drones')} />
      {stats && stats.peakSpeed > 0 && <Stat value={stats.peakSpeed.toFixed(1)} label={t('speed')} />}
      {!compact && realistic && stats && stats.minSeparation > 0 && (
        <Stat value={stats.minSeparation.toFixed(1)} label={t('gap')} warn={stats.conflicts > 0} />
      )}
    </div>
  );
}
