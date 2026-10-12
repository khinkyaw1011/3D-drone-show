import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
  /** 1-based position in the studio workflow, shown as a badge. */
  step: number;
  title: string;
  /** One line saying what this panel is for. */
  hint: string;
  /** Draw attention to this panel (studio walkthrough). */
  highlight?: boolean;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
  as?: 'aside' | 'section';
}

/** A studio panel: numbered heading, a one-line purpose, then its content. */
export function Panel({ step, title, hint, highlight = false, action, className, children, as: Tag = 'section' }: PanelProps) {
  return (
    <Tag
      aria-label={title}
      className={cn(
        'glass flex min-h-0 flex-col overflow-hidden transition-shadow duration-200',
        highlight && 'border-cyan/70 shadow-[0_0_0_3px_rgb(124_247_228/0.25)]',
        className,
      )}
    >
      <header className="flex shrink-0 items-start gap-2.5 border-b border-line px-3.5 py-2.5">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-glow/15 font-mono text-[0.6875rem] text-glow">{step}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium leading-tight text-paper">{title}</h2>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>
        </div>
        {action}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </Tag>
  );
}
