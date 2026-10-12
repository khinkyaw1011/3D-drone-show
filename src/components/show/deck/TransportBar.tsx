'use client';

import { ChevronDown, Gauge, Pause, Play, Repeat, Rocket, SkipBack, SkipForward } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useStudio } from '@/store';
import { FleetStats } from '../FleetStats';
import { useShowActions } from '../useShowActions';
import { speedLabel } from './Chip';

/** Speeds the speed button steps through. */
const QUICK_SPEEDS = [0.5, 1, 2, 4];

/** What is on stage right now, with the button that opens and closes the rest of the deck. */
function StatusLine({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const t = useTranslations('Quick');
  const playing = useStudio((s) => s.playback.playing);
  const started = useStudio((s) => s.playback.time > 0);
  const index = useStudio((s) => s.playback.index);
  const total = useStudio((s) => s.show.keyframes.length);
  const name = useStudio((s) => s.show.keyframes[s.playback.index]?.name);
  const status = playing ? 'playing' : started ? 'paused' : 'standby';
  return (
    <header className="flex items-center gap-3 px-3.5 pt-2.5 sm:px-4">
      <span className="flex items-center gap-2 rounded-full border border-line bg-black/25 px-2.5 py-1">
        <span
          className={cn(
            'size-2 rounded-full',
            status === 'playing' ? 'animate-pulse bg-emerald-300 shadow-[0_0_10px] shadow-emerald-300' : status === 'paused' ? 'bg-glow' : 'bg-muted-foreground',
          )}
        />
        <span className="eyebrow !text-paper/80">{t(`status.${status}`)}</span>
      </span>
      <p className="min-w-0 flex-1 truncate text-sm text-paper/85">{name ? t('formationOf', { index: index + 1, total, name }) : t('empty')}</p>
      <Button variant="ghost" size="icon-sm" aria-expanded={open} aria-label={open ? t('collapse') : t('expand')} onClick={onToggle}>
        <ChevronDown className={cn('transition-transform duration-200', !open && 'rotate-180')} />
      </Button>
    </header>
  );
}

/** How far through the show the playhead is. */
function ProgressLine() {
  const progress = useStudio((s) => (s.playback.duration > 0 ? s.playback.time / s.playback.duration : 0));
  return (
    <div className="mx-3.5 h-[3px] overflow-hidden rounded-full bg-white/10 sm:mx-4" aria-hidden="true">
      <div className="h-full origin-left bg-gradient-to-r from-glow to-cyan" style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}

/** Play, step, relaunch, loop and speed. */
function TransportButtons() {
  const t = useTranslations('Quick');
  const { run } = useShowActions();
  const playing = useStudio((s) => s.playback.playing);
  const loop = useStudio((s) => s.playback.loop);
  const speed = useStudio((s) => s.playback.speed);
  return (
    <div className="flex flex-wrap items-center gap-2 px-3.5 py-3 sm:px-4">
      <Button size="sm" className="rounded-full px-4 max-[380px]:px-3" onClick={() => run({ type: 'playback.toggle' })}>
        {playing ? <Pause /> : <Play />}
        {/* The narrowest phones keep the whole transport on one row by dropping this label. */}
        <span className="max-[380px]:sr-only">{playing ? t('pause') : t('play')}</span>
      </Button>
      <Button variant="outline" size="icon-sm" aria-label={t('previous')} onClick={() => run({ type: 'playback.step', direction: -1 })}>
        <SkipBack />
      </Button>
      <Button variant="outline" size="icon-sm" aria-label={t('next')} onClick={() => run({ type: 'playback.step', direction: 1 })}>
        <SkipForward />
      </Button>
      <Button
        variant="outline"
        size="sm"
        aria-label={t('relaunch')}
        title={t('relaunch')}
        className="max-sm:px-2"
        onClick={() => run({ type: 'playback.seek', t: 0 }, { type: 'playback.play' })}
      >
        <Rocket />
        <span className="max-sm:sr-only">{t('relaunch')}</span>
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={t('loop')}
        aria-pressed={loop}
        className={cn(loop && 'border-cyan/60 text-cyan')}
        onClick={() => run({ type: 'playback.setLoop', loop: !loop })}
      >
        <Repeat />
      </Button>
      {/* Speed is one tap away even with the deck collapsed; the slider in the Show tab sets any value. */}
      <Button
        variant="outline"
        size="sm"
        aria-label={`${t('speed')}: ${speedLabel(speed)}`}
        title={t('speed')}
        className={cn('ml-auto min-w-[4.25rem] px-2.5 font-mono text-xs', speed !== 1 && 'border-cyan/60 text-cyan')}
        onClick={() => run({ type: 'playback.setSpeed', speed: QUICK_SPEEDS.find((next) => next > speed) ?? QUICK_SPEEDS[0] })}
      >
        <Gauge />
        {speedLabel(speed)}
      </Button>
    </div>
  );
}

/** The part of the deck that is always visible, collapsed or not: status, fleet stats, progress and transport. */
export function TransportBar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <>
      <StatusLine open={open} onToggle={onToggle} />
      <FleetStats className="flex-wrap gap-x-4 gap-y-1 px-3.5 py-2 sm:px-4" />
      <ProgressLine />
      <TransportButtons />
    </>
  );
}
