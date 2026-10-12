'use client';

import { Clapperboard, FileWarning } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SliderField } from '@/components/controls/fields';
import type { Keyframe } from '@/engine/types';
import { MODEL_ACCEPT, SVG_ACCEPT, pickFile, relinkFile, useMissingFiles } from '@/lib/files';
import { IMAGE_ACCEPT } from '@/lib/image';
import { cn } from '@/lib/utils';
import { useShowActions } from './useShowActions';

const ANY_FILE = { ...IMAGE_ACCEPT, ...MODEL_ACCEPT };
const ANIMATION_STEPS = 6;

/** Open the file picker in the way that lets a model or large artwork stay linked to the file on disk. */
export function usePickFormationFile() {
  const { addFromFile } = useShowActions();
  return async () => {
    const picked = await pickFile(ANY_FILE, 'Pictures, SVG, 3D models');
    return picked ? addFromFile(picked) : false;
  };
}

/** Linked files that could not be read, each with the one action that fixes it. Renders nothing when all is well. */
export function MissingFiles({ className }: { className?: string }) {
  const t = useTranslations('Files');
  const missing = useMissingFiles();
  if (missing.length === 0) return null;
  return (
    <div role="alert" className={cn('space-y-2 rounded-lg border border-glow/40 bg-glow/[0.07] p-3', className)}>
      <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-paper">
        <FileWarning className="size-4 shrink-0 text-glow" aria-hidden="true" />
        {t('missingTitle')}
      </p>
      {missing.map((file) => (
        <div key={file.id} className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1 basis-48 text-xs leading-snug text-paper/75">{t(file.reason, { name: file.name })}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const accept = /\.svg$/i.test(file.name) ? SVG_ACCEPT : { ...MODEL_ACCEPT, ...SVG_ACCEPT };
              if (await relinkFile(file.id, accept, file.name)) toast.success(t('restored'));
            }}
          >
            {t(file.reason === 'permission' ? 'allow' : 'locate')}
          </Button>
        </div>
      ))}
    </div>
  );
}

/** Animations a formation's model has: the bundled models have one each; linked ones list theirs. */
function clipsOf(keyframe: Keyframe): string[] | null {
  const input = keyframe.formation.input as { clips?: string[] };
  if (keyframe.formation.sourceId === 'model') return [''];
  if (keyframe.formation.sourceId === 'glb') return input.clips?.length ? input.clips : null;
  return null;
}

/** For a model with animations: choose one, pick a pose from it, or play it as a run of formations. */
export function ModelAnimation({ keyframe, className }: { keyframe: Keyframe | undefined; className?: string }) {
  const t = useTranslations('Files');
  const { run, addAnimation } = useShowActions();
  const clips = keyframe ? clipsOf(keyframe) : null;
  if (!keyframe || !clips) return null;
  const input = keyframe.formation.input as { clip?: number; pose?: number; fileId?: string };
  const update = (patch: { clip?: number; pose?: number }) => run({ type: 'formation.update', id: keyframe.id, input: { ...input, ...patch } });

  return (
    <div className={cn('space-y-2.5', className)}>
      {clips.length > 1 && (
        <div role="group" aria-label={t('animation')} className="flex flex-wrap gap-1.5">
          {clips.map((name, index) => (
            <button
              key={index}
              type="button"
              aria-pressed={(input.clip ?? 0) === index}
              title={name || undefined}
              onClick={() => update({ clip: index, pose: input.pose || 0.25 })}
              className={cn(
                'max-w-40 truncate rounded-full border border-line bg-white/[0.04] px-3 py-1.5 text-[0.8125rem] text-paper/80 transition-colors duration-150 hover:text-paper',
                (input.clip ?? 0) === index && 'border-glow/70 bg-glow/15 text-paper',
              )}
            >
              {t('clip', { index: index + 1 })}
            </button>
          ))}
        </div>
      )}
      <SliderField label={t('pose')} value={input.pose ?? 0} min={0} max={1} format={(v) => `${Math.round(v * 100)}%`} onChange={(pose) => update({ pose })} />
      <Button size="sm" variant="outline" className="w-full" onClick={() => addAnimation(keyframe.id, ANIMATION_STEPS)}>
        <Clapperboard aria-hidden="true" />
        {t('play')}
      </Button>
      <p className="text-xs leading-snug text-muted-foreground">{t('playHint', { count: ANIMATION_STEPS })}</p>
      {input.fileId && <p className="text-xs leading-snug text-muted-foreground">{t('linkedNote')}</p>}
    </div>
  );
}
