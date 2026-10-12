import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { parseShow } from '@/engine/presets/schema';
import type { Show } from '@/engine/types';

const KEY = 's';
/** Above this, some chat apps and browsers start truncating links. */
export const SHARE_SOFT_LIMIT = 60_000;

export function encodeShow(show: Show): string {
  return compressToEncodedURIComponent(JSON.stringify(show));
}

/** Decode + validate. Throws with a readable message on a broken or tampered link. */
export function decodeShow(encoded: string): Show {
  const json = decompressFromEncodedURIComponent(encoded);
  if (!json) throw new Error('This share link is incomplete or corrupted');
  return parseShow(JSON.parse(json));
}

export function shareHash(show: Show): string {
  return `#${KEY}=${encodeShow(show)}`;
}

export function showFromHash(hash: string): Show | null {
  const match = hash.replace(/^#/, '').match(new RegExp(`(?:^|&)${KEY}=([^&]+)`));
  return match ? decodeShow(match[1]) : null;
}
