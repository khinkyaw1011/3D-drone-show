'use client';

import { Layers, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { FleetStats } from '@/components/show/FleetStats';
import { LiveShow } from '@/components/show/LiveShow';
import { WalkOverlay } from '@/components/show/WalkOverlay';
import { useShowActions } from '@/components/show/useShowActions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useHydrated } from '@/hooks/useHydrated';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useShowFromUrl } from '@/hooks/useShowFromUrl';
import { cn } from '@/lib/utils';
import { useStudio } from '@/store';
import type { MobilePanel } from '@/store/slices/ui';
import { ExportDialog } from './ExportDialog';
import { FormationPanel } from './FormationPanel';
import { Inspector } from './Inspector';
import { Panel } from './Panel';
import { StudioTour, TOUR_STEPS } from './StudioTour';
import { SHORTCUTS, type ShortcutId } from './shortcuts';
import { Timeline } from './Timeline';
import { TopBar, useShareLink } from './TopBar';

function useStudioHotkeys(onHelp: () => void) {
  const { run } = useShowActions();
  const share = useShareLink();
  const selected = () => useStudio.getState().selectedKeyframeId;
  const actions: Record<ShortcutId, () => unknown> = {
    toggle: () => run({ type: 'playback.toggle' }),
    next: () => run({ type: 'playback.step', direction: 1 }),
    previous: () => run({ type: 'playback.step', direction: -1 }),
    loop: () => run({ type: 'playback.setLoop', loop: !useStudio.getState().playback.loop }),
    undo: () => run({ type: 'history.undo' }),
    redo: () => run({ type: 'history.redo' }),
    duplicate: () => selected() && run({ type: 'keyframe.duplicate', id: selected()! }),
    delete: () => selected() && run({ type: 'keyframe.remove', id: selected()! }),
    share,
    help: onHelp,
  };
  // Arrow keys belong to walking while in the first-person view.
  const walking = () => useStudio.getState().show.scene.cameraPreset === 'walk';
  useHotkeys(
    SHORTCUTS.map((s) => s.keys).join(', '),
    (event, handler) => {
      const pressed = [...(handler.mod ? ['mod'] : []), ...(handler.shift ? ['shift'] : []), ...(handler.keys ?? [])].join('+');
      const shortcut = SHORTCUTS.find((s) => s.keys.split(', ').includes(pressed));
      if (!shortcut || (walking() && (shortcut.id === 'next' || shortcut.id === 'previous'))) return;
      event.preventDefault();
      void actions[shortcut.id]();
    },
    { useKey: false },
  );
}

/** `/studio`: canvas in the middle, library left, inspector right, timeline below. Panels become bottom sheets on small screens. */
export function StudioApp() {
  const t = useTranslations('Studio');
  const hydrated = useHydrated();
  const isDesktop = useIsDesktop();
  const { run } = useShowActions();
  const ui = useStudio((s) => s.ui);
  const capabilities = useStudio((s) => s.runtime.capabilities);
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // The walkthrough opens by itself on a first visit; `undefined` = not touched yet this session.
  const [tourChoice, setTourStep] = useState<number | null | undefined>(undefined);
  const tourStep = tourChoice !== undefined ? tourChoice : hydrated && !ui.tourSeen ? 0 : null;
  const onTourStep = (step: number | null) => {
    setTourStep(step);
    if (step === null && !ui.tourSeen) void run({ type: 'ui.set', patch: { tourSeen: true } });
  };
  const touring = tourStep === null ? null : TOUR_STEPS[tourStep];
  const fromUrl = useShowFromUrl();
  useStudioHotkeys(() => setHelpOpen(true));

  // A gallery or share link opens that show for remixing.
  useEffect(() => {
    if (!fromUrl.ready) return;
    if (fromUrl.error) toast.error(t('linkBroken'), { description: fromUrl.error });
    else if (fromUrl.show) {
      void run({ type: 'show.load', show: fromUrl.show });
      window.history.replaceState(null, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per URL read
  }, [fromUrl.ready]);

  const setMobilePanel = (panel: MobilePanel) => void run({ type: 'ui.set', patch: { mobilePanel: panel } });
  if (!hydrated) return <div className="fixed inset-0 bg-ink" />;

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink">
      <LiveShow />
      <WalkOverlay />

      <div className="pointer-events-none absolute inset-0 flex flex-col gap-2 p-2 sm:gap-3 sm:p-3 [&>*]:pointer-events-auto">
        <div className={cn('rounded-[14px] transition-shadow duration-200', touring === 'share' && 'shadow-[0_0_0_3px_rgb(124_247_228/0.3)]')}>
          <TopBar onExport={() => setExportOpen(true)} onHelp={() => setHelpOpen(true)} onTour={() => setTourStep(0)} />
        </div>

        <div className="pointer-events-none flex min-h-0 flex-1 justify-between gap-3 [&>*]:pointer-events-auto">
          {isDesktop && ui.leftOpen && (
            <Panel as="aside" step={1} title={t('library.title')} hint={t('library.hint')} highlight={touring === 'library'} className="w-[300px] shrink-0">
              <FormationPanel />
            </Panel>
          )}
          <span className="pointer-events-none flex-1" />
          {isDesktop && ui.rightOpen && (
            <Panel as="aside" step={3} title={t('inspector.title')} hint={t('inspector.hint')} highlight={touring === 'inspector'} className="w-[330px] shrink-0">
              <Inspector />
            </Panel>
          )}
        </div>

        {!isDesktop && (
          <div className="flex gap-2">
            <Button variant="outline" className={cn('glass h-10 flex-1 rounded-[14px]', touring === 'library' && 'border-cyan/70')} onClick={() => setMobilePanel('library')}>
              <Layers />
              {t('library.title')}
            </Button>
            <Button variant="outline" className={cn('glass h-10 flex-1 rounded-[14px]', touring === 'inspector' && 'border-cyan/70')} onClick={() => setMobilePanel('inspector')}>
              <SlidersHorizontal />
              {t('inspector.title')}
            </Button>
          </div>
        )}

        <Panel step={2} title={t('timeline.title')} hint={t('timeline.hint')} highlight={touring === 'timeline'} className="h-[244px] shrink-0 sm:h-[262px]">
          <Timeline onAdd={() => (isDesktop ? void run({ type: 'ui.set', patch: { leftOpen: true } }) : setMobilePanel('library'))} />
        </Panel>

        <footer className="flex items-center justify-between gap-3 px-1">
          <FleetStats />
          <span className={cn('eyebrow rounded-full border border-line px-2 py-0.5', capabilities?.webgpu ? '!text-cyan' : '!text-glow')}>
            {capabilities ? (capabilities.webgpu ? 'WebGPU' : 'WebGL2') : '…'}
          </span>
        </footer>
      </div>

      {/* Small screens: the same panels, as bottom sheets that leave the show visible above. */}
      <Drawer open={!isDesktop && ui.mobilePanel !== null} onOpenChange={(open) => !open && setMobilePanel(null)}>
        <DrawerContent className="h-[62svh] border-line bg-ink-2">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{ui.mobilePanel === 'inspector' ? t('inspector.title') : t('library.title')}</DrawerTitle>
            <DrawerDescription>{t('sheetDescription')}</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-hidden">{ui.mobilePanel === 'inspector' ? <Inspector /> : <FormationPanel />}</div>
        </DrawerContent>
      </Drawer>

      <StudioTour step={tourStep} onStep={onTourStep} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-normal">{t('shortcuts.title')}</DialogTitle>
            <DialogDescription>{t('shortcuts.description')}</DialogDescription>
          </DialogHeader>
          <dl className="divide-y divide-line">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.id} className="flex items-center justify-between gap-4 py-2">
                <dt className="text-sm text-paper/85">{t(`shortcuts.${shortcut.id}`)}</dt>
                <dd className="flex gap-1">
                  {shortcut.display.map((key) => (
                    <kbd key={key} className="rounded border border-line bg-white/5 px-1.5 py-0.5 font-mono text-xs text-paper/80">
                      {key}
                    </kbd>
                  ))}
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 py-2">
              <dt className="text-sm text-paper/85">{t('shortcuts.walk')}</dt>
              <dd className="flex gap-1">
                {['W', 'A', 'S', 'D'].map((key) => (
                  <kbd key={key} className="rounded border border-line bg-white/5 px-1.5 py-0.5 font-mono text-xs text-paper/80">
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}
