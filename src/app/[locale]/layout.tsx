import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, Fraunces, Geist, Geist_Mono, Instrument_Serif, Inter, Manrope, Noto_Sans_JP, Noto_Sans_Myanmar, Playfair_Display, Space_Grotesk } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FontPrefs } from '@/components/site/FontPicker';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { routing } from '@/i18n/routing';
import '../globals.css';

const sans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const serif = Instrument_Serif({ variable: '--font-instrument-serif', subsets: ['latin'], weight: '400', style: ['normal', 'italic'] });
// Alternatives offered by the font picker (`src/lib/fonts.ts`). Not preloaded: fetched only once chosen.
const inter = Inter({ variable: '--font-inter', subsets: ['latin'], preload: false });
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'], preload: false });
const grotesk = Space_Grotesk({ variable: '--font-grotesk', subsets: ['latin'], preload: false });
const playfair = Playfair_Display({ variable: '--font-playfair', subsets: ['latin'], preload: false });
const fraunces = Fraunces({ variable: '--font-fraunces', subsets: ['latin'], preload: false });
const dmSerif = DM_Serif_Display({ variable: '--font-dmserif', subsets: ['latin'], weight: '400', preload: false });
const choices = [inter, manrope, grotesk, playfair, fraunces, dmSerif];
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
      className={`dark ${sans.variable} ${mono.variable} ${serif.variable} ${japanese.variable} ${myanmar.variable} ${choices.map((font) => font.variable).join(' ')} h-full antialiased`}
    >
      <body className="min-h-full">
        <NextIntlClientProvider>
          <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
          <FontPrefs />
          <Toaster position="bottom-center" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
