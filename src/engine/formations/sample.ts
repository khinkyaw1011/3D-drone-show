import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { type BufferGeometry, Color, Mesh, Vector3 } from 'three/webgpu';
import { SpatialGrid } from './spatialGrid';

/** Small seeded PRNG so a show regenerates identically on every device (mulberry32). */
export function seededRng(seed = 1): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

/**
 * The one sampling pipeline: any geometry -> exactly `count` surface points
 * (plus colours when the geometry carries a `color` attribute).
 *
 * MeshSurfaceSampler alone gives white noise, which clumps and reads as a particle cloud.
 * Real fleets keep a minimum separation, so candidates are dart-thrown against a spatial
 * hash: a point is kept only if no accepted point is closer than a spacing derived from
 * the surface area (see SpatialGrid). Whatever is still missing after the budget is filled without the test.
 */
export function sampleGeometry(
  geometry: BufferGeometry,
  count: number,
  opts: { seed?: number; signal?: AbortSignal } = {},
): { positions: Float32Array; colors?: Float32Array } {
  const hasColor = geometry.hasAttribute('color');
  const sampler = new MeshSurfaceSampler(new Mesh(geometry)).setRandomGenerator(seededRng(opts.seed)).build();
  const positions = new Float32Array(count * 3);
  const colors = hasColor ? new Float32Array(count * 3) : undefined;
  const p = new Vector3();
  const n = new Vector3();
  const c = new Color();

  const area = sampler.distribution ? sampler.distribution[sampler.distribution.length - 1] : 0;
  const spacing = Math.sqrt(area / count) * 0.78;
  const grid = new SpatialGrid(positions, spacing || 1);

  let placed = 0;
  const budget = count * 12;
  for (let attempt = 0; placed < count; attempt++) {
    if ((attempt & 2047) === 0) throwIfAborted(opts.signal);
    sampler.sample(p, n, hasColor ? c : undefined);
    if (spacing > 0 && attempt < budget && grid.near(p.x, p.y, p.z, spacing, () => true)) continue;
    p.toArray(positions, placed * 3);
    if (colors) c.toArray(colors, placed * 3);
    grid.insert(placed);
    placed++;
  }
  return { positions, colors };
}
