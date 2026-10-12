import { defineRouting } from 'next-intl/routing';

export const LOCALES = ['en', 'ja', 'my'] as const;
export type Locale = (typeof LOCALES)[number];

/** Native names for the language switcher. */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', ja: '日本語', my: 'မြန်မာ' };

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: 'en',
  // English lives at `/`, the others at `/ja` and `/my`.
  localePrefix: 'as-needed',
});
