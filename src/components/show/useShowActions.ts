'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Command } from '@/engine/commands/commands';
import { type PickedFile, linkFile } from '@/lib/files';
import { fileToImageInput } from '@/lib/image';
import { sampler } from '@/lib/formations';
import { resolvePrompt } from '@/lib/prompt';
import { dispatch } from '@/store/dispatch';
import { useStudio } from '@/store';

/** SVG artwork up to this size is stored inside the show; anything larger stays a linked file. */
const SVG_INLINE_BYTES = 120_000;
/** Poses a model animation is played back as. */
const ANIMATION_STEPS = 6;

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

  /**
   * Picture -> image formation. .svg -> vector formation. .glb -> 3D model formation.
   * Models and large artwork stay on the device and are linked (see `lib/files.ts`); only
   * small artwork is stored inside the show, so it can still travel in a share link.
   */
  const addFromFile = useCallback(
    async (picked: File | PickedFile) => {
      const { file, handle }: PickedFile = picked instanceof File ? { file: picked } : picked;
      const label = file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'File';
      try {
        if (/\.(gltf|fbx|obj|stl)$/i.test(file.name)) throw new Error(t('glbOnly'));
        if (/\.glb$/i.test(file.name)) {
          // Read the animation list first: a file that cannot be parsed is rejected before it is linked.
          const clips = await sampler().inspectGlb(await file.arrayBuffer());
          const fileId = await linkFile({ file, handle });
          return addFormation('glb', { fileId, name: label, clips }, label);
        }
        if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
          if (file.size <= SVG_INLINE_BYTES) return addFormation('svg', { svg: await file.text(), name: label }, label);
          return addFormation('svg', { fileId: await linkFile({ file, handle }), name: label }, label);
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

  /**
   * Play a model's animation the way a drone show does: as a run of formations, one per pose,
   * that the fleet flies through. They are ordinary formations, so they can be edited or removed.
   */
  const addAnimation = useCallback(
    async (keyframeId: string, steps = ANIMATION_STEPS) => {
      const { keyframes } = useStudio.getState().show;
      const index = keyframes.findIndex((k) => k.id === keyframeId);
      const base = keyframes[index];
      if (!base) return false;
      const input = base.formation.input as Record<string, unknown>;
      const timing = { hold: 0.15, transition: { duration: 1.1, curve: 'sine.inOut', stagger: 0.1 } };
      if (!(await run({ type: 'formation.update', id: base.id, input: { ...input, pose: 0 } }, { type: 'keyframe.update', id: base.id, patch: timing }))) return false;
      for (let step = 1; step < steps; step++) {
        const added = await run({
          type: 'formation.add',
          sourceId: base.formation.sourceId,
          input: { ...input, pose: step / steps },
          at: index + step,
          name: `${base.name} ${step + 1}`,
        });
        const id = useStudio.getState().selectedKeyframeId;
        if (!added || !id) return false;
        await run({ type: 'keyframe.update', id, patch: { ...timing, spin: base.spin, look: base.look ?? null } });
      }
      return run({ type: 'playback.goTo', id: base.id });
    },
    [run],
  );

  /** One colour (or rainbow / the formation's own colours) for the whole show. */
  const setFleetColor = useCallback(
    (mode: 'formation' | 'rainbow' | 'random' | 'solid', color?: string) =>
      run({ type: 'look.clearOverrides' }, { type: 'look.set', patch: mode === 'solid' && color ? { colorMode: 'solid', colors: [color] } : { colorMode: mode } }),
    [run],
  );

  return { run, addFormation, addFromPrompt, addFromFile, addAnimation, setFleetColor };
}
