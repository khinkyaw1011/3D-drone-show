'use client';

import { Clapperboard, Palette, Wand2, Wind, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
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

interface DeckTabsProps {
  tab: DeckTab;
  onTab: (tab: DeckTab) => void;
  busy: boolean;
  onPickFile: () => void;
  className?: string;
  /** Sizing of the scrolling area: a capped height inside the panel, or the rest of the sheet. */
  scrollClassName?: string;
}

/** The four tabs with their contents and the footer. Shown inside the panel on wide screens and in a bottom sheet on phones. */
function DeckTabs({ tab, onTab, busy, onPickFile, className, scrollClassName }: DeckTabsProps) {
  const t = useTranslations('Quick');
  return (
    <Tabs value={tab} onValueChange={(value) => onTab(value as DeckTab)} className={cn('gap-0', className)}>
      <TabsList className="mx-3.5 mt-3 grid !h-auto shrink-0 grid-cols-4 gap-1 bg-transparent p-0 sm:mx-4">
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
      <p className="mx-3.5 mt-2.5 shrink-0 text-xs leading-snug text-muted-foreground sm:mx-4">{t(`about.${tab}`)}</p>

      <div className={cn('scrollbar-thin overflow-y-auto overscroll-contain px-3.5 pb-4 pt-3.5 sm:px-4', scrollClassName)}>
        <MissingFiles className="mb-3.5" />
        <TabsContent value="show" className="space-y-4">
          <ShowTab />
        </TabsContent>
        <TabsContent value="create" className="space-y-4">
          <CreateTab busy={busy} onPickFile={onPickFile} />
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
  );
}

/**
 * The show's control deck: everything a visitor needs to make the show their own without
 * opening the studio. This file is only the frame (drop target, transport bar, tab strip);
 * each tab and the transport live in `./deck`. Every control is a command on the shared store.
 */
export function QuickControls({ className, onSheet }: { className?: string; /** Told when the phone sheet opens or closes, so the page can keep the show in view above it. */ onSheet?: (open: boolean) => void }) {
  const t = useTranslations('Quick');
  const { addFromFile } = useShowActions();
  const isDesktop = useIsDesktop();
  // Open beside the show on wide screens; on phones only the transport bar shows until the sheet is opened.
  const [openChoice, setOpen] = useState<boolean | null>(null);
  const open = openChoice ?? isDesktop;
  const sheet = open && !isDesktop;
  useEffect(() => onSheet?.(sheet), [sheet, onSheet]);
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

  const tabs = { tab, onTab: setTab, busy, onPickFile: () => whileBusy(pickFormationFile) };

  return (
    <section
      {...getRootProps({ 'aria-label': t('label') })}
      className={cn(
        'glass w-full outline-none',
        isDragActive && 'border-cyan ring-2 ring-cyan/40',
        className,
      )}
    >
      <input {...getInputProps()} />
      {/* Transport stays reachable even when the deck is collapsed. */}
      <TransportBar open={open} onToggle={() => setOpen(!open)} />

      {/* Wide screens: the tabs open inside the panel, beside the show. */}
      {open && isDesktop && <DeckTabs {...tabs} className="border-t border-line" scrollClassName="max-h-[calc(100svh-19rem)]" />}
      {/* Phones: a bottom sheet, so the settings get room to scroll. It does not dim or block the page:
          the show stays visible above it (the page lifts the picture clear, see `onSheet`), so every
          tweak is seen as it is made. */}
      <Drawer open={sheet} onOpenChange={setOpen} modal={false}>
        <DrawerContent className="h-[58svh] !max-h-[58svh] border-line bg-ink-2/95 shadow-[0_-18px_48px_rgb(0_0_0/0.55)] backdrop-blur-xl">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{t('label')}</DrawerTitle>
            <DrawerDescription>{t(`about.${tab}`)}</DrawerDescription>
          </DrawerHeader>
          <Button variant="ghost" size="icon-sm" className="absolute right-2 top-2 z-10" aria-label={t('collapse')} onClick={() => setOpen(false)}>
            <X />
          </Button>
          <DeckTabs {...tabs} className="min-h-0 flex-1" scrollClassName="min-h-0 flex-1 pb-[max(1rem,env(safe-area-inset-bottom))]" />
        </DrawerContent>
      </Drawer>
    </section>
  );
}
