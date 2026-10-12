'use client';

import { ArrowDown, Rocket } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { FleetStats } from '@/components/show/FleetStats';
import { LiveShow } from '@/components/show/LiveShow';
import { QuickControls } from '@/components/show/QuickControls';
import { ShowGallery } from '@/components/show/ShowGallery';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Button } from '@/components/ui/button';
import { useHydrated } from '@/hooks/useHydrated';
import { useInView } from '@/hooks/useInView';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { dispatch } from '@/store/dispatch';

const STEPS = ['design', 'animate', 'share'] as const;
const FACTS = ['drawCall', 'speed', 'gap', 'aircraft'] as const;

function SectionHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return (
    <header className="max-w-2xl">
      <p className="eyebrow text-cyan">{eyebrow}</p>
      <h2 className="display mt-3 text-4xl text-paper sm:text-5xl">{title}</h2>
      <p className="mt-4 text-base text-paper/70">{lead}</p>
    </header>
  );
}

/** `/`: the live show with its control deck, then the gallery and how it works. */
export function Landing() {
  const t = useTranslations('Landing');
  const hydrated = useHydrated();
  const stage = useRef<HTMLElement>(null);
  const inView = useInView(stage);
  const [started, setStarted] = useState(false);
  // The headline steps aside once the fleet is up, so it never sits on top of the formation.
  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), 9000);
    return () => clearTimeout(timer);
  }, []);

  const start = () => {
    setStarted(true);
    void dispatch({ type: 'playback.seek', t: 0 }).then(() => dispatch({ type: 'playback.play' }));
  };

  return (
    <>
      <SiteHeader overlay />
      <main>
        <section ref={stage} id="show" aria-label={t('stageLabel')} className="relative flex h-svh min-h-[620px] flex-col overflow-hidden">
          {hydrated && <LiveShow paused={!inView} />}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/80 to-transparent" />

          <div
            className={cn(
              'pointer-events-none relative z-10 mx-auto mt-[clamp(72px,13vh,140px)] max-w-3xl px-5 text-center transition-all duration-700 ease-out lg:mr-[420px] xl:mx-auto',
              started && '-translate-y-3 opacity-0',
            )}
            aria-hidden={started}
          >
            <p className="eyebrow text-glow">{t('eyebrow')}</p>
            <h1 className="display mt-3 text-[clamp(2.6rem,9vw,6rem)] text-paper">{t('title')}</h1>
            <p className="mx-auto mt-4 max-w-md text-base text-paper/75 sm:text-lg">{t('tagline')}</p>
            <div className={cn('mt-7 flex flex-wrap items-center justify-center gap-3', !started && 'pointer-events-auto')}>
              <Button size="lg" className="h-11 rounded-full px-6 text-sm" onClick={start} tabIndex={started ? -1 : 0}>
                <Rocket />
                {t('start')}
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 rounded-full bg-ink/40 px-6 text-sm backdrop-blur">
                <Link href="/studio" tabIndex={started ? -1 : 0}>
                  {t('openStudio')}
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-paper/50">{t('hint')}</p>
          </div>

          {/* Bottom sheet on phones, side panel on wide screens: the sky stays clear either way. */}
          <div className="relative z-20 mt-auto w-full px-3 pb-3 sm:px-4 sm:pb-4 lg:absolute lg:bottom-auto lg:right-4 lg:top-[4.5rem] lg:mt-0 lg:w-[380px] lg:p-0">
            {hydrated && <QuickControls />}
          </div>
        </section>

        <section id="gallery" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <SectionHeading eyebrow={t('gallery.eyebrow')} title={t('gallery.title')} lead={t('gallery.lead')} />
          <div className="mt-10">
            <ShowGallery
              onFly={(show) => {
                setStarted(true);
                void dispatch({ type: 'preset.apply', presetId: show.id });
                stage.current?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          </div>
        </section>

        <section id="how" className="border-t border-line bg-ink-2/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <SectionHeading eyebrow={t('how.eyebrow')} title={t('how.title')} lead={t('how.lead')} />
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step} className="rounded-[14px] border border-line bg-ink p-6">
                  <span className="font-mono text-xs text-glow">0{i + 1}</span>
                  <h3 className="mt-3 font-serif text-2xl text-paper">{t(`how.${step}.title`)}</h3>
                  <p className="mt-2 text-sm text-paper/65">{t(`how.${step}.body`)}</p>
                </li>
              ))}
            </ol>
            <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
              {FACTS.map((fact) => (
                <div key={fact}>
                  <dd className="font-serif text-4xl text-paper sm:text-5xl">{t(`facts.${fact}.value`)}</dd>
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
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
