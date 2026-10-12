import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

export type LocaleParams = { params: Promise<{ locale: string }> };

/** Opt a page into static rendering for its locale. Call first in every page. */
export async function pageLocale({ params }: LocaleParams) {
  const { locale } = await params;
  const resolved = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  setRequestLocale(resolved);
  return resolved;
}

/** `generateMetadata` for a page whose title/description live under `<namespace>.meta`. */
export const pageMetadata =
  (namespace: string) =>
  async ({ params }: LocaleParams): Promise<Metadata> => {
    const { locale } = await params;
    const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace });
    return { title: t('meta.title'), description: t('meta.description') };
  };
