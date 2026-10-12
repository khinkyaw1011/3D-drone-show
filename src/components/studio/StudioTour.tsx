'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export const TOUR_STEPS = ['library', 'timeline', 'inspector', 'share'] as const;
export type TourStep = (typeof TOUR_STEPS)[number];

interface StudioTourProps {
  /** Index into TOUR_STEPS, or null when the tour is closed. */
  step: number | null;
  onStep: (step: number | null) => void;
}

/**
 * A four-step walkthrough of the studio. It does not block the interface: the panel a
 * step talks about is highlighted behind this card, and everything stays usable.
 */
export function StudioTour({ step, onStep }: StudioTourProps) {
  const t = useTranslations('Studio.tour');
  if (step === null) return null;
  const id = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;
  return (
    <div
      role="dialog"
      aria-label={t('label')}
      className="glass absolute inset-x-3 top-1/2 z-40 mx-auto max-w-sm -translate-y-1/2 border-cyan/40 p-5 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-[24rem] sm:-translate-x-1/2"
    >
      <p className="eyebrow !text-cyan">{t('progress', { step: step + 1, total: TOUR_STEPS.length })}</p>
      <h2 className="mt-2 font-serif text-2xl leading-tight text-paper">{t(`${id}.title`)}</h2>
      <p className="mt-2 text-sm text-paper/75">{t(`${id}.body`)}</p>
      <div className="mt-5 flex items-center gap-2">
        <Button variant="ghost" size="sm" className="mr-auto text-muted-foreground" onClick={() => onStep(null)}>
          {t('skip')}
        </Button>
        {step > 0 && (
          <Button variant="outline" size="sm" onClick={() => onStep(step - 1)}>
            {t('back')}
          </Button>
        )}
        <Button size="sm" onClick={() => onStep(last ? null : step + 1)}>
          {last ? t('done') : t('next')}
        </Button>
      </div>
    </div>
  );
}
