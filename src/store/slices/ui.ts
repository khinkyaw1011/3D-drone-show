import type { Capabilities } from '@/engine/types';

export const INSPECTOR_TABS = ['formation', 'drones', 'flight', 'scene', 'camera', 'fx'] as const;
export type InspectorTab = (typeof INSPECTOR_TABS)[number];
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
    /** The studio walkthrough has been finished or skipped. */
    tourSeen: boolean;
  };
  /** Runtime-only facts about this device. */
  runtime: {
    capabilities: Capabilities | null;
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
    fps: number;
    /** Lower fleet ceiling discovered on this device when the frame rate dropped; null = none. */
    deviceMax: number | null;
  };
}

export const initialUiSlice = (): UiSlice => ({
  ui: { leftOpen: true, rightOpen: true, inspectorTab: 'formation', mobilePanel: null, pushToy: false, fallbackNoticeSeen: false, tourSeen: false },
  runtime: { capabilities: null, status: 'idle', error: null, fps: 0, deviceMax: null },
});
