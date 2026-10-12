'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { NAV } from './SiteHeader';
import { Wordmark } from './Wordmark';

export function SiteFooter() {
  const t = useTranslations('Site');
  return (
    <footer className="relative z-10 border-t border-line bg-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Wordmark />
          <p className="max-w-sm text-sm text-muted-foreground">{t('footerNote')}</p>
        </div>
        <nav aria-label={t('footerNav')} className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {[...NAV, { href: '/studio', key: 'studio' } as const].map((item) => (
            <Link key={item.href} href={item.href} className="text-paper/70 transition-colors hover:text-paper">
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
