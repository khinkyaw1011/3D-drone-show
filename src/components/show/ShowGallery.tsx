'use client';

import { Play, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { BUILTIN_SHOWS } from '@/engine/presets/builtin';
import type { Show } from '@/engine/types';
import { Link } from '@/i18n/navigation';
import { FormationThumb } from './FormationThumb';

interface ShowGalleryProps {
  /** When set, cards get a primary button that flies the show on this page instead of opening the viewer. */
  onFly?: (show: Show) => void;
}

function ShowCard({ show, onFly }: { show: Show; onFly?: (show: Show) => void }) {
  const t = useTranslations('Gallery');
  const hero = show.keyframes[Math.min(1, show.keyframes.length - 1)] ?? show.keyframes[0];
  return (
    <article className="group flex flex-col overflow-hidden rounded-[14px] border border-line bg-ink-2 transition-colors duration-200 hover:border-white/20">
      <div className="relative">
        {hero && (
          <FormationThumb
            sourceId={hero.formation.sourceId}
            input={hero.formation.input}
            look={{ ...show.look, ...hero.look }}
            points={900}
            label={t('previewOf', { name: show.name })}
            className="aspect-[3/2] rounded-none"
          />
        )}
        <div className="absolute inset-x-3 bottom-3 flex gap-1.5">
          {show.keyframes.slice(0, 5).map((kf) => (
            <FormationThumb
              key={kf.id}
              sourceId={kf.formation.sourceId}
              input={kf.formation.input}
              look={{ ...show.look, ...kf.look }}
              points={220}
              label={kf.name}
              className="size-10 rounded-md border border-line bg-ink/80"
            />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-serif text-2xl leading-tight text-paper">{show.name}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{t.has(`shows.${show.id}`) ? t(`shows.${show.id}`) : null}</p>
        </div>
        <p className="eyebrow mt-auto">{t('meta', { formations: show.keyframes.length, drones: show.droneCount })}</p>
        <div className="flex flex-wrap gap-2">
          {onFly ? (
            <Button size="sm" className="rounded-full px-4" onClick={() => onFly(show)}>
              <Play />
              {t('fly')}
            </Button>
          ) : (
            <Button asChild size="sm" className="rounded-full px-4">
              <Link href={`/show?p=${show.id}`}>
                <Play />
                {t('watch')}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="rounded-full px-4">
            <Link href={`/studio?p=${show.id}`}>
              <Wand2 />
              {t('remix')}
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

/** The built-in shows as cards with dot previews drawn from the same formation data the drones fly. */
export function ShowGallery({ onFly }: ShowGalleryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {BUILTIN_SHOWS.map((show) => (
        <ShowCard key={show.id} show={show} onFly={onFly} />
      ))}
    </div>
  );
}
