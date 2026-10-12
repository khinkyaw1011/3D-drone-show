import { ArrowDownToLine, Drone, Eye, Footprints, Gauge, type LucideIcon, MoonStar, Orbit, Palette, PartyPopper, Satellite, Spotlight, Users, ZoomIn } from 'lucide-react';
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

/** One icon per settings group. */
export const GROUP_ICONS = { fleet: Drone, color: Palette, realism: Gauge, sky: MoonStar, fireworks: PartyPopper, venue: Spotlight } satisfies Record<string, LucideIcon>;
