import { z } from 'zod';
import type { FormationData, FormationSource } from '../../types';
import { base64ToBytes, bytesToBase64 } from '../assets';
import { SHOW_VOLUME, computeBounds } from '../fit';

/** World units covered by the Int16 range; comfortably larger than the show volume. */
const RANGE = 32;
const Q = 32767 / RANGE;

const inputSchema = z.object({
  label: z.string().default('Uploaded model'),
  p: z.string().describe('Int16 xyz, base64'),
  c: z.string().optional().describe('Uint8 rgb, base64'),
});
export type BakedInput = z.infer<typeof inputSchema>;

/** Freeze generated points into a compact, shareable input (for sources that cannot be regenerated, e.g. an uploaded GLB). */
export function bake(formation: FormationData, label: string): BakedInput {
  const { positions, colors, count } = formation;
  const q = new Int16Array(count * 3);
  for (let i = 0; i < q.length; i++) q[i] = Math.round((positions[i] - SHOW_VOLUME.center[i % 3]) * Q);
  return {
    label,
    p: bytesToBase64(new Uint8Array(q.buffer)),
    c: colors ? bytesToBase64(Uint8Array.from(colors, (v) => Math.round(Math.min(1, Math.max(0, v)) * 255))) : undefined,
  };
}

export const bakedSource: FormationSource<BakedInput> = {
  id: 'baked',
  label: 'Baked points',
  icon: 'Snowflake',
  inputSchema,
  runsIn: 'worker',
  describe: (input) => input.label,
  async generate(input, { count }) {
    const bytes = base64ToBytes(input.p);
    const q = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
    const stored = q.length / 3;
    if (stored < 1) throw new Error('Baked formation is empty');
    const rgb = input.c ? base64ToBytes(input.c) : undefined;
    const positions = new Float32Array(count * 3);
    const colors = rgb ? new Float32Array(count * 3) : undefined;
    for (let i = 0; i < count; i++) {
      // Resample by index when the show's drone count differs from the baked count.
      const s = Math.floor((i * stored) / count);
      for (let k = 0; k < 3; k++) {
        positions[i * 3 + k] = q[s * 3 + k] / Q + SHOW_VOLUME.center[k];
        if (colors && rgb) colors[i * 3 + k] = rgb[s * 3 + k] / 255;
      }
    }
    return { positions, colors, count, meta: { sourceId: 'baked', label: input.label, bounds: computeBounds(positions) } };
  },
};
