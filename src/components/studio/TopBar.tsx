'use client';

import { ChevronDown, Download, FilePlus2, FolderOpen, HelpCircle, Link2, PanelLeft, PanelRight, Redo2, Save, Trash2, Undo2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { toast } from 'sonner';
import { useStore } from 'zustand';
import { LocaleSwitcher } from '@/components/site/LocaleSwitcher';
import { Wordmark } from '@/components/site/Wordmark';
import { useShowActions } from '@/components/show/useShowActions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BUILTIN_SHOWS } from '@/engine/presets/builtin';
import { parseShow } from '@/engine/presets/schema';
import { Link } from '@/i18n/navigation';
import { downloadBlob, safeFilename } from '@/lib/export';
import { SHARE_SOFT_LIMIT, shareHash } from '@/lib/share';
import { mutate, useStudio } from '@/store';

function IconButton({ label, children, ...props }: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Copy a link that carries the whole show in its hash. Exported so the keyboard shortcut can reuse it. */
export function useShareLink() {
  const t = useTranslations('Studio.top');
  return async () => {
    const show = useStudio.getState().show;
    const hash = shareHash(show);
    const url = `${window.location.origin}${window.location.pathname.replace(/\/studio\/?$/, '/show')}${hash}`;
    try {
      await navigator.clipboard.writeText(url);
      if (hash.length > SHARE_SOFT_LIMIT) toast.warning(t('shareLong'), { description: t('shareLongBody') });
      else toast.success(t('shareCopied'));
    } catch {
      toast.error(t('shareFailed'), { description: url.slice(0, 120) });
    }
  };
}

interface TopBarProps {
  onExport: () => void;
  onHelp: () => void;
}

export function TopBar({ onExport, onHelp }: TopBarProps) {
  const t = useTranslations('Studio.top');
  const { run } = useShowActions();
  const share = useShareLink();
  const show = useStudio((s) => s.show);
  const userPresets = useStudio((s) => s.userPresets);
  const canUndo = useStore(useStudio.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useStudio.temporal, (s) => s.futureStates.length > 0);
  const fileInput = useRef<HTMLInputElement>(null);

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      await run({ type: 'show.load', show: parseShow(JSON.parse(await file.text())) });
      toast.success(t('imported', { name: file.name }));
    } catch {
      toast.error(t('importFailed'));
    }
  };
  const exportJson = () => downloadBlob(new Blob([JSON.stringify(show, null, 2)], { type: 'application/json' }), `${safeFilename(show.name)}.json`);

  return (
    <header className="glass flex h-12 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
      <Link href="/" aria-label={t('home')} className="rounded-md px-1">
        <Wordmark compact />
      </Link>
      <label htmlFor="show-name" className="sr-only">
        {t('showName')}
      </label>
      <input
        id="show-name"
        value={show.name}
        maxLength={60}
        onChange={(e) => e.target.value && run({ type: 'show.rename', name: e.target.value })}
        className="min-w-0 flex-1 truncate rounded-md bg-transparent px-2 py-1 font-serif text-lg text-paper outline-none hover:bg-white/5 focus-visible:bg-white/5 sm:max-w-64 sm:flex-none"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1">
            <FolderOpen />
            <span className="hidden sm:inline">{t('shows')}</span>
            <ChevronDown className="size-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[70svh] min-w-60 overflow-y-auto">
          <DropdownMenuLabel>{t('builtIn')}</DropdownMenuLabel>
          {BUILTIN_SHOWS.map((preset) => (
            <DropdownMenuItem key={preset.id} onSelect={() => run({ type: 'preset.apply', presetId: preset.id })}>
              {preset.name}
            </DropdownMenuItem>
          ))}
          {userPresets.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t('saved')}</DropdownMenuLabel>
              {userPresets.map((preset) => (
                <DropdownMenuItem key={preset.id} className="justify-between gap-3" onSelect={() => run({ type: 'preset.apply', presetId: preset.id })}>
                  <span className="truncate">{preset.name}</span>
                  <button
                    type="button"
                    aria-label={t('deleteSaved', { name: preset.name })}
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      void run({ type: 'preset.delete', id: preset.id });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={async () => {
              if (await run({ type: 'preset.save', name: show.name })) toast.success(t('savedToast', { name: show.name }));
            }}
          >
            <Save />
            {t('saveCurrent')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run({ type: 'show.new' })}>
            <FilePlus2 />
            {t('newShow')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
            <Upload />
            {t('importJson')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportJson}>
            <Download />
            {t('exportJson')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => (void importJson(e.target.files?.[0]), (e.target.value = ''))} />

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <IconButton label={t('undo')} disabled={!canUndo} onClick={() => run({ type: 'history.undo' })}>
          <Undo2 />
        </IconButton>
        <IconButton label={t('redo')} disabled={!canRedo} onClick={() => run({ type: 'history.redo' })}>
          <Redo2 />
        </IconButton>
        <span className="mx-1 hidden h-5 w-px bg-line lg:block" />
        <IconButton label={t('toggleLibrary')} className="hidden lg:inline-flex" onClick={() => mutate((s) => void (s.ui.leftOpen = !s.ui.leftOpen))}>
          <PanelLeft />
        </IconButton>
        <IconButton label={t('toggleInspector')} className="hidden lg:inline-flex" onClick={() => mutate((s) => void (s.ui.rightOpen = !s.ui.rightOpen))}>
          <PanelRight />
        </IconButton>
        <IconButton label={t('shortcuts')} className="hidden sm:inline-flex" onClick={onHelp}>
          <HelpCircle />
        </IconButton>
        <LocaleSwitcher compact className="hidden md:flex" />
        <Button variant="outline" size="sm" onClick={share}>
          <Link2 />
          <span className="hidden sm:inline">{t('share')}</span>
        </Button>
        <Button size="sm" onClick={onExport}>
          <Download />
          <span className="hidden sm:inline">{t('export')}</span>
        </Button>
      </div>
    </header>
  );
}
