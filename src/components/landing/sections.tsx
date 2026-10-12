'use client';

import { ArrowDown, ArrowRight, Box, Gauge, ImageUp, Share2, Shapes, Type } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { FleetStats } from '@/components/show/FleetStats';
import { ShowGallery } from '@/components/show/ShowGallery';
import { Button } from '@/components/ui/button';
import { useHydrated } from '@/hooks/useHydrated';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { dispatch } from '@/store/dispatch';

const STEPS = ['design', 'animate', 'share'] as const;
const FEATURES = [
  ['text', Type],
  ['shapes', Shapes],
  ['artwork', ImageUp],
  ['models', Box],
  ['physics', Gauge],
  ['share', Share2],
] as const;
const GUIDE = ['pick', 'create', 'look', 'explore'] as const;
const FAQ = ['files', 'saved', 'devices', 'real'] as const;
const FACTS = ['drawCall', 'speed', 'gap', 'aircraft'] as const;

/** Scroll back up to the live show (the landing page's first section). */
const backToShow = () => document.getElementById('show')?.scrollIntoView({ behavior: 'smooth' });

/** One band of the landing page: a full-width background with its content in the page column. */
export function Section({ id, tinted = false, bordered = true, children }: { id: string; tinted?: boolean; bordered?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={cn(bordered && 'border-t border-line', tinted && 'bg-ink-2/40')}>
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">{children}</div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <header className="max-w-2xl">
      <p className="eyebrow text-cyan">{eyebrow}</p>
      <h2 className="display mt-3 text-4xl text-paper sm:text-5xl">{title}</h2>
      {lead && <p className="mt-4 text-base text-paper/70">{lead}</p>}
    </header>
  );
}

/** A numbered step: used by the quick start (plain) and by "how it works" (as a card). */
function NumberedStep({ index, title, body, card = false }: { index: number; title: string; body: string; card?: boolean }) {
  return (
    <li className={card ? 'rounded-[14px] border border-line bg-ink p-6' : 'border-t border-line pt-5'}>
      <span className="font-mono text-xs text-glow">0{index + 1}</span>
      <h3 className={card ? 'mt-3 font-heading text-2xl text-paper' : 'mt-2 text-base font-medium text-paper'}>{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-paper/65">{body}</p>
    </li>
  );
}

/** The built-in shows; choosing one flies it in the live show above. */
export function GallerySection() {
  const t = useTranslations('Landing');
  return (
    <Section id="gallery" bordered={false}>
      <SectionHeading eyebrow={t('gallery.eyebrow')} title={t('gallery.title')} lead={t('gallery.lead')} />
      <div className="mt-10">
        <ShowGallery
          onFly={(show) => {
            void dispatch({ type: 'preset.apply', presetId: show.id });
            backToShow();
          }}
        />
      </div>
    </Section>
  );
}

export function FeaturesSection() {
  const t = useTranslations('Landing');
  return (
    <Section id="features">
      <SectionHeading eyebrow={t('features.eyebrow')} title={t('features.title')} lead={t('features.lead')} />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([key, Icon]) => (
          <li key={key} className="rounded-[14px] border border-line bg-ink-2/40 p-6">
            <Icon className="size-5 text-glow" aria-hidden="true" />
            <h3 className="mt-4 font-heading text-2xl text-paper">{t(`features.${key}.title`)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-paper/65">{t(`features.${key}.body`)}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function QuickStartSection() {
  const t = useTranslations('Landing');
  return (
    <Section id="quick-start" tinted>
      <SectionHeading eyebrow={t('guide.eyebrow')} title={t('guide.title')} lead={t('guide.lead')} />
      <ol className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {GUIDE.map((step, i) => (
          <NumberedStep key={step} index={i} title={t(`guide.${step}.title`)} body={t(`guide.${step}.body`)} />
        ))}
      </ol>
      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Button size="lg" className="h-11 rounded-full px-6 text-sm" onClick={backToShow}>
          <ArrowDown className="rotate-180" aria-hidden="true" />
          {t('backToShow')}
        </Button>
        <Link href="/guide" className="inline-flex items-center gap-2 text-sm text-paper/70 hover:text-paper">
          {t('guide.more')}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </Section>
  );
}

export function HowItWorksSection() {
  const t = useTranslations('Landing');
  const hydrated = useHydrated();
  return (
    <Section id="how" tinted>
      <SectionHeading eyebrow={t('how.eyebrow')} title={t('how.title')} lead={t('how.lead')} />
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <NumberedStep key={step} card index={i} title={t(`how.${step}.title`)} body={t(`how.${step}.body`)} />
        ))}
      </ol>
      <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
        {FACTS.map((fact) => (
          <div key={fact}>
            <dd className="font-heading text-4xl text-paper sm:text-5xl">{t(`facts.${fact}.value`)}</dd>
            <dt className="eyebrow mt-2">{t(`facts.${fact}.label`)}</dt>
          </div>
        ))}
      </dl>
      <div className="mt-12 flex flex-wrap items-center gap-4">
        <Button asChild size="lg" className="h-11 rounded-full px-6 text-sm">
          <Link href="/studio">{t('openStudio')}</Link>
        </Button>
        <a href="#show" className="inline-flex items-center gap-2 text-sm text-paper/70 hover:text-paper">
          <ArrowDown className="size-4 rotate-180" />
          {t('backToShow')}
        </a>
        {hydrated && <FleetStats className="ml-auto hidden sm:flex" />}
      </div>
    </Section>
  );
}

export function FaqSection() {
  const t = useTranslations('Landing');
  return (
    <Section id="faq">
      <SectionHeading eyebrow={t('faq.eyebrow')} title={t('faq.title')} />
      <dl className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
        {FAQ.map((item) => (
          <div key={item}>
            <dt className="text-base font-medium text-paper">{t(`faq.${item}.q`)}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-paper/65">{t(`faq.${item}.a`)}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
