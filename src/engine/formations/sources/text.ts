import { type Font, FontLoader } from 'three/addons/loaders/FontLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type BufferGeometry, ExtrudeGeometry } from 'three/webgpu';
import { z } from 'zod';
import type { FormationSource } from '../../types';
import { assetUrl } from '../assets';
import { toFormation } from '../fit';
import { sampleGeometry, seededRng, throwIfAborted } from '../sample';

export const FONTS = { helvetiker: 'Helvetiker', optimer: 'Optimer', gentilis: 'Gentilis' } as const;
export type FontName = keyof typeof FONTS;

const inputSchema = z.object({
  text: z.string().min(1).max(40).default('SKYLOOM').describe('Text'),
  font: z.enum(Object.keys(FONTS) as [FontName, ...FontName[]]).default('helvetiker').describe('Font'),
  letterSpacing: z.number().min(-0.1).max(0.6).default(0.06).describe('Letter spacing'),
  stacked: z.boolean().default(false).describe('Stack words'),
  fill: z.number().min(0.3).max(1).default(0.9).describe('Size'),
});
export type TextInput = z.infer<typeof inputSchema>;

const fontCache = new Map<FontName, Promise<Font>>();

function loadFont(name: FontName): Promise<Font> {
  let font = fontCache.get(name);
  if (!font) {
    font = fetch(assetUrl(`/fonts/${name}_bold.typeface.json`))
      .then((r) => {
        if (!r.ok) throw new Error(`Font ${name} failed to load`);
        return r.json();
      })
      .then((json) => new FontLoader().parse(json));
    fontCache.set(name, font);
  }
  return font;
}

/** Lay glyphs out one by one so letter spacing is adjustable; lines are centred. Letters are extruded, so words have depth. */
function textGeometry(font: Font, lines: string[], spacing: number): BufferGeometry {
  const data = font.data as unknown as { glyphs: Record<string, { ha: number }>; resolution: number };
  const parts: BufferGeometry[] = [];
  lines.forEach((line, row) => {
    const advances = [...line].map((ch) => (data.glyphs[ch] ?? data.glyphs['?']).ha / data.resolution + spacing);
    const width = advances.reduce((a, b) => a + b, 0) - spacing;
    let x = -width / 2;
    [...line].forEach((ch, i) => {
      if (ch.trim()) parts.push(new ExtrudeGeometry(font.generateShapes(ch, 1), { depth: 0.22, bevelEnabled: false, curveSegments: 6 }).translate(x, -row * 1.35, 0));
      x += advances[i];
    });
  });
  if (parts.length === 0) throw new Error('Nothing to draw: the text has no visible glyphs');
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

const hasGlyphs = (font: Font, text: string) => {
  const glyphs = (font.data as unknown as { glyphs: Record<string, unknown> }).glyphs;
  return [...text].every((ch) => !ch.trim() || ch in glyphs);
};

/** System fonts that draw each script well, in order; the browser picks the first that has the glyph. */
const SCRIPT_FONTS = [
  '"Noto Sans JP"', '"Hiragino Sans"', '"Yu Gothic"', 'Meiryo', // Japanese
  '"PingFang SC"', '"Microsoft YaHei"', '"Noto Sans SC"', '"PingFang TC"', '"Microsoft JhengHei"', '"Noto Sans TC"', '"Noto Sans CJK SC"', // Chinese
  '"Apple SD Gothic Neo"', '"Malgun Gothic"', '"Noto Sans KR"', // Korean
  '"Noto Sans Myanmar"', '"Myanmar Sangam MN"', '"Myanmar Text"',
  'system-ui', 'sans-serif',
].join(', ');

/**
 * Scripts the bundled typeface fonts cannot draw (Japanese, Chinese, Korean, Myanmar, emoji...):
 * the browser shapes the text on a canvas and drones are placed over the ink.
 *
 * The result is a flat, single-layer sign facing the crowd, the way real shows fly kanji:
 * dense characters need every drone in one plane to stay readable. Drones are spread by
 * best-candidate sampling (each new drone goes where it is farthest from the ones already
 * placed), so strokes are covered evenly along their length instead of in random clumps.
 * Custom because typeface.json fonts for CJK would add tens of megabytes (see DECISIONS.md).
 */
function rasterText(lines: string[], count: number, signal?: AbortSignal): Float32Array {
  if (typeof OffscreenCanvas === 'undefined') throw new Error('This browser cannot draw that script as a formation');
  const size = 120;
  const lineHeight = size * 1.3;
  // Medium weight: strokes thin enough that drones line up along them rather than filling blobs.
  const font = `500 ${size}px ${SCRIPT_FONTS}`;
  const probe = new OffscreenCanvas(8, 8).getContext('2d')!;
  probe.font = font;
  const width = Math.min(4096, Math.ceil(Math.max(...lines.map((l) => probe.measureText(l).width)) + size));
  const height = Math.ceil(lines.length * lineHeight + size * 0.6);
  const ctx = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true })!;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  lines.forEach((line, row) => ctx.fillText(line, width / 2, size * 0.3 + lineHeight * (row + 0.5)));
  const alpha = ctx.getImageData(0, 0, width, height).data;

  const inked: number[] = [];
  for (let i = 0; i < width * height; i++) if (alpha[i * 4 + 3] > 127) inked.push(i);
  if (inked.length === 0) throw new Error('Nothing to draw: the text has no visible glyphs');

  const rng = seededRng(5);
  const positions = new Float32Array(count * 3);
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  // Fewer candidates for big fleets keeps this well under a second in the worker.
  const candidates = count > 1800 ? 6 : 12;
  for (let i = 0; i < count; i++) {
    if ((i & 255) === 0) throwIfAborted(signal);
    let [bestX, bestY, bestGap] = [0, 0, -1];
    for (let c = 0; c < candidates; c++) {
      const pixel = inked[Math.floor(rng() * inked.length)];
      const x = (pixel % width) + rng();
      const y = Math.floor(pixel / width) + rng();
      let gap = Infinity;
      for (let j = 0; j < i && gap > bestGap; j++) gap = Math.min(gap, (xs[j] - x) ** 2 + (ys[j] - y) ** 2);
      if (gap > bestGap) [bestX, bestY, bestGap] = [x, y, gap];
    }
    xs[i] = bestX;
    ys[i] = bestY;
    positions[i * 3] = bestX;
    positions[i * 3 + 1] = -bestY;
    // z stays 0: one flat layer.
  }
  return positions;
}

export const textSource: FormationSource<TextInput> = {
  id: 'text',
  label: 'Text',
  icon: 'Type',
  inputSchema,
  runsIn: 'worker',
  describe: (input) => `“${input.text}”`,
  async generate(input, { count, signal }) {
    const font = await loadFont(input.font);
    const lines = (input.stacked ? input.text.trim().split(/\s+/) : input.text.split('\n')).filter(Boolean);
    let positions: Float32Array;
    if (hasGlyphs(font, lines.join(''))) {
      const geometry = textGeometry(font, lines, input.letterSpacing);
      positions = sampleGeometry(geometry, count, { seed: 5, signal }).positions;
      geometry.dispose();
    } else positions = rasterText(lines, count, signal);
    return toFormation('text', this.describe(input), positions, undefined, input.fill);
  },
};
