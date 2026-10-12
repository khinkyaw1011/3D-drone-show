import { getTranslations } from 'next-intl/server';
import { PageShell } from '@/components/site/PageShell';
import { type LocaleParams, pageLocale, pageMetadata } from '@/lib/page';

export const generateMetadata = pageMetadata('About');

const TOPICS = ['sampling', 'assignment', 'routes', 'speed', 'rendering', 'limits'] as const;
const CREDITS = [
  { name: 'three.js', detail: 'WebGPU renderer, TSL shaders, example models and fonts (MIT)' },
  { name: 'React Three Fiber · drei · rapier', detail: 'React renderer, camera controls, physics (MIT)' },
  { name: 'GSAP', detail: 'Show clock and easing' },
  { name: 'next-intl', detail: 'English, Japanese and Myanmar localisation (MIT)' },
];

export default async function AboutPage(props: LocaleParams) {
  const locale = await pageLocale(props);
  const t = await getTranslations({ locale, namespace: 'About' });
  return (
    <PageShell eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')}>
      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        {TOPICS.map((topic) => (
          <section key={topic}>
            <h2 className="font-heading text-2xl text-paper">{t(`topics.${topic}.title`)}</h2>
            <p className="mt-2 text-sm leading-relaxed text-paper/70">{t(`topics.${topic}.body`)}</p>
          </section>
        ))}
      </div>
      <section className="mt-14">
        <h2 className="eyebrow">{t('credits')}</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {CREDITS.map((credit) => (
            <li key={credit.name} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between">
              <span className="text-sm text-paper">{credit.name}</span>
              <span className="text-xs text-muted-foreground">{credit.detail}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-sm text-muted-foreground">{t('disclaimer')}</p>
      </section>
    </PageShell>
  );
}
