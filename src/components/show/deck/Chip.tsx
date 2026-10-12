import { cn } from '@/lib/utils';

/** Pill button used for formations, shapes, views and colour modes. */
export function Chip({ active, className, ...props }: React.ComponentProps<'button'> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full border border-line bg-white/[0.04] px-3 py-1.5 text-[0.8125rem] text-paper/80 transition-colors duration-150 hover:text-paper',
        active && 'border-glow/70 bg-glow/15 text-paper',
        className,
      )}
      {...props}
    />
  );
}

/** "2×", "0.5×". */
export const speedLabel = (speed: number) => `${Number(speed.toFixed(2))}×`;
