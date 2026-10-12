'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALES, LOCALE_NAMES, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/** Language dropdown. Keeps the current page (and its #hash, e.g. a shared show) when switching. */
export function LocaleSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations('Site');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const change = (next: string) =>
    startTransition(() => {
      router.replace(`${pathname}${window.location.search}${window.location.hash}`, { locale: next as Locale, scroll: false });
    });

  return (
    <Select value={locale} onValueChange={change} disabled={pending}>
      <SelectTrigger aria-label={t('language')} size="sm" className={cn('gap-1.5 border-line bg-transparent', compact ? '!h-9 w-auto px-2.5' : 'w-auto min-w-28', className)}>
        <Languages className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {compact ? <span className="font-mono text-xs uppercase">{locale}</span> : <SelectValue />}
      </SelectTrigger>
      <SelectContent align="end">
        {LOCALES.map((code) => (
          <SelectItem key={code} value={code} lang={code}>
            {LOCALE_NAMES[code]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
