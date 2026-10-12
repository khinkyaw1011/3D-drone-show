'use client';

import { ImageUp, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SHAPES } from '@/engine/formations/sources/shape';
import { useShowActions } from '../useShowActions';
import { Chip } from './Chip';

function Step({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-paper">{title}</h3>
      {children}
      {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
    </section>
  );
}

/** Type a shape name or any words; Enter adds the formation and the fleet flies to it. */
export function PromptForm() {
  const t = useTranslations('Quick');
  const { addFromPrompt } = useShowActions();
  const [prompt, setPrompt] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await addFromPrompt(prompt)) setPrompt('');
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <label htmlFor="quick-prompt" className="sr-only">
        {t('promptLabel')}
      </label>
      <input
        id="quick-prompt"
        value={prompt}
        maxLength={40}
        onChange={(e) => setPrompt(e.target.value)}
        // Enter also confirms a Japanese (IME) conversion: do not submit mid-composition.
        onKeyDown={(e) => e.key === 'Enter' && e.nativeEvent.isComposing && e.preventDefault()}
        placeholder={t('promptPlaceholder')}
        autoComplete="off"
        className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-black/30 px-3.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-cyan"
      />
      <Button type="submit" className="h-10 rounded-lg px-4" disabled={!prompt.trim()}>
        <Sparkles />
        {t('create')}
      </Button>
    </form>
  );
}

/** Every built-in shape, one tap each. */
export function ShapeChips() {
  const t = useTranslations('Quick');
  const tOptions = useTranslations('Options');
  const { addFormation } = useShowActions();
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('pickShape')}>
      {SHAPES.map((shape) => (
        <Chip key={shape} onClick={() => addFormation('shape', { shape })}>
          {tOptions.has(`shape.${shape}`) ? tOptions(`shape.${shape}`) : shape}
        </Chip>
      ))}
    </div>
  );
}

/** Deck tab: add a formation by typing, picking a shape or choosing a file. */
export function CreateTab({ busy, onPickFile }: { busy: boolean; onPickFile: () => void }) {
  const t = useTranslations('Quick');
  return (
    <>
      <Step title={t('typeIt')} hint={t('typeHint')}>
        <PromptForm />
      </Step>
      <Step title={t('pickShape')}>
        <ShapeChips />
      </Step>
      <Step title={t('uploadIt')} hint={t('uploadHint')}>
        <button
          type="button"
          disabled={busy}
          onClick={onPickFile}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/25 px-4 py-4 text-sm text-paper transition-colors duration-150 hover:border-cyan/60 hover:bg-cyan/[0.05] disabled:opacity-60"
        >
          <ImageUp className="size-4" />
          {busy ? t('sampling') : t('uploadButton')}
        </button>
      </Step>
    </>
  );
}
