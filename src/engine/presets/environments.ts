import type { SceneSettings } from '../types';
import { SKY } from '../materials/sky';

type EnvironmentPatch = Partial<Omit<SceneSettings, 'bloom' | 'physics' | 'fireworks' | 'venue' | 'cameraPreset' | 'autoOrbit'>> & {
  fireworks: Partial<SceneSettings['fireworks']>;
  venue: SceneSettings['venue'];
};

/**
 * One-click environments: each is just a patch for `scene.set`, so applying one is an
 * ordinary, undoable command and every value stays adjustable afterwards.
 * They never touch the camera, post-FX or physics.
 */
export const ENVIRONMENTS: Record<string, EnvironmentPatch> = {
  meadow: { sky: 'midnight', ground: 'field', ambient: 0.3, stars: 0.6, starSize: 0.3, milkyWay: 0.5, fog: 0.1, venue: { beams: 0.2, glow: 0.6 }, fireworks: { intensity: 0 } },
  lakeside: { sky: 'dusk', ground: 'water', ambient: 0.3, stars: 0.35, starSize: 0.3, milkyWay: 0.2, fog: 0.15, venue: { beams: 0.25, glow: 0.5 }, fireworks: { intensity: 0 } },
  city: { sky: 'midnight', ground: 'city', ambient: 0.35, stars: 0.2, starSize: 0.25, milkyWay: 0.05, fog: 0.25, venue: { beams: 0.5, glow: 0.4 }, fireworks: { intensity: 0 } },
  festival: {
    sky: 'midnight',
    ground: 'city',
    ambient: 0.3,
    stars: 0.3,
    starSize: 0.3,
    milkyWay: 0.1,
    fog: 0.2,
    venue: { beams: 0.7, glow: 0.7 },
    fireworks: { intensity: 0.7, palette: 'rainbow', style: 'mixed' },
  },
  aurora: { sky: 'aurora', ground: 'water', ambient: 0.4, stars: 0.6, starSize: 0.3, milkyWay: 0.3, fog: 0.12, venue: { beams: 0, glow: 0.4 }, fireworks: { intensity: 0 } },
  'deep-space': { sky: 'deep-space', ground: 'none', ambient: 0.15, stars: 0.9, starSize: 0.4, milkyWay: 0.8, fog: 0.05, venue: { beams: 0, glow: 0 }, fireworks: { intensity: 0 } },
  blackout: { sky: 'midnight', ground: 'none', ambient: 0.02, stars: 0.05, starSize: 0.2, milkyWay: 0, fog: 0, venue: { beams: 0, glow: 0 }, fireworks: { intensity: 0 } },
};

export type EnvironmentId = keyof typeof ENVIRONMENTS;

/** Zenith and horizon colours of an environment, for its swatch in the picker. */
export function environmentSwatch(id: EnvironmentId): { top: string; horizon: string } {
  const sky = SKY[ENVIRONMENTS[id].sky ?? 'midnight'];
  return { top: sky.top, horizon: sky.glow };
}

/** The environment whose distinguishing settings the scene currently matches, if any. */
export function matchEnvironment(scene: SceneSettings): EnvironmentId | null {
  const found = Object.entries(ENVIRONMENTS).find(
    ([, e]) =>
      e.sky === scene.sky &&
      e.ground === scene.ground &&
      e.venue.beams === scene.venue.beams &&
      e.ambient === scene.ambient &&
      (e.fireworks.intensity ?? 0) === scene.fireworks.intensity,
  );
  return found ? found[0] : null;
}
