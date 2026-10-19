import {
  ArrowDownToLine,
  Bridge,
  Drone,
  Eye,
  FerrisWheel,
  Footprints,
  Gauge,
  Landmark,
  type LucideIcon,
  MoonStar,
  MountainSnow,
  Orbit,
  Palette,
  PartyPopper,
  RadioTower,
  Sailboat,
  Satellite,
  Spotlight,
  Users,
  ZoomIn,
} from 'lucide-react';
import type { SceneSettings } from '@/engine/types';

/** One icon per camera view, wherever views are listed. */
export const VIEW_ICONS: Record<SceneSettings['cameraPreset'], LucideIcon> = {
  spectator: Users,
  walk: Footprints,
  'close-up': ZoomIn,
  front: Eye,
  'low-hero': ArrowDownToLine,
  'top-down': Satellite,
  'fly-around': Orbit,
};

/** One icon per landmark, wherever landmarks are listed. */
export const LANDMARK_ICONS: Record<SceneSettings['landmarks'][number], LucideIcon> = {
  tower: RadioTower,
  pagoda: Landmark,
  wheel: FerrisWheel,
  bridge: Bridge,
  mountain: MountainSnow,
  boats: Sailboat,
};

/** One icon per settings group. */
export const GROUP_ICONS = { fleet: Drone, color: Palette, realism: Gauge, sky: MoonStar, fireworks: PartyPopper, venue: Spotlight } satisfies Record<string, LucideIcon>;
