import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BufferAttribute, type BufferGeometry, Color, ShapeGeometry } from 'three/webgpu';
import { z } from 'zod';
import type { FormationSource } from '../../types';
import { FileMissingError } from '../files';
import { toFormation } from '../fit';
import { sampleGeometry } from '../sample';

const inputSchema = z.object({
  /** Small artwork travels inside the show (and its share link)... */
  svg: z.string().max(300_000).default('').describe('SVG markup'),
  /** ...large artwork stays a file on the visitor's device (see `formations/files.ts`). */
  fileId: z.string().default(''),
  name: z.string().max(80).default('SVG artwork'),
  /** Outlines only: drones trace the strokes and edges instead of filling the shapes. */
  outline: z.boolean().default(false).describe('Outline only'),
  useColors: z.boolean().default(true).describe('Use SVG colours'),
  fill: z.number().min(0.3).max(1).default(0.85).describe('Size'),
});
export type SvgInput = z.infer<typeof inputSchema>;

/** SVG paths -> filled shapes -> sampled. Needs DOMParser, so it runs on the main thread. */
export const svgSource: FormationSource<SvgInput> = {
  id: 'svg',
  label: 'SVG',
  icon: 'PenTool',
  inputSchema,
  runsIn: 'main',
  describe: (input) => input.name,
  async generate(input, { count, signal, file }) {
    if (input.fileId && !file) throw new FileMissingError(input.fileId, input.name);
    const markup = file ? new TextDecoder().decode(file) : input.svg;
    if (!/<svg[\s>]/i.test(markup)) throw new Error('That file is not an SVG drawing');
    const { paths } = new SVGLoader().parse(markup);
    const parts: BufferGeometry[] = [];
    for (const path of paths) {
      const style = path.userData?.style as { fill?: string; stroke?: string; strokeWidth?: number } | undefined;
      const filled = !!style?.fill && style.fill !== 'none' && !input.outline;
      const stroked = !!style?.stroke && style.stroke !== 'none';
      let g: BufferGeometry | null = null;
      if (filled) {
        const shapes = SVGLoader.createShapes(path);
        if (shapes.length) g = new ShapeGeometry(shapes, 8);
      } else if (stroked || input.outline) {
        // Line art (icons, logos drawn with strokes): turn each stroke into a thin ribbon to sample.
        const strokeStyle = { ...SVGLoader.getStrokeStyle(Math.max(style?.strokeWidth ?? 1, 1), '#fff'), ...(input.outline ? {} : style) };
        const ribbons = path.subPaths.map((sub) => SVGLoader.pointsToStroke(sub.getPoints(), strokeStyle as never)).filter(Boolean) as BufferGeometry[];
        if (ribbons.length) g = mergeGeometries(ribbons.map((r) => (r.index ? r.toNonIndexed() : r)));
      }
      if (!g) continue;
      for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
      if (g.index) g = g.toNonIndexed();
      g.scale(1, -1, 1); // SVG y points down
      const colors = new Float32Array(g.attributes.position.count * 3);
      const paint = filled || !stroked ? path.color : new Color().setStyle(style!.stroke!);
      const srgb = paint.clone().convertLinearToSRGB(); // formation colours are sRGB
      for (let i = 0; i < colors.length; i += 3) srgb.toArray(colors, i);
      g.setAttribute('color', new BufferAttribute(colors, 3));
      parts.push(g);
    }
    if (parts.length === 0) throw new Error('Nothing to draw: this SVG has no filled shapes or strokes');
    const merged = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    const { positions, colors } = sampleGeometry(merged, count, { seed: 9, signal });
    merged.dispose();
    return toFormation('svg', input.name, positions, input.useColors ? colors : undefined, input.fill);
  },
};
