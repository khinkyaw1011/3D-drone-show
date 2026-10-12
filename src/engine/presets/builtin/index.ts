import type { Show } from '../../types';
import { parseShow } from '../schema';
import aurora from './aurora.json';
import cosmos from './cosmos.json';
import goldGala from './gold-gala.json';
import neonTokyo from './neon-tokyo.json';
import newYear from './new-year.json';
import nippon from './nippon.json';
import ocean from './ocean.json';
import sakuraNight from './sakura-night.json';
import wings from './wings.json';

/** Shipped shows, validated (and defaulted) by the same schema as user shows. */
export const BUILTIN_SHOWS: Show[] = [sakuraNight, wings, nippon, neonTokyo, cosmos, aurora, newYear, ocean, goldGala].map((s) => parseShow(s));

/** The show a new visitor gets, and the one the landing page opens on. */
export const DEFAULT_SHOW_ID = 'wings';

export function getBuiltinShow(id: string): Show | undefined {
  return BUILTIN_SHOWS.find((s) => s.id === id);
}
