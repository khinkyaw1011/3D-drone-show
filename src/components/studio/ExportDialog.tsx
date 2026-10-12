'use client';

import { Camera, Film } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { SegmentedField } from '@/components/controls/fields';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { capturePng, captureVideo, downloadBlob, safeFilename } from '@/lib/export';
import { isAbort } from '@/lib/formations';
import { getShowHandle } from '@/lib/showHandle';
import { useStudio } from '@/store';

/** PNG of the current frame, or a frame-accurate video of the whole show. */
export function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('Studio.export');
  const name = useStudio((s) => s.show.name);
  const [scale, setScale] = useState<'1' | '2'>('1');
  const [fps, setFps] = useState<'30' | '60'>('30');
  const [progress, setProgress] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);

  const withHandle = async (work: (handle: NonNullable<ReturnType<typeof getShowHandle>>) => Promise<void>) => {
    const handle = getShowHandle();
    if (!handle) return void toast.error(t('notReady'));
    try {
      await work(handle);
    } catch (error) {
      if (!isAbort(error)) toast.error(t('failed'), { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const png = () =>
    withHandle(async (handle) => {
      downloadBlob(await capturePng(handle, Number(scale) as 1 | 2), `${safeFilename(name)}.png`);
      toast.success(t('pngDone'));
    });

  const video = () =>
    withHandle(async (handle) => {
      abort.current = new AbortController();
      setProgress(0);
      try {
        const { blob, extension } = await captureVideo(handle, { fps: Number(fps) as 30 | 60, onProgress: setProgress, signal: abort.current.signal });
        downloadBlob(blob, `${safeFilename(name)}.${extension}`);
        toast.success(t('videoDone', { format: extension.toUpperCase() }));
      } finally {
        setProgress(null);
      }
    });

  const busy = progress !== null;
  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-normal">{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <section className="space-y-3">
            <SegmentedField label={t('pngSize')} value={scale} options={[{ value: '1', label: '1×' }, { value: '2', label: '2×' }]} onChange={setScale} />
            <Button variant="outline" className="w-full" disabled={busy} onClick={png}>
              <Camera />
              {t('savePng')}
            </Button>
          </section>
          <section className="space-y-3 border-t border-line pt-5">
            <SegmentedField label={t('frameRate')} value={fps} options={[{ value: '30', label: '30 fps' }, { value: '60', label: '60 fps' }]} onChange={setFps} />
            {busy ? (
              <div className="space-y-2" role="status" aria-live="polite">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full origin-left bg-cyan transition-transform duration-150" style={{ transform: `scaleX(${progress})` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{t('rendering', { percent: Math.round((progress ?? 0) * 100) })}</span>
                  <Button variant="ghost" size="sm" onClick={() => abort.current?.abort()}>
                    {t('cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button className="w-full" onClick={video}>
                <Film />
                {t('saveVideo')}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">{t('videoHint')}</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
