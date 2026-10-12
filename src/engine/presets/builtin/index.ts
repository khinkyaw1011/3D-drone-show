import type { Show } from '../../types';
import { parseShow } from '../schema';
import aurora from './aurora.json';
import goldGala from './gold-gala.json';
import neonTokyo from './neon-tokyo.json';
import newYear from './new-year.json';
import ocean from './ocean.json';
import sakuraNight from './sakura-night.json';

/** Shipped shows, validated (and defaulted) by the same schema as user shows. */
export const BUILTIN_SHOWS: Show[] = [sakuraNight, neonTokyo, aurora, newYear, ocean, goldGala].map((s) => parseShow(s));

export const DEFAULT_SHOW_ID = 'sakura-night';

export function getBuiltinShow(id: string): Show | undefined {
  return BUILTIN_SHOWS.find((s) => s.id === id);
}
