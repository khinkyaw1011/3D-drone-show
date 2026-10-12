import type { ShowHandle } from '@/components/canvas/ShowCanvas';

/** The mounted live show, for actions that need the renderer (PNG / video export). */
let current: ShowHandle | null = null;

export const setShowHandle = (handle: ShowHandle | null) => {
  current = handle;
};
export const getShowHandle = () => current;
