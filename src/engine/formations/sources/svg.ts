import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BufferAttribute, type BufferGeometry, ShapeGeometry } from 'three/webgpu';
import { z } from 'zod';
import type { FormationSource } from '../../types';
import { toFormation } from '../fit';
import { sampleGeometry } from '../sample';

const inputSchema = z.object({
  svg: z.string().min(10).max(300_000).describe('SVG markup'),
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
  describe: () => 'SVG artwork',
  async generate(input, { count, signal }) {
    const { paths } = new SVGLoader().parse(input.svg);
    const parts: BufferGeometry[] = [];
    for (const path of paths) {
      const shapes = SVGLoader.createShapes(path);
      if (shapes.length === 0) continue;
      const g = new ShapeGeometry(shapes, 8).scale(1, -1, 1); // SVG y points down
      const colors = new Float32Array(g.attributes.position.count * 3);
      const srgb = path.color.clone().convertLinearToSRGB(); // formation colours are sRGB
      for (let i = 0; i < colors.length; i += 3) srgb.toArray(colors, i);
      g.setAttribute('color', new BufferAttribute(colors, 3));
      parts.push(g);
    }
    if (parts.length === 0) throw new Error('No filled shapes found in this SVG');
    const merged = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    const { positions, colors } = sampleGeometry(merged, count, { seed: 9, signal });
    merged.dispose();
    return toFormation('svg', 'SVG artwork', positions, input.useColors ? colors : undefined, input.fill);
  },
};
