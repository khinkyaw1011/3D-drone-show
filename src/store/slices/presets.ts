import type { Show } from '@/engine/types';

export interface PresetsSlice {
  /** Shows the user saved. Built-ins live in `engine/presets/builtin`. */
  userPresets: Show[];
}

export const initialPresetsSlice = (): PresetsSlice => ({ userPresets: [] });
