import { Box3, Matrix4, Vector3 } from 'three/webgpu';
import type { FormationData, Vec3 } from '../types';
import { fleetSpacing, relax } from './relax';

/** The slice of sky a formation is fitted into (world units, y up, ground at 0). */
export const SHOW_VOLUME = {
  center: [0, 17, 0] as Vec3,
  size: [44, 24, 16] as Vec3,
};

export function computeBounds(positions: Float32Array): { min: Vec3; max: Vec3 } {
  const box = new Box3();
  const v = new Vector3();
  for (let i = 0; i < positions.length; i += 3) box.expandByPoint(v.fromArray(positions, i));
  return { min: box.min.toArray() as Vec3, max: box.max.toArray() as Vec3 };
}

/** Uniformly scale + centre points into the show volume, in place. */
export function fitToVolume(positions: Float32Array, volume = SHOW_VOLUME, fill = 1): Float32Array {
  if (positions.length === 0) return positions;
  const { min, max } = computeBounds(positions);
  const box = new Box3(new Vector3(...min), new Vector3(...max));
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const scale =
    fill *
    Math.min(
      volume.size[0] / Math.max(size.x, 1e-6),
      volume.size[1] / Math.max(size.y, 1e-6),
      volume.size[2] / Math.max(size.z, 1e-6),
    );
  const m = new Matrix4()
    .makeTranslation(...volume.center)
    .multiply(new Matrix4().makeScale(scale, scale, scale))
    .multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  const v = new Vector3();
  for (let i = 0; i < positions.length; i += 3) v.fromArray(positions, i).applyMatrix4(m).toArray(positions, i);
  return positions;
}

/** Wrap raw points into a fitted FormationData. */
export function toFormation(
  sourceId: string,
  label: string,
  positions: Float32Array,
  colors?: Float32Array,
  fill = 1,
): FormationData {
  fitToVolume(positions, SHOW_VOLUME, fill);
  // Fit first, then space: the safety gap is a real-world distance, not a fraction of the shape.
  relax(positions, fleetSpacing(positions.length / 3));
  return { positions, colors, count: positions.length / 3, meta: { sourceId, label, bounds: computeBounds(positions) } };
}

/** Launch pad sits under the show volume so the fleet climbs almost straight up, as real fleets do. */
const PAD = { spacing: 0.7, z: 3, y: 0.32 };

/** Columns / rows / footprint of the launch pad for a fleet size. */
export function padLayout(count: number) {
  const cols = Math.ceil(Math.sqrt(count * 2.4));
  const rows = Math.ceil(count / cols);
  return { cols, rows, spacing: PAD.spacing, width: cols * PAD.spacing, depth: rows * PAD.spacing, center: [0, PAD.y, PAD.z] as Vec3 };
}

/** Parked take-off grid on the launch pad, like a real show before lift-off. */
export function groundGrid(count: number): Float32Array {
  const out = new Float32Array(count * 3);
  const { cols, rows } = padLayout(count);
  for (let i = 0; i < count; i++) {
    out[i * 3] = ((i % cols) - (cols - 1) / 2) * PAD.spacing;
    out[i * 3 + 1] = PAD.y;
    out[i * 3 + 2] = (Math.floor(i / cols) - (rows - 1) / 2) * PAD.spacing + PAD.z;
  }
  return out;
}
