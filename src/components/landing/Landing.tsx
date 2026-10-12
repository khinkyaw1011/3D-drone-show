'use client';

import { ArrowDown, ArrowRight, Box, Gauge, ImageUp, Move3d, Share2, Shapes, Type, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { FleetStats } from '@/components/show/FleetStats';
import { LiveShow } from '@/components/show/LiveShow';
import { QuickControls } from '@/components/show/QuickControls';
import { WalkOverlay, useWalking } from '@/components/show/WalkOverlay';
import { ShowGallery } from '@/components/show/ShowGallery';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Button } from '@/components/ui/button';
import { useHydrated } from '@/hooks/useHydrated';
import { useImmersive } from '@/hooks/useImmersive';
import { useInView } from '@/hooks/useInView';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { DEFAULT_SHOW_ID } from '@/engine/presets/builtin';
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

function SectionHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return (
    <header className="max-w-2xl">
      <p className="eyebrow text-cyan">{eyebrow}</p>
      <h2 className="display mt-3 text-4xl text-paper sm:text-5xl">{title}</h2>
      {lead && <p className="mt-4 text-base text-paper/70">{lead}</p>}
    </header>
  );
}

/** `/`: the live show with its control deck, then the gallery and how it works. */
export function Landing() {
  const t = useTranslations('Landing');
  const hydrated = useHydrated();
  const stage = useRef<HTMLElement>(null);
  const inView = useInView(stage);
  const walking = useWalking();
  // The page scrolls like any page until the visitor chooses to step into the show.
  const [exploring, setExploring] = useState(false);
  const immersive = exploring || walking;
  useImmersive(exploring && !walking, () => setExploring(false));
  // Every visit opens on the default show, lifting off from the launch deck by itself.
  const opened = useRef(false);
  useEffect(() => {
    if (!hydrated || opened.current) return;
    opened.current = true;
    void dispatch({ type: 'preset.apply', presetId: DEFAULT_SHOW_ID });
  }, [hydrated]);

  return (
    <>
      {!immersive && <SiteHeader overlay />}
      <main>
        {/* Exploring or walking takes over the whole screen; otherwise the stage is one section of a scrolling page. */}
        <section
          ref={stage}
          id="show"
          aria-label={t('stageLabel')}
          className={cn('flex flex-col overflow-hidden', immersive ? 'fixed inset-0 z-50' : 'relative h-svh min-h-[620px]')}
        >
          {hydrated && <LiveShow interactive={immersive} paused={!inView && !immersive} />}
          {hydrated && <WalkOverlay />}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/80 to-transparent" />

          {/* Same column as every other section (max-w-7xl, centred), so the headline lines up with the page. */}
          <div className="pointer-events-none relative z-10 mx-auto mt-[clamp(72px,12vh,128px)] w-full max-w-7xl px-4 sm:px-6">
            <div
              className={cn(
                // The headline stays with the show; it only steps aside when the visitor enters the 3D view.
                'relative mx-auto max-w-3xl text-center transition-all duration-500 ease-out lg:mx-0 lg:max-w-[26rem] lg:text-left',
                "before:absolute before:-inset-x-10 before:-inset-y-8 before:-z-10 before:rounded-[3rem] before:bg-[radial-gradient(closest-side,rgb(7_8_13/0.78),transparent)] before:content-['']",
                immersive && '-translate-y-3 opacity-0',
              )}
              aria-hidden={immersive}
            >
              <p className="eyebrow text-glow">{t('eyebrow')}</p>
              <h1 className="display mt-3 text-[clamp(2.6rem,9vw,5rem)] text-paper [text-shadow:0_2px_24px_rgb(7_8_13/0.9)] lg:text-6xl">{t('title')}</h1>
              <p className="mx-auto mt-4 max-w-md text-base text-paper/80 [text-shadow:0_1px_12px_rgb(7_8_13/0.9)] sm:text-lg lg:mx-0">{t('tagline')}</p>
              <div className={cn('mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start', !immersive && 'pointer-events-auto')}>
                <Button size="lg" className="h-11 rounded-full px-6 text-sm" onClick={() => setExploring(true)} tabIndex={immersive ? -1 : 0}>
                  <Move3d />
                  {t('explore')}
                </Button>
              </div>
              <p className="mt-4 max-w-sm text-xs leading-relaxed text-paper/55 max-lg:mx-auto">{t('hint')}</p>
            </div>
          </div>

          {/* Always-available way in and out of the 3D view, and a cue that the page continues below. */}
          {hydrated && !walking && (
            <div className="absolute left-3 top-[4.25rem] z-20 sm:left-4">
              <Button
                size="sm"
                variant="outline"
                className="glass rounded-full px-3.5"
                onClick={() => setExploring(!exploring)}
                title={exploring ? undefined : t('exploreHint')}
              >
                {exploring ? <X /> : <Move3d />}
                {exploring ? t('exitExplore') : t('explore')}
              </Button>
              {exploring && <p className="mt-2 max-w-[15rem] text-xs leading-snug text-paper/60">{t('exploreHint')}</p>}
            </div>
          )}
          {!immersive && (
            <a
              href="#gallery"
              className="absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-1.5 text-xs text-paper/55 transition-colors hover:text-paper lg:flex"
            >
              <ArrowDown className="size-3.5" />
              {t('scrollCue')}
            </a>
          )}

          {/* Bottom sheet on phones, side panel on wide screens: the sky stays clear either way. */}
          <div
            className={cn(
              'relative z-20 mt-auto w-full px-3 pb-3 sm:px-4 sm:pb-4 lg:absolute lg:bottom-auto lg:right-4 lg:top-[4.5rem] lg:mt-0 lg:w-[420px] lg:p-0',
              walking && 'hidden',
            )}
          >
            {hydrated && <QuickControls />}
          </div>
        </section>

        <section id="gallery" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <SectionHeading eyebrow={t('gallery.eyebrow')} title={t('gallery.title')} lead={t('gallery.lead')} />
          <div className="mt-10">
            <ShowGallery
              onFly={(show) => {
                void dispatch({ type: 'preset.apply', presetId: show.id });
                stage.current?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          </div>
        </section>

        <section id="features" className="border-t border-line">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
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
          </div>
        </section>

        <section id="quick-start" className="border-t border-line bg-ink-2/40">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
            <SectionHeading eyebrow={t('guide.eyebrow')} title={t('guide.title')} lead={t('guide.lead')} />
            <ol className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {GUIDE.map((step, i) => (
                <li key={step} className="border-t border-line pt-5">
                  <span className="font-mono text-xs text-glow">0{i + 1}</span>
                  <h3 className="mt-2 text-base font-medium text-paper">{t(`guide.${step}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-paper/65">{t(`guide.${step}.body`)}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button size="lg" className="h-11 rounded-full px-6 text-sm" onClick={() => stage.current?.scrollIntoView({ behavior: 'smooth' })}>
                <ArrowDown className="rotate-180" aria-hidden="true" />
                {t('backToShow')}
              </Button>
              <Link href="/guide" className="inline-flex items-center gap-2 text-sm text-paper/70 hover:text-paper">
                {t('guide.more')}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section id="how" className="border-t border-line bg-ink-2/40">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
            <SectionHeading eyebrow={t('how.eyebrow')} title={t('how.title')} lead={t('how.lead')} />
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step} className="rounded-[14px] border border-line bg-ink p-6">
                  <span className="font-mono text-xs text-glow">0{i + 1}</span>
                  <h3 className="mt-3 font-heading text-2xl text-paper">{t(`how.${step}.title`)}</h3>
                  <p className="mt-2 text-sm text-paper/65">{t(`how.${step}.body`)}</p>
                </li>
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
          </div>
        </section>
        <section id="faq" className="border-t border-line">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
            <SectionHeading eyebrow={t('faq.eyebrow')} title={t('faq.title')} lead="" />
            <dl className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
              {FAQ.map((item) => (
                <div key={item}>
                  <dt className="text-base font-medium text-paper">{t(`faq.${item}.q`)}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-paper/65">{t(`faq.${item}.a`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
