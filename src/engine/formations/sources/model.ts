import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AnimationMixer, BufferAttribute, BufferGeometry, Color, type Mesh, type MeshStandardMaterial, type SkinnedMesh, Vector3 } from 'three/webgpu';
import { z } from 'zod';
import type { FormationData, FormationSource } from '../../types';
import { assetUrl } from '../assets';
import { FileMissingError } from '../files';
import { toFormation } from '../fit';
import { sampleGeometry } from '../sample';

export const MODELS = { horse: 'Horse', parrot: 'Parrot', flamingo: 'Flamingo' } as const;
export type ModelName = keyof typeof MODELS;

const inputSchema = z.object({
  model: z.enum(Object.keys(MODELS) as [ModelName, ...ModelName[]]).default('flamingo').describe('Model'),
  rotation: z.number().min(-180).max(180).default(-55).describe('Rotation'),
  /** Where in the model's animation the pose is taken (0 = start, 1 = end). */
  pose: z.number().min(0).max(1).default(0).describe('Animation pose'),
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
  /** Which of the model's animations to pose it with, and where in it (0..1). */
  clip?: number;
  pose?: number;
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

/**
 * One mesh as plain world-space triangles with a `color` attribute: existing vertex colours,
 * else its texture, else its material colour. Positions are read through `getVertexPosition`,
 * which applies morph targets and skinning, so an animated model is sampled in its current pose.
 */
function withColors(mesh: Mesh): BufferGeometry {
  const source = mesh.geometry;
  (mesh as SkinnedMesh).skeleton?.update();
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial;
  const count = source.attributes.position.count;
  const existing = source.attributes.color;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const pixels = !existing && source.attributes.uv ? texturePixels(material.map?.image) : null;
  const base = material.color ?? new Color(1, 1, 1);
  const c = new Color();
  const v = new Vector3();
  for (let i = 0; i < count; i++) {
    mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld).toArray(positions, i * 3);
    if (existing) c.fromBufferAttribute(existing as BufferAttribute, i);
    else if (pixels) {
      const u = ((source.attributes.uv.getX(i) % 1) + 1) % 1;
      const w = ((source.attributes.uv.getY(i) % 1) + 1) % 1;
      const o = (Math.floor(w * (pixels.height - 1)) * pixels.width + Math.floor(u * (pixels.width - 1))) * 4;
      c.setRGB(pixels.data[o] / 255, pixels.data[o + 1] / 255, pixels.data[o + 2] / 255, 'srgb');
    } else c.copy(base);
    // Formation colours are sRGB everywhere; three's working space is linear.
    c.convertLinearToSRGB().toArray(colors, i * 3);
  }
  // Keep only what the sampler needs so differently-authored meshes merge cleanly.
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setAttribute('color', new BufferAttribute(colors, 3));
  if (source.index) g.setIndex(source.index.clone());
  return g.index ? g.toNonIndexed() : g;
}

let draco: DRACOLoader | null = null;

/** GLB reader for the common ways models are shipped: plain, Draco-compressed and meshopt-compressed. */
function glbLoader(): GLTFLoader {
  draco ??= new DRACOLoader().setDecoderPath(assetUrl('/draco/'));
  return new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
}

async function parseGlb(buffer: ArrayBuffer) {
  try {
    return await glbLoader().parseAsync(buffer, '');
  } catch (error) {
    throw new Error(`This model could not be read (${error instanceof Error ? error.message : String(error)}). Export it as a single binary .glb file.`);
  }
}

/** Names of a GLB's animations, in order (unnamed ones get an empty string). */
export async function inspectGlb(buffer: ArrayBuffer): Promise<string[]> {
  return (await parseGlb(buffer)).animations.map((clip) => clip.name ?? '');
}

/** Any GLB -> sampled, coloured formation. Shared by the bundled models and linked files. */
export async function sampleGlb(buffer: ArrayBuffer, opts: GlbOptions): Promise<FormationData> {
  const gltf = await parseGlb(buffer);
  const clip = gltf.animations[opts.clip ?? 0];
  if (clip && opts.pose) {
    const mixer = new AnimationMixer(gltf.scene);
    mixer.clipAction(clip).play();
    mixer.setTime(clip.duration * Math.min(opts.pose, 0.999));
  }
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

const glbInputSchema = z.object({
  /** The file on the visitor's device (see `formations/files.ts`); the model itself is not stored in the show. */
  fileId: z.string().min(1),
  name: z.string().max(80).default('Model'),
  /** Animation names found in the file when it was linked. */
  clips: z.array(z.string().max(80)).max(32).default([]),
  clip: z.number().int().min(0).max(31).default(0).describe('Animation'),
  pose: z.number().min(0).max(1).default(0).describe('Animation pose'),
  rotation: z.number().min(-180).max(180).default(0).describe('Rotation'),
  useColors: z.boolean().default(true).describe('Use model colours'),
  fill: z.number().min(0.3).max(1).default(0.85).describe('Size'),
});
export type GlbInput = z.infer<typeof glbInputSchema>;

/** A .glb model linked from the visitor's device. */
export const glbSource: FormationSource<GlbInput> = {
  id: 'glb',
  label: 'Your 3D model',
  icon: 'Box',
  inputSchema: glbInputSchema,
  runsIn: 'worker',
  describe: (input) => input.name,
  async generate(input, { count, signal, file }) {
    if (!file) throw new FileMissingError(input.fileId, input.name);
    return sampleGlb(file, { ...input, count, signal, label: input.name });
  },
};
