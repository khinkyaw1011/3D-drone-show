import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Instrument_Serif, Noto_Sans_JP, Noto_Sans_Myanmar } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { routing } from '@/i18n/routing';
import '../globals.css';

const sans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const serif = Instrument_Serif({ variable: '--font-instrument-serif', subsets: ['latin'], weight: '400', style: ['normal', 'italic'] });
// Script fonts load on demand (unicode-range), so they cost nothing on English pages.
const japanese = Noto_Sans_JP({ variable: '--font-noto-jp', weight: ['400', '500', '700'], preload: false });
const myanmar = Noto_Sans_Myanmar({ variable: '--font-noto-myanmar', subsets: ['myanmar'], weight: ['400', '500', '700'], preload: false });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'Meta' });
  return {
    title: { default: t('title'), template: '%s · Skyloom' },
    description: t('description'),
    alternates: { languages: { en: '/', ja: '/ja', my: '/my' } },
  };
}

export const viewport: Viewport = { themeColor: '#07080d', colorScheme: 'dark', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`dark ${sans.variable} ${mono.variable} ${serif.variable} ${japanese.variable} ${myanmar.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NextIntlClientProvider>
          <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
          <Toaster position="bottom-center" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
