import { converter } from 'culori';
import { decode } from 'image-js';
import PoissonDiskSampling from 'poisson-disk-sampling';
import { z } from 'zod';
import type { FormationSource } from '../../types';
import { toFormation } from '../fit';
import { seededRng, throwIfAborted } from '../sample';

export const WEIGHT_MODES = ['luminance', 'alpha', 'edges', 'subject'] as const;
export const DEPTH_MODES = ['flat', 'relief', 'curve'] as const;

const inputSchema = z.object({
  /** Downscaled PNG/JPEG data URL: small enough to persist and share, and re-sampleable. */
  src: z.string().startsWith('data:image/').max(600_000),
  name: z.string().max(80).default('Image'),
  mode: z.enum(WEIGHT_MODES).default('luminance').describe('Weight'),
  threshold: z.number().min(0).max(0.95).default(0.12).describe('Threshold'),
  invert: z.boolean().default(false).describe('Invert'),
  depth: z.enum(DEPTH_MODES).default('flat').describe('Depth'),
  useColors: z.boolean().default(true).describe('Colour from image'),
  saturation: z.number().min(0).max(2).default(1.25).describe('Saturation'),
  fill: z.number().min(0.3).max(1).default(0.9).describe('Size'),
});
export type ImageInput = z.infer<typeof inputSchema>;

const toOklch = converter('oklch');
const toRgb = converter('rgb');

interface Maps {
  width: number;
  height: number;
  rgba: Uint8Array | Uint8ClampedArray | Uint16Array | Float32Array | Float64Array;
  weight: Float32Array;
  luminance: Float32Array;
}

/** image-js: decode, grey, Sobel; then a 0..1 importance map for the chosen mode. */
function buildMaps(bytes: Uint8Array, input: ImageInput): Maps {
  let image = decode(bytes);
  if (image.bitDepth !== 8) image = image.convertBitDepth(8);
  if (image.colorModel !== 'RGBA') image = image.convertColor('RGBA');
  const { width, height } = image;
  const rgba = image.getRawImage().data;
  const grey = image.grey();
  const edges = input.mode === 'edges' ? grey.derivativeFilter() : null;
  const n = width * height;
  const weight = new Float32Array(n);
  const luminance = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4] / 255;
    const g = rgba[i * 4 + 1] / 255;
    const b = rgba[i * 4 + 2] / 255;
    const a = rgba[i * 4 + 3] / 255;
    const lum = grey.getValueByIndex(i, 0) / 255;
    luminance[i] = lum;
    let w: number;
    if (input.mode === 'alpha') w = a;
    else if (input.mode === 'edges') w = Math.min(1, (edges!.getValueByIndex(i, 0) / 255) * 2.5);
    else if (input.mode === 'subject') {
      const max = Math.max(r, g, b);
      const sat = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
      w = Math.min(1, lum * (0.35 + sat * 1.4));
    } else w = lum;
    if (input.invert) w = 1 - w;
    w *= a; // transparent pixels never get drones
    weight[i] = w < input.threshold ? 0 : w;
  }
  return { width, height, rgba, weight, luminance };
}

/** Variable-density blue noise, denser where the weight map is high; exactly `count` points out. */
function samplePoints(maps: Maps, count: number, signal?: AbortSignal): number[][] {
  const { width, height, weight } = maps;
  const at = (p: number[]) => weight[Math.min(height - 1, p[1] | 0) * width + Math.min(width - 1, p[0] | 0)];
  let covered = 0;
  for (let i = 0; i < weight.length; i++) covered += weight[i] > 0 ? 0.35 + 0.65 * weight[i] : 0;
  if (covered < 1) throw new Error('Nothing left to sample: lower the threshold or change the weight mode');

  const rng = seededRng(17);
  let minDistance = Math.max(0.35, Math.sqrt(covered / count) * 0.72);
  let points: number[][] = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    throwIfAborted(signal);
    const pds = new PoissonDiskSampling(
      { shape: [width, height], minDistance, maxDistance: minDistance * 3.2, tries: 10, distanceFunction: (p) => 1 - at(p) },
      rng,
    );
    points = pds.fill().filter((p) => at(p) > 0);
    const ratio = points.length / count;
    if (ratio >= 1 && ratio < 1.35) break;
    minDistance = Math.max(0.3, minDistance * Math.sqrt(Math.max(ratio, 0.05)) * (ratio < 1 ? 0.94 : 1));
  }
  if (points.length === 0) throw new Error('Nothing left to sample: lower the threshold or change the weight mode');

  // Trim with an unbiased shuffle, or top up by jittering existing points.
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }
  const base = points.length;
  while (points.length < count) {
    const p = points[Math.floor(rng() * base)];
    points.push([p[0] + (rng() - 0.5) * minDistance, p[1] + (rng() - 0.5) * minDistance]);
  }
  return points.slice(0, count);
}

export const imageSource: FormationSource<ImageInput> = {
  id: 'image',
  label: 'Image',
  icon: 'Image',
  inputSchema,
  runsIn: 'worker',
  describe: (input) => input.name,
  async generate(input, { count, signal }) {
    const bytes = new Uint8Array(await (await fetch(input.src)).arrayBuffer());
    throwIfAborted(signal);
    const maps = buildMaps(bytes, input);
    const points = samplePoints(maps, count, signal);
    const { width, height, rgba, luminance } = maps;

    const positions = new Float32Array(count * 3);
    const colors = input.useColors ? new Float32Array(count * 3) : undefined;
    for (let i = 0; i < count; i++) {
      const [px, py] = points[i];
      const idx = Math.min(height - 1, Math.max(0, py | 0)) * width + Math.min(width - 1, Math.max(0, px | 0));
      const nx = px / width - 0.5;
      let z = 0;
      if (input.depth === 'relief') z = luminance[idx] * width * 0.14;
      else if (input.depth === 'curve') z = -nx * nx * width * 0.9;
      positions.set([px, -py, z], i * 3);
      if (colors) {
        const rgb = { mode: 'rgb' as const, r: rgba[idx * 4] / 255, g: rgba[idx * 4 + 1] / 255, b: rgba[idx * 4 + 2] / 255 };
        const lch = toOklch(rgb);
        // Drones are lights: lift dark pixels a little and boost chroma (culori, OKLCH).
        const out = toRgb({ ...lch, l: 0.25 + lch.l * 0.75, c: lch.c * input.saturation });
        colors.set([clamp01(out.r), clamp01(out.g), clamp01(out.b)], i * 3);
      }
    }
    return toFormation('image', input.name, positions, colors, input.fill);
  },
};

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
