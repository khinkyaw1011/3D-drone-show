'use client';

import { Pause, Play, Rocket, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ShowStage } from '@/components/show/ShowStage';
import { Wordmark } from '@/components/site/Wordmark';
import { Button } from '@/components/ui/button';
import { BUILTIN_SHOWS } from '@/engine/presets/builtin';
import { useShowFromUrl } from '@/hooks/useShowFromUrl';
import { Link } from '@/i18n/navigation';
import { shareHash } from '@/lib/share';

/** `/show`: full-screen, read-only playback of the show named by the URL (share link or gallery preset). */
export function Viewer() {
  const t = useTranslations('Viewer');
  const { show: linked, error, ready } = useShowFromUrl();
  const [playing, setPlaying] = useState(true);
  const [seek, setSeek] = useState<{ t: number; nonce: number } | null>(null);
  const show = linked ?? BUILTIN_SHOWS[0];

  if (!ready) return <div className="fixed inset-0 bg-ink" />;
  if (error)
    return (
      <main className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-ink px-6 text-center">
        <Wordmark />
        <h1 className="display text-4xl text-paper">{t('brokenTitle')}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{t('brokenBody')}</p>
        <Button asChild className="rounded-full px-5">
          <Link href="/gallery">{t('browse')}</Link>
        </Button>
      </main>
    );

  return (
    <main className="fixed inset-0 bg-ink">
      <ShowStage show={show} playing={playing} seek={seek} loop />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-ink/80 to-transparent p-3 sm:p-4 [&>*]:pointer-events-auto">
        <Link href="/" aria-label={t('home')} className="rounded-md">
          <Wordmark />
        </Link>
        <h1 className="min-w-0 truncate font-heading text-lg text-paper/90 sm:text-xl">{show.name}</h1>
      </div>
      <div className="glass absolute inset-x-3 bottom-3 mx-auto flex max-w-md items-center justify-center gap-2 p-2 sm:bottom-4">
        <Button size="sm" className="rounded-full px-4" onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause /> : <Play />}
          {playing ? t('pause') : t('play')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => {
            setSeek((s) => ({ t: 0, nonce: (s?.nonce ?? 0) + 1 }));
            setPlaying(true);
          }}
        >
          <Rocket />
          {t('relaunch')}
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link href={`/studio${shareHash(show)}`}>
            <Wand2 />
            {t('remix')}
          </Link>
        </Button>
      </div>
    </main>
  );
}
