'use client';

import { Type } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DEFAULT_FONTS, FONT_CHOICES, FONT_SLOTS } from '@/lib/fonts';
import { useStudio } from '@/store';
import { dispatch } from '@/store/dispatch';

/** Applies the chosen typefaces to the whole site by re-pointing the theme's two font slots. Renders nothing. */
export function FontPrefs() {
  const body = useStudio((s) => s.ui.fontBody);
  const heading = useStudio((s) => s.ui.fontHeading);
  useEffect(() => {
    const root = document.documentElement.style;
    for (const [slot, choice] of [['fontBody', body], ['fontHeading', heading]] as const) {
      // The default is what the slot falls back to; anything else is set inline.
      if (choice === DEFAULT_FONTS[slot]) root.removeProperty(FONT_SLOTS[slot]);
      else root.setProperty(FONT_SLOTS[slot], `var(--font-${choice})`);
    }
  }, [body, heading]);
  return null;
}

/** "Aa" menu: one typeface for body text, one for headings. Remembered on this device. */
export function FontPicker({ className }: { className?: string }) {
  const t = useTranslations('Site.fonts');
  const body = useStudio((s) => s.ui.fontBody);
  const heading = useStudio((s) => s.ui.fontHeading);
  const group = (label: string, value: string, choices: Record<string, string>, key: 'fontBody' | 'fontHeading') => (
    <>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={value} onValueChange={(next) => void dispatch({ type: 'ui.set', patch: { [key]: next } })}>
        {Object.entries(choices).map(([id, name]) => (
          <DropdownMenuRadioItem key={id} value={id} style={{ fontFamily: `var(--font-${id})` }}>
            {name}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className={className} aria-label={t('label')} title={t('label')}>
          <Type />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {group(t('sans'), body, FONT_CHOICES.body, 'fontBody')}
        <DropdownMenuSeparator />
        {group(t('serif'), heading, FONT_CHOICES.heading, 'fontHeading')}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
