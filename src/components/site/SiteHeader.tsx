'use client';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link, usePathname } from '@/i18n/navigation';
import { SHOW_PROJECT_PAGE } from '@/lib/site';
import { cn } from '@/lib/utils';
import { FontPicker } from './FontPicker';
import { LocaleSwitcher } from './LocaleSwitcher';
import { Wordmark } from './Wordmark';

const PAGES = [
  { href: '/gallery', key: 'gallery' },
  { href: '/guide', key: 'guide' },
  { href: '/about', key: 'about' },
  { href: '/project', key: 'project' },
] as const;
/** The project page and its links can be switched off from the environment (see `lib/site.ts`). */
export const NAV = PAGES.filter((page) => page.key !== 'project' || SHOW_PROJECT_PAGE);

/** Top navigation for the marketing pages. Floats over the show on the landing page. */
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const t = useTranslations('Site');
  const pathname = usePathname();
  return (
    <header className={cn('inset-x-0 top-0 z-40', overlay ? 'fixed' : 'sticky border-b border-line bg-ink/80 backdrop-blur-xl')}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label={t('home')} className="rounded-md">
          <Wordmark />
        </Link>
        <nav aria-label={t('primaryNav')} className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              className="rounded-md px-3 py-1.5 text-sm text-paper/70 transition-colors duration-150 hover:text-paper aria-[current=page]:text-paper"
            >
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <FontPicker />
          <LocaleSwitcher compact className="md:hidden" />
          <LocaleSwitcher className="hidden md:flex" />
          <Button asChild size="sm" className="hidden rounded-full sm:inline-flex">
            <Link href="/studio">{t('openStudio')}</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label={t('menu')}>
                <Menu />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {[...NAV, { href: '/studio', key: 'studio' } as const].map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href}>{t(`nav.${item.key}`)}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
