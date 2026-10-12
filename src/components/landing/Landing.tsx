'use client';

import { ArrowDown, Move3d, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { LiveShow } from '@/components/show/LiveShow';
import { QuickControls } from '@/components/show/QuickControls';
import { WalkOverlay, useWalking } from '@/components/show/WalkOverlay';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Button } from '@/components/ui/button';
import { useHydrated } from '@/hooks/useHydrated';
import { useImmersive } from '@/hooks/useImmersive';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/utils';
import { BUILTIN_SHOWS } from '@/engine/presets/builtin';
import { useStudio } from '@/store';
import { dispatch } from '@/store/dispatch';
import { FaqSection, FeaturesSection, GallerySection, HowItWorksSection, QuickStartSection } from './sections';

/** The headline over the show. It stays with the show and only steps aside when the visitor enters the 3D view. */
function HeroText({ hidden, onExplore }: { hidden: boolean; onExplore: () => void }) {
  const t = useTranslations('Landing');
  return (
    // Same column as every other section (max-w-7xl, centred), so the headline lines up with the page.
    <div className="pointer-events-none relative z-10 mx-auto mt-[clamp(72px,12vh,128px)] w-full max-w-7xl px-4 sm:px-6">
      <div
        className={cn(
          'relative mx-auto max-w-3xl text-center transition-all duration-500 ease-out lg:mx-0 lg:max-w-[26rem] lg:text-left',
          "before:absolute before:-inset-x-10 before:-inset-y-8 before:-z-10 before:rounded-[3rem] before:bg-[radial-gradient(closest-side,rgb(7_8_13/0.78),transparent)] before:content-['']",
          hidden && '-translate-y-3 opacity-0',
        )}
        aria-hidden={hidden}
      >
        <p className="eyebrow text-glow">{t('eyebrow')}</p>
        <h1 className="display mt-3 text-[clamp(2.6rem,9vw,5rem)] text-paper [text-shadow:0_2px_24px_rgb(7_8_13/0.9)] lg:text-6xl">{t('title')}</h1>
        <p className="mx-auto mt-4 max-w-md text-base text-paper/80 [text-shadow:0_1px_12px_rgb(7_8_13/0.9)] sm:text-lg lg:mx-0">{t('tagline')}</p>
        <div className={cn('mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start', !hidden && 'pointer-events-auto')}>
          <Button size="lg" className="h-11 rounded-full px-6 text-sm" onClick={onExplore} tabIndex={hidden ? -1 : 0}>
            <Move3d />
            {t('explore')}
          </Button>
        </div>
        <p className="mt-4 max-w-sm text-xs leading-relaxed text-paper/55 max-lg:mx-auto">{t('hint')}</p>
      </div>
    </div>
  );
}

/** `/`: the live show with its control deck, then the sections in `./sections`. */
export function Landing() {
  const t = useTranslations('Landing');
  const hydrated = useHydrated();
  const stage = useRef<HTMLElement>(null);
  const inView = useInView(stage);
  const walking = useWalking();
  // The page scrolls like any page until the visitor chooses to step into the show.
  const [exploring, setExploring] = useState(false);
  const immersive = exploring || walking;
  // Every visit opens on a different show, lifting off by itself. Only the formations and the
  // settings the visitor never touched change: everything they tweaked is carried into it.
  const picked = useRef(false);
  useEffect(() => {
    if (!hydrated || picked.current) return;
    picked.current = true;
    const { basedOn, name } = useStudio.getState().show;
    const others = BUILTIN_SHOWS.filter((show) => show.id !== basedOn && show.name !== name);
    const next = others[Math.floor(Math.random() * others.length)];
    if (next) void dispatch({ type: 'preset.apply', presetId: next.id, keepTweaks: true });
  }, [hydrated]);
  useImmersive(exploring && !walking, () => setExploring(false));

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

          <HeroText hidden={immersive} onExplore={() => setExploring(true)} />

          {/* Always-available way in and out of the 3D view (on phones the hero button is the way in, so this
              only appears as the way out), and a cue that the page continues below. */}
          {hydrated && !walking && (
            <div className={cn('absolute left-3 top-[4.25rem] z-20 sm:left-4', !exploring && 'max-lg:hidden')}>
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

        <GallerySection />
        <FeaturesSection />
        <QuickStartSection />
        <HowItWorksSection />
        <FaqSection />
      </main>
      <SiteFooter />
    </>
  );
}
