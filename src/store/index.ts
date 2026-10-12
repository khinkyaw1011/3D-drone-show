import { temporal } from 'zundo';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { migrateShow, showSchema } from '@/engine/presets/schema';
import type { Show } from '@/engine/types';
import { type PlaybackSlice, initialPlaybackSlice } from './slices/playback';
import { type PresetsSlice, initialPresetsSlice } from './slices/presets';
import { type ShowSlice, initialShowSlice } from './slices/show';
import { type UiSlice, initialUiSlice } from './slices/ui';

export type StudioState = ShowSlice & PlaybackSlice & UiSlice & PresetsSlice;

/** Bump with any change to the persisted shape, and extend `migratePersisted` (+ its test). */
export const PERSIST_VERSION = 1;
export const PERSIST_KEY = 'skyloom';

type Persisted = Pick<StudioState, 'show' | 'userPresets'> & { ui: StudioState['ui'] };

const safeShow = (raw: unknown): Show | null => {
  const parsed = showSchema.safeParse(migrateShow(raw));
  return parsed.success ? parsed.data : null;
};

/** Upgrade anything a previous version wrote to localStorage. Invalid shows are dropped, never thrown on. */
export function migratePersisted(persisted: unknown, _fromVersion: number): Persisted {
  const raw = (persisted ?? {}) as Partial<Record<keyof Persisted, unknown>>;
  const fallback = initialShowSlice().show;
  return {
    show: safeShow(raw.show) ?? fallback,
    userPresets: (Array.isArray(raw.userPresets) ? raw.userPresets : []).map(safeShow).filter((s): s is Show => !!s),
    ui: { ...initialUiSlice().ui, ...((raw.ui as object | undefined) ?? {}), mobilePanel: null },
  };
}

export const useStudio = create<StudioState>()(
  persist(
    temporal(
      immer<StudioState>(() => ({
        ...initialShowSlice(),
        ...initialPlaybackSlice(),
        ...initialUiSlice(),
        ...initialPresetsSlice(),
      })),
      {
        // Undo history covers the show only; transport, UI and presets are not undoable.
        partialize: (state) => ({ show: state.show }) as StudioState,
        equality: (a, b) => a.show === b.show,
        limit: 80,
        // Coalesce bursts (slider drags) into one undo step: record the state before the burst only.
        handleSet: (handleSet) => {
          let last = 0;
          return (state) => {
            const now = Date.now();
            if (now - last > 450) handleSet(state);
            last = now;
          };
        },
      },
    ),
    {
      name: PERSIST_KEY,
      version: PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): Persisted => ({ show: state.show, userPresets: state.userPresets, ui: state.ui }),
      migrate: migratePersisted,
    },
  ),
);

/** Mutate with an immer recipe. Only `store/dispatch.ts` and runtime mirrors should call this. */
export const mutate = (recipe: (draft: StudioState) => void): void => {
  useStudio.setState(recipe as never);
};

export const history = () => useStudio.temporal.getState();
