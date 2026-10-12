import { temporal } from 'zundo';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { migrateShow, showSchema } from '@/engine/presets/schema';
import { fleetLimits } from '@/engine/renderer/capabilities';
import type { Show } from '@/engine/types';
import { type PlaybackSlice, initialPlaybackSlice } from './slices/playback';
import { type PresetsSlice, initialPresetsSlice } from './slices/presets';
import { type ShowSlice, initialShowSlice } from './slices/show';
import { INSPECTOR_TABS, type UiSlice, initialUiSlice } from './slices/ui';

export type StudioState = ShowSlice & PlaybackSlice & UiSlice & PresetsSlice;

/** Bump with any change to the persisted shape, and extend `migratePersisted` (+ its test). */
export const PERSIST_VERSION = 3;
export const PERSIST_KEY = 'skyloom';

type Persisted = Pick<StudioState, 'show' | 'userPresets'> & { ui: StudioState['ui'] };

const safeShow = (raw: unknown): Show | null => {
  const parsed = showSchema.safeParse(migrateShow(raw));
  return parsed.success ? parsed.data : null;
};

/** Stored UI prefs merged over the defaults; values an older build wrote that no longer exist are dropped. */
function sanitizeUi(raw: unknown): StudioState['ui'] {
  const ui = { ...initialUiSlice().ui, ...((raw as object | undefined) ?? {}), mobilePanel: null } as StudioState['ui'];
  if (!(INSPECTOR_TABS as readonly string[]).includes(ui.inspectorTab)) ui.inspectorTab = 'formation';
  return ui;
}

/** Upgrade anything a previous version wrote to localStorage. Invalid shows are dropped, never thrown on. */
export function migratePersisted(persisted: unknown): Persisted {
  const raw = (persisted ?? {}) as Partial<Record<keyof Persisted, unknown>>;
  const fallback = initialShowSlice().show;
  return {
    show: safeShow(raw.show) ?? fallback,
    userPresets: (Array.isArray(raw.userPresets) ? raw.userPresets : []).map(safeShow).filter((s): s is Show => !!s),
    ui: sanitizeUi(raw.ui),
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
      // Always re-validate what comes out of storage, even at the current version: the schema fills in
      // settings added since the show was saved, so a stored show can never be missing a field.
      merge: (persisted, current) => ({ ...current, ...migratePersisted(persisted) }),
    },
  ),
);

/**
 * Mutate with an immer recipe. Two callers only: command handlers in `store/dispatch.ts`, and
 * `LiveShow`, which mirrors what the player reports (time, capabilities) into the store.
 */
export const mutate = (recipe: (draft: StudioState) => void): void => {
  useStudio.setState(recipe as never);
};

export const history = () => useStudio.temporal.getState();

/** The fleet size this device may fly right now (config tier, lowered if the device struggled). */
export const useFleetLimits = () => {
  const capabilities = useStudio((s) => s.runtime.capabilities);
  const deviceMax = useStudio((s) => s.runtime.deviceMax);
  return fleetLimits(capabilities, deviceMax);
};
export const currentFleetLimits = () => {
  const { capabilities, deviceMax } = useStudio.getState().runtime;
  return fleetLimits(capabilities, deviceMax);
};
