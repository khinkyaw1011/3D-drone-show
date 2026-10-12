import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BufferAttribute, type BufferGeometry, Color, type Mesh, type MeshStandardMaterial } from 'three/webgpu';
import { z } from 'zod';
import type { FormationData, FormationSource } from '../../types';
import { assetUrl } from '../assets';
import { toFormation } from '../fit';
import { sampleGeometry } from '../sample';

export const MODELS = { horse: 'Horse', parrot: 'Parrot', flamingo: 'Flamingo' } as const;
export type ModelName = keyof typeof MODELS;

const inputSchema = z.object({
  model: z.enum(Object.keys(MODELS) as [ModelName, ...ModelName[]]).default('flamingo').describe('Model'),
  rotation: z.number().min(-180).max(180).default(-55).describe('Rotation'),
  useColors: z.boolean().default(true).describe('Use model colours'),
  fill: z.number().min(0.3).max(1).default(0.85).describe('Size'),
});
export type ModelInput = z.infer<typeof inputSchema>;

export interface GlbOptions {
  count: number;
  rotation: number;
  useColors: boolean;
  fill: number;
  label: string;
  signal?: AbortSignal;
}

/** Read a texture's pixels (worker-safe) so vertex colours can be baked from it. */
function texturePixels(image: unknown): ImageData | null {
  if (typeof OffscreenCanvas === 'undefined' || !image) return null;
  const src = image as ImageBitmap;
  if (!src.width || !src.height) return null;
  const w = Math.min(256, src.width);
  const h = Math.min(256, src.height);
  const ctx = new OffscreenCanvas(w, h).getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Give every mesh a `color` attribute: existing vertex colours, else its texture, else its material colour. */
function withColors(mesh: Mesh): BufferGeometry {
  const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial;
  const count = g.attributes.position.count;
  const existing = g.attributes.color;
  const colors = new Float32Array(count * 3);
  const pixels = !existing && g.attributes.uv ? texturePixels(material.map?.image) : null;
  const base = material.color ?? new Color(1, 1, 1);
  const c = new Color();
  for (let i = 0; i < count; i++) {
    if (existing) c.fromBufferAttribute(existing as BufferAttribute, i);
    else if (pixels) {
      const u = ((g.attributes.uv.getX(i) % 1) + 1) % 1;
      const v = ((g.attributes.uv.getY(i) % 1) + 1) % 1;
      const o = (Math.floor(v * (pixels.height - 1)) * pixels.width + Math.floor(u * (pixels.width - 1))) * 4;
      c.setRGB(pixels.data[o] / 255, pixels.data[o + 1] / 255, pixels.data[o + 2] / 255, 'srgb');
    } else c.copy(base);
    // Formation colours are sRGB everywhere; three's working space is linear.
    c.convertLinearToSRGB().toArray(colors, i * 3);
  }
  // Keep only what the sampler needs so differently-authored meshes merge cleanly.
  for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
  g.morphAttributes = {};
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g.index ? g.toNonIndexed() : g;
}

/** Any GLB -> sampled, coloured formation. Shared by the bundled models and user uploads. */
export async function sampleGlb(buffer: ArrayBuffer, opts: GlbOptions): Promise<FormationData> {
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  gltf.scene.updateMatrixWorld(true);
  const parts: BufferGeometry[] = [];
  gltf.scene.traverse((o) => {
    if ((o as Mesh).isMesh) parts.push(withColors(o as Mesh));
  });
  if (parts.length === 0) throw new Error('This model has no meshes to sample');
  const merged = mergeGeometries(parts).rotateY((opts.rotation * Math.PI) / 180);
  parts.forEach((p) => p.dispose());
  const { positions, colors } = sampleGeometry(merged, opts.count, { seed: 21, signal: opts.signal });
  merged.dispose();
  return toFormation('model', opts.label, positions, opts.useColors ? colors : undefined, opts.fill);
}

const bufferCache = new Map<ModelName, Promise<ArrayBuffer>>();

export const modelSource: FormationSource<ModelInput> = {
  id: 'model',
  label: '3D model',
  icon: 'Box',
  inputSchema,
  runsIn: 'worker',
  describe: (input) => MODELS[input.model],
  async generate(input, { count, signal }) {
    let buffer = bufferCache.get(input.model);
    if (!buffer) {
      buffer = fetch(assetUrl(`/models/${MODELS[input.model]}.glb`)).then((r) => {
        if (!r.ok) throw new Error(`Model ${input.model} failed to load`);
        return r.arrayBuffer();
      });
      bufferCache.set(input.model, buffer);
    }
    // GLTFLoader may detach the buffer, so parse a copy.
    return sampleGlb((await buffer).slice(0), { ...input, count, signal, label: MODELS[input.model] });
  },
};
