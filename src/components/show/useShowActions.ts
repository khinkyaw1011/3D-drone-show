'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Command } from '@/engine/commands/commands';
import { fileToImageInput } from '@/lib/image';
import { sampler } from '@/lib/formations';
import { resolvePrompt } from '@/lib/prompt';
import { dispatch } from '@/store/dispatch';
import { useStudio } from '@/store';

/**
 * User actions shared by the quick controls and the studio. Each one is a thin wrapper
 * that turns input (a word, a file) into commands and reports failures as a toast.
 */
export function useShowActions() {
  const t = useTranslations('Actions');

  /** Dispatch commands in order; show a toast instead of throwing. */
  const run = useCallback(
    async (...commands: Command[]) => {
      try {
        for (const command of commands) await dispatch(command);
        return true;
      } catch (error) {
        toast.error(t('failed'), { description: error instanceof Error ? error.message : String(error) });
        return false;
      }
    },
    [t],
  );

  /** Add a formation and fly to it straight away. */
  const addFormation = useCallback(
    async (sourceId: string, input: unknown, name?: string) => {
      if (!(await run({ type: 'formation.add', sourceId, input, name }))) return false;
      const id = useStudio.getState().selectedKeyframeId;
      return id ? run({ type: 'playback.goTo', id }) : true;
    },
    [run],
  );

  /** "heart", "桜", "HELLO" -> a shape or sky-writing. */
  const addFromPrompt = useCallback(
    async (text: string) => {
      const result = resolvePrompt(text);
      if (!result) return false;
      return addFormation(result.sourceId, result.input);
    },
    [addFormation],
  );

  /** Picture -> image formation; .svg -> crisp vector formation; .glb -> sampled model. */
  const addFromFile = useCallback(
    async (file: File) => {
      try {
        if (/\.glb$/i.test(file.name)) {
          const count = useStudio.getState().show.droneCount;
          const label = file.name.replace(/\.glb$/i, '').slice(0, 60);
          const baked = await sampler().bakeGlb(await file.arrayBuffer(), { count, rotation: 0, useColors: true, fill: 0.85, label });
          return addFormation('baked', baked, label);
        }
        if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
          return addFormation('svg', { svg: await file.text() }, file.name.replace(/\.svg$/i, '').slice(0, 60));
        }
        const image = await fileToImageInput(file);
        return addFormation('image', image, image.name);
      } catch (error) {
        toast.error(t('fileFailed'), { description: error instanceof Error ? error.message : String(error) });
        return false;
      }
    },
    [addFormation, t],
  );

  /** One colour (or rainbow / the formation's own colours) for the whole show. */
  const setFleetColor = useCallback(
    (mode: 'formation' | 'rainbow' | 'random' | 'solid', color?: string) =>
      run({ type: 'look.clearOverrides' }, { type: 'look.set', patch: mode === 'solid' && color ? { colorMode: 'solid', colors: [color] } : { colorMode: mode } }),
    [run],
  );

  return { run, addFormation, addFromPrompt, addFromFile, setFleetColor };
}
