import { cn } from '@/lib/utils';

/** Skyloom mark: a tiny constellation and the name set in the display serif. */
export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 24 24" className="size-5 text-glow" aria-hidden="true">
        {[
          [12, 4],
          [5, 10],
          [19, 10],
          [8, 19],
          [16, 19],
          [12, 12],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={i === 5 ? 2 : 1.4} fill="currentColor" />
        ))}
      </svg>
      {!compact && <span className="font-serif text-xl leading-none tracking-tight text-paper">Skyloom</span>}
    </span>
  );
}
