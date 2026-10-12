'use client';

import { Clapperboard, Palette, Wand2, Wind } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { Link } from '@/i18n/navigation';
import { MODEL_ACCEPT } from '@/lib/files';
import { IMAGE_ACCEPT } from '@/lib/image';
import { cn } from '@/lib/utils';
import { CreateTab } from './deck/CreateTab';
import { FlightTab, LookTab } from './deck/LookTab';
import { ShowTab } from './deck/ShowTab';
import { TransportBar } from './deck/TransportBar';
import { MissingFiles, usePickFormationFile } from './FileTools';
import { ScopeReset } from './settings';
import { useShowActions } from './useShowActions';

const DECK_TABS = [
  { id: 'show', icon: Clapperboard },
  { id: 'create', icon: Wand2 },
  { id: 'look', icon: Palette },
  { id: 'flight', icon: Wind },
] as const;
type DeckTab = (typeof DECK_TABS)[number]['id'];

/**
 * The show's control deck: everything a visitor needs to make the show their own without
 * opening the studio. This file is only the frame (drop target, transport bar, tab strip);
 * each tab and the transport live in `./deck`. Every control is a command on the shared store.
 */
export function QuickControls({ className }: { className?: string }) {
  const t = useTranslations('Quick');
  const { addFromFile } = useShowActions();
  const isDesktop = useIsDesktop();
  // Open beside the show on wide screens; collapsed to the transport bar on phones so the sky stays visible.
  const [openChoice, setOpen] = useState<boolean | null>(null);
  const open = openChoice ?? isDesktop;
  const [tab, setTab] = useState<DeckTab>('show');
  const [busy, setBusy] = useState(false);

  /** Picking and dropping a file share one busy state, shown on the upload button. */
  const whileBusy = async (work: () => Promise<unknown>) => {
    setBusy(true);
    await work();
    setBusy(false);
  };
  const pickFormationFile = usePickFormationFile();
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { ...IMAGE_ACCEPT, ...MODEL_ACCEPT },
    multiple: false,
    noClick: true,
    noKeyboard: true,
    onDropAccepted: ([file]) => whileBusy(() => addFromFile(file)),
  });

  return (
    <section
      {...getRootProps({ 'aria-label': t('label') })}
      className={cn(
        'glass w-full outline-none',
        // On a phone the open deck sits over the page: make it opaque enough that nothing shows through it.
        open && 'max-lg:!bg-ink/92',
        isDragActive && 'border-cyan ring-2 ring-cyan/40',
        className,
      )}
    >
      <input {...getInputProps()} />
      {/* Transport stays reachable even when the deck is collapsed. */}
      <TransportBar open={open} onToggle={() => setOpen(!open)} />

      {open && (
        <Tabs value={tab} onValueChange={(value) => setTab(value as DeckTab)} className="gap-0 border-t border-line">
          <TabsList className="mx-3.5 mt-3 grid !h-auto grid-cols-4 gap-1 bg-transparent p-0 sm:mx-4">
            {DECK_TABS.map(({ id, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="!h-auto flex-col gap-1 rounded-lg border border-transparent py-2 text-xs data-[state=active]:border-line data-[state=active]:bg-white/10 data-[state=active]:text-cyan"
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(`tabs.${id}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <p className="mx-3.5 mt-2.5 text-xs leading-snug text-muted-foreground sm:mx-4">{t(`about.${tab}`)}</p>

          <div className="scrollbar-thin max-h-[36svh] overflow-y-auto overscroll-contain px-3.5 pb-4 pt-3.5 sm:px-4 lg:max-h-[calc(100svh-19rem)]">
            <MissingFiles className="mb-3.5" />
            <TabsContent value="show" className="space-y-4">
              <ShowTab />
            </TabsContent>
            <TabsContent value="create" className="space-y-4">
              <CreateTab busy={busy} onPickFile={() => whileBusy(pickFormationFile)} />
            </TabsContent>
            <TabsContent value="look" className="space-y-5">
              <LookTab />
            </TabsContent>
            <TabsContent value="flight" className="space-y-6">
              <FlightTab />
            </TabsContent>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
              <span className="text-xs text-muted-foreground">{t('autosaved')}</span>
              <ScopeReset scope="all" label={t('resetAll')} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('studioPitch')}{' '}
              <Link href="/studio" className="text-cyan underline-offset-4 hover:underline">
                {t('openStudio')}
              </Link>
            </p>
          </div>
        </Tabs>
      )}
    </section>
  );
}
