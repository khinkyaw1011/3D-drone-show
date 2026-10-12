import { DEFAULT_FONTS, FONT_CHOICES } from '@/lib/fonts';
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
export const PERSIST_VERSION = 4;
export const PERSIST_KEY = 'skyloom';

/** The part of the transport that is a preference (how fast, whether to loop), as opposed to where the playhead is. */
type Transport = Pick<StudioState['playback'], 'speed' | 'loop'>;
type Persisted = Pick<StudioState, 'show' | 'userPresets'> & { ui: StudioState['ui']; transport: Transport };

function sanitizeTransport(raw: unknown): Transport {
  const fallback = initialPlaybackSlice().playback;
  const stored = (raw ?? {}) as Partial<Transport>;
  const speed = typeof stored.speed === 'number' && Number.isFinite(stored.speed) ? Math.min(8, Math.max(0.25, stored.speed)) : fallback.speed;
  return { speed, loop: typeof stored.loop === 'boolean' ? stored.loop : fallback.loop };
}

const safeShow = (raw: unknown): Show | null => {
  const parsed = showSchema.safeParse(migrateShow(raw));
  return parsed.success ? parsed.data : null;
};

/** Stored UI prefs merged over the defaults; values an older build wrote that no longer exist are dropped. */
function sanitizeUi(raw: unknown): StudioState['ui'] {
  const ui = { ...initialUiSlice().ui, ...((raw as object | undefined) ?? {}), mobilePanel: null } as StudioState['ui'];
  if (!(INSPECTOR_TABS as readonly string[]).includes(ui.inspectorTab)) ui.inspectorTab = 'formation';
  if (!(ui.fontBody in FONT_CHOICES.body)) ui.fontBody = DEFAULT_FONTS.fontBody;
  if (!(ui.fontHeading in FONT_CHOICES.heading)) ui.fontHeading = DEFAULT_FONTS.fontHeading;
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
    // v4: playback speed and loop are remembered too (before, a reload put them back to the defaults).
    transport: sanitizeTransport(raw.transport),
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
      // Every setting a visitor can tweak is in here: the show (look, scene, flight, formations), UI
      // preferences, and the transport preferences. Only the live playhead is left out.
      partialize: (state): Persisted => ({
        show: state.show,
        userPresets: state.userPresets,
        ui: state.ui,
        transport: { speed: state.playback.speed, loop: state.playback.loop },
      }),
      migrate: migratePersisted,
      // Always re-validate what comes out of storage, even at the current version: the schema fills in
      // settings added since the show was saved, so a stored show can never be missing a field.
      merge: (persisted, current) => {
        const { transport, ...stored } = migratePersisted(persisted);
        return { ...current, ...stored, playback: { ...current.playback, ...transport } };
      },
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
