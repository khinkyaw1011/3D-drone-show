import type { Capabilities } from '@/engine/types';

export type InspectorTab = 'drones' | 'motion' | 'scene' | 'camera' | 'fx';
export type MobilePanel = 'library' | 'inspector' | null;

export interface UiSlice {
  ui: {
    leftOpen: boolean;
    rightOpen: boolean;
    inspectorTab: InspectorTab;
    mobilePanel: MobilePanel;
    pushToy: boolean;
    /** Set once the fallback toast has been shown, so it is not repeated every visit. */
    fallbackNoticeSeen: boolean;
  };
  /** Runtime-only facts about this device. */
  runtime: {
    capabilities: Capabilities | null;
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
    fps: number;
  };
}

export const initialUiSlice = (): UiSlice => ({
  ui: { leftOpen: true, rightOpen: true, inspectorTab: 'drones', mobilePanel: null, pushToy: false, fallbackNoticeSeen: false },
  runtime: { capabilities: null, status: 'idle', error: null, fps: 0 },
});
