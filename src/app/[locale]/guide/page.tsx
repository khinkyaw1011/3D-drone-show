import { getTranslations } from 'next-intl/server';
import { PageShell } from '@/components/site/PageShell';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { type LocaleParams, pageLocale, pageMetadata } from '@/lib/page';

export const generateMetadata = pageMetadata('Guide');

const STEPS = ['pick', 'create', 'look', 'flight', 'views', 'studio', 'share'] as const;
const KEYS = [
  { id: 'play', keys: ['Space'] },
  { id: 'step', keys: ['←', '→'] },
  { id: 'walk', keys: ['W', 'A', 'S', 'D'] },
  { id: 'undo', keys: ['⌘/Ctrl', 'Z'] },
  { id: 'help', keys: ['?'] },
] as const;

export default async function GuidePage(props: LocaleParams) {
  const locale = await pageLocale(props);
  const t = await getTranslations({ locale, namespace: 'Guide' });
  return (
    <PageShell eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')}>
      <ol className="grid gap-4 md:grid-cols-2">
        {STEPS.map((step, i) => (
          <li key={step} className="rounded-[14px] border border-line bg-ink-2 p-6">
            <span className="font-mono text-xs text-glow">{String(i + 1).padStart(2, '0')}</span>
            <h2 className="mt-3 font-heading text-2xl text-paper">{t(`steps.${step}.title`)}</h2>
            <p className="mt-2 text-sm text-paper/70">{t(`steps.${step}.body`)}</p>
          </li>
        ))}
      </ol>
      <section className="mt-14 max-w-xl">
        <h2 className="font-heading text-3xl text-paper">{t('keys.title')}</h2>
        <dl className="mt-5 divide-y divide-line border-y border-line">
          {KEYS.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-4 py-3">
              <dt className="text-sm text-paper/85">{t(`keys.${row.id}`)}</dt>
              <dd className="flex gap-1">
                {row.keys.map((key) => (
                  <kbd key={key} className="rounded border border-line bg-white/5 px-1.5 py-0.5 font-mono text-xs text-paper/80">
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <Button asChild size="lg" className="mt-12 h-11 rounded-full px-6 text-sm">
        <Link href="/studio">{t('cta')}</Link>
      </Button>
    </PageShell>
  );
}
