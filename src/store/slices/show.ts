import { nanoid } from 'nanoid';
import { DEFAULT_SHOW_ID, getBuiltinShow } from '@/engine/presets/builtin';
import { parseShow } from '@/engine/presets/schema';
import type { Show } from '@/engine/types';

export interface ShowSlice {
  show: Show;
  selectedKeyframeId: string | null;
}

/** A fresh copy of a show with its own id, so edits never touch the preset it came from. */
export function cloneShow(show: Show, name = show.name): Show {
  return { ...structuredClone(show), id: nanoid(10), name };
}

export function emptyShow(): Show {
  return parseShow({ id: nanoid(10), name: 'Untitled show', keyframes: [] });
}

export const initialShowSlice = (): ShowSlice => {
  const show = { ...cloneShow(getBuiltinShow(DEFAULT_SHOW_ID)!), basedOn: DEFAULT_SHOW_ID };
  return { show, selectedKeyframeId: show.keyframes[0]?.id ?? null };
};
