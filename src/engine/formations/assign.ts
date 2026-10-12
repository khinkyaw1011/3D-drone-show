import { muxScaled3 } from '@thi.ng/morton';
import { computeBounds } from './fit';

/** Indices of points sorted along a 3D Z-order (Morton) curve. */
export function mortonOrder(positions: Float32Array): Uint32Array {
  const count = positions.length / 3;
  const { min, max } = computeBounds(positions);
  // Guard degenerate (flat) axes so scaling never divides by zero.
  const hi = max.map((m, i) => (m - min[i] < 1e-6 ? min[i] + 1 : m));
  const keys = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    keys[i] =
      muxScaled3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], min[0], hi[0], min[1], hi[1], min[2], hi[2]) >>> 0;
  }
  return Uint32Array.from({ length: count }, (_, i) => i).sort((a, b) => keys[a] - keys[b]);
}

export type Assigner = (current: Float32Array, target: Float32Array) => Uint32Array;

/**
 * For each drone (index into `current`) return the index of the target point it flies to.
 * Sort both sets along a Morton curve and pair by rank, so neighbours stay neighbours.
 */
export const mortonAssign: Assigner = (current, target) => {
  const drones = mortonOrder(current);
  const targets = mortonOrder(target);
  const out = new Uint32Array(drones.length);
  for (let k = 0; k < drones.length; k++) out[drones[k]] = targets[k % targets.length];
  return out;
};

/** Reorder a `stride`-wide attribute by an assignment. */
export function permute(src: Float32Array, assignment: Uint32Array, stride: number): Float32Array {
  const out = new Float32Array(assignment.length * stride);
  for (let i = 0; i < assignment.length; i++) {
    for (let s = 0; s < stride; s++) out[i * stride + s] = src[assignment[i] * stride + s];
  }
  return out;
}
