import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { type BufferGeometry, Color, Mesh, Vector3 } from 'three/webgpu';

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
 * the surface area. Whatever is still missing after the budget is filled without the test.
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
  const cell = spacing || 1;
  const grid = new Map<string, number[]>();
  const cellOf = (v: number) => Math.floor(v / cell);
  const tooClose = () => {
    const [cx, cy, cz] = [cellOf(p.x), cellOf(p.y), cellOf(p.z)];
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let z = cz - 1; z <= cz + 1; z++) {
          const bucket = grid.get(`${x},${y},${z}`);
          if (!bucket) continue;
          for (const i of bucket) {
            const d = Math.hypot(positions[i * 3] - p.x, positions[i * 3 + 1] - p.y, positions[i * 3 + 2] - p.z);
            if (d < spacing) return true;
          }
        }
    return false;
  };

  let placed = 0;
  const budget = count * 12;
  for (let attempt = 0; placed < count; attempt++) {
    if ((attempt & 2047) === 0) throwIfAborted(opts.signal);
    sampler.sample(p, n, hasColor ? c : undefined);
    if (spacing > 0 && attempt < budget && tooClose()) continue;
    p.toArray(positions, placed * 3);
    if (colors) c.toArray(colors, placed * 3);
    const key = `${cellOf(p.x)},${cellOf(p.y)},${cellOf(p.z)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(placed);
    else grid.set(key, [placed]);
    placed++;
  }
  return { positions, colors };
}
