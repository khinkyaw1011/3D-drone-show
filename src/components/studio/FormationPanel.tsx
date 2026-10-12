'use client';

import { Box, ImageUp, Sparkles, Type } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FieldGroup } from '@/components/controls/fields';
import { FormationThumb } from '@/components/show/FormationThumb';
import { useShowActions } from '@/components/show/useShowActions';
import { Button } from '@/components/ui/button';
import { MODELS, type ModelName } from '@/engine/formations/sources/model';
import { SHAPES } from '@/engine/formations/sources/shape';
import { IMAGE_ACCEPT } from '@/lib/image';
import { cn } from '@/lib/utils';

function Tile({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-1.5 rounded-lg border border-line p-1.5 text-left transition-colors duration-150 hover:border-white/25 hover:bg-white/[0.04]"
    >
      {children}
      <span className="truncate px-0.5 text-[0.6875rem] text-paper/75 group-hover:text-paper">{label}</span>
    </button>
  );
}

/** Left rail: everything you can add to the show. Each choice appends a formation and flies the fleet to it. */
export function FormationPanel() {
  const t = useTranslations('Studio.library');
  const tOptions = useTranslations('Options');
  const { addFormation, addFromPrompt, addFromFile } = useShowActions();
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    accept: { ...IMAGE_ACCEPT, 'model/gltf-binary': ['.glb'] },
    multiple: false,
    noClick: true,
    noKeyboard: true,
    onDropAccepted: async ([file]) => {
      setBusy(true);
      await addFromFile(file);
      setBusy(false);
    },
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await addFromPrompt(word)) setWord('');
  };

  return (
    <div {...getRootProps()} className={cn('scrollbar-thin h-full space-y-6 overflow-y-auto p-4 outline-none', isDragActive && 'ring-2 ring-inset ring-cyan/50')}>
      <input {...getInputProps()} />

      <FieldGroup title={t('addWord')}>
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="studio-word" className="sr-only">
            {t('wordLabel')}
          </label>
          <input
            id="studio-word"
            value={word}
            maxLength={40}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.nativeEvent.isComposing && e.preventDefault()}
            placeholder={t('wordPlaceholder')}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-cyan"
          />
          <Button type="submit" size="icon" aria-label={t('addWord')} disabled={!word.trim()}>
            <Type />
          </Button>
        </form>
      </FieldGroup>

      <FieldGroup title={t('shapes')}>
        <div className="grid grid-cols-3 gap-2">
          {SHAPES.map((shape) => (
            <Tile key={shape} label={tOptions(`shape.${shape}`)} onClick={() => addFormation('shape', { shape })}>
              <FormationThumb sourceId="shape" input={{ shape }} points={260} className="aspect-square" />
            </Tile>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title={t('models')}>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(MODELS) as ModelName[]).map((model) => (
            <Tile key={model} label={MODELS[model]} onClick={() => addFormation('model', { model })}>
              <FormationThumb sourceId="model" input={{ model }} points={320} className="aspect-square" />
            </Tile>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title={t('upload')}>
        <button
          type="button"
          onClick={open}
          disabled={busy}
          className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-6 text-center transition-colors duration-150 hover:border-cyan/60 hover:bg-cyan/[0.04] disabled:opacity-60"
        >
          <span className="flex gap-2 text-muted-foreground">
            <ImageUp className="size-5" />
            <Box className="size-5" />
            <Sparkles className="size-5" />
          </span>
          <span className="text-sm text-paper">{busy ? t('sampling') : t('dropTitle')}</span>
          <span className="text-xs text-muted-foreground">{t('dropHint')}</span>
        </button>
      </FieldGroup>
    </div>
  );
}
