import { converter, interpolate } from 'culori';
import type { DroneLook, FormationData } from '../types';
import { hash01 } from './order';

const toRgb = converter('rgb');
const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const;

function write(out: Float32Array, i: number, color: string | { mode: string }) {
  const c = toRgb(color as string) ?? { r: 1, g: 1, b: 1 };
  out[i * 3] = c.r;
  out[i * 3 + 1] = c.g;
  out[i * 3 + 2] = c.b;
}

/** Resolve the per-drone colour for a formation under a look's colour mode (OKLCH interpolation via culori). */
export function resolveColors(formation: FormationData, look: DroneLook): Float32Array {
  const { positions, count, meta } = formation;
  if (look.colorMode === 'formation' && formation.colors) return formation.colors;

  const out = new Float32Array(count * 3);
  const stops = look.colors;
  const ramp = interpolate(stops.length > 1 ? stops : [stops[0], stops[0]], 'oklch');
  const axis = look.colorMode === 'height' ? 1 : AXIS_INDEX[look.gradientAxis];
  const lo = meta.bounds.min[axis];
  const span = Math.max(meta.bounds.max[axis] - lo, 1e-6);
  const xLo = meta.bounds.min[0];
  const xSpan = Math.max(meta.bounds.max[0] - xLo, 1e-6);

  for (let i = 0; i < count; i++) {
    switch (look.colorMode) {
      case 'gradient':
        write(out, i, ramp((positions[i * 3 + axis] - lo) / span));
        break;
      case 'height':
        write(out, i, { mode: 'oklch', l: 0.82, c: 0.16, h: 250 - ((positions[i * 3 + 1] - lo) / span) * 220 } as never);
        break;
      case 'palette':
        write(out, i, stops[Math.floor(hash01(i + 7) * stops.length) % stops.length]);
        break;
      case 'random':
        write(out, i, { mode: 'oklch', l: 0.8, c: 0.2, h: hash01(i + 3) * 360 } as never);
        break;
      case 'rainbow':
        write(out, i, { mode: 'oklch', l: 0.8, c: 0.19, h: ((positions[i * 3] - xLo) / xSpan) * 360 } as never);
        break;
      default: // 'solid', or 'formation' without source colours
        write(out, i, stops[0]);
    }
  }
  return out;
}
