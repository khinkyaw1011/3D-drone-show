import { converter } from 'culori';
import type { Transition } from '../types';
import { computeBounds } from './fit';

const toOklch = converter('oklch');

/** Deterministic 0..1 hash per drone index. */
export function hash01(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Launch delay per drone, normalised to 0..1. `order` only shapes when each drone leaves. */
export function launchDelays(order: Transition['order'], positions: Float32Array, colors: Float32Array): Float32Array {
  const count = positions.length / 3;
  const out = new Float32Array(count);
  const { min, max } = computeBounds(positions);
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const radius = Math.max(Math.hypot(max[0] - cx, max[1] - cy, max[2] - cz), 1e-6);
  const height = Math.max(max[1] - min[1], 1e-6);
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (order === 'radial') out[i] = Math.hypot(x - cx, y - cy, z - cz) / radius;
    else if (order === 'top-down') out[i] = (max[1] - y) / height;
    else if (order === 'by-color') {
      const c = toOklch({ mode: 'rgb', r: colors[i * 3], g: colors[i * 3 + 1], b: colors[i * 3 + 2] });
      out[i] = ((c.h ?? 0) % 360) / 360;
    } else out[i] = hash01(i);
  }
  return out;
}
