import type { Show } from '../types';
import { showSchema } from './schema';

/**
 * What each resettable feature owns, as paths into a Show. One table drives both
 * "restore defaults" and "has this feature been changed?", so the two cannot disagree.
 */
const OWNED = {
  look: [['droneCount'], ['look', 'body'], ['look', 'size'], ['look', 'glow'], ['look', 'bodyGlow'], ['look', 'twinkle'], ['look', 'trails'], ['look', 'swarm'], ['look', 'hoverBob']],
  color: [['look', 'colorMode'], ['look', 'colors'], ['look', 'gradientAxis']],
  flight: [['flight']],
  sky: [
    ['scene', 'sky'],
    ['scene', 'ground'],
    ['scene', 'ambient'],
    ['scene', 'stars'],
    ['scene', 'starSize'],
    ['scene', 'starTwinkle'],
    ['scene', 'milkyWay'],
    ['scene', 'fog'],
    ['scene', 'physics', 'windStrength'],
    ['scene', 'physics', 'windDirection'],
  ],
  fireworks: [['scene', 'fireworks']],
  venue: [['scene', 'venue']],
  camera: [['scene', 'cameraPreset'], ['scene', 'autoOrbit']],
  fx: [['scene', 'bloom'], ['scene', 'grain'], ['scene', 'vignette'], ['scene', 'exposure']],
  physics: [['scene', 'physics', 'gravity'], ['scene', 'physics', 'restitution'], ['scene', 'physics', 'maxBodies']],
} satisfies Record<string, string[][]>;

export const RESET_SCOPES = [...(Object.keys(OWNED) as (keyof typeof OWNED)[]), 'all'] as const;
export type ResetScope = (typeof RESET_SCOPES)[number];

const DEFAULTS = showSchema.parse({ id: 'defaults', name: 'defaults', keyframes: [] });

type Bag = Record<string, unknown>;
const read = (root: unknown, path: string[]) => path.reduce<unknown>((value, key) => (value as Bag | undefined)?.[key], root);
const write = (root: unknown, path: string[], value: unknown) => {
  const parent = path.slice(0, -1).reduce<unknown>((node, key) => (node as Bag)[key], root) as Bag;
  parent[path[path.length - 1]] = structuredClone(value);
};
const paths = (scope: ResetScope) => (scope === 'all' ? Object.values(OWNED).flat() : OWNED[scope]);
/** Per-formation colour overrides belong to "colour": they are what makes a formation ignore the show's scheme. */
const ownsOverrides = (scope: ResetScope) => scope === 'color' || scope === 'all';

/** Restore one feature (or everything) to its defaults, in place. Formations are always kept. */
export function resetScope(show: Show, scope: ResetScope): void {
  for (const path of paths(scope)) write(show, path, read(DEFAULTS, path));
  if (ownsOverrides(scope)) for (const keyframe of show.keyframes) delete keyframe.look;
}

/** Whether a feature differs from its defaults, i.e. whether a reset would change anything. */
export function isScopeChanged(show: Show, scope: ResetScope): boolean {
  if (ownsOverrides(scope) && show.keyframes.some((keyframe) => keyframe.look)) return true;
  return paths(scope).some((path) => JSON.stringify(read(show, path)) !== JSON.stringify(read(DEFAULTS, path)));
}
