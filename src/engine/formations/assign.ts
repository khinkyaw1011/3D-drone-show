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

/**
 * Untangle an assignment: swap the targets of nearby drones whenever that shortens their
 * combined (squared) flight. Assignments that minimise squared distance do not cross, so
 * every accepted swap removes a potential mid-air conflict before the path planner runs.
 */
export function improveAssignment(current: Float32Array, target: Float32Array, assignment: Uint32Array, passes = 3, window = 10): Uint32Array {
  const order = mortonOrder(current);
  const out = assignment.slice();
  const cost = (drone: number, point: number) => {
    const dx = current[drone * 3] - target[point * 3];
    const dy = current[drone * 3 + 1] - target[point * 3 + 1];
    const dz = current[drone * 3 + 2] - target[point * 3 + 2];
    return dx * dx + dy * dy + dz * dz;
  };
  for (let pass = 0; pass < passes; pass++) {
    let swaps = 0;
    for (let k = 0; k < order.length; k++) {
      const a = order[k];
      for (let w = 1; w <= window && k + w < order.length; w++) {
        const b = order[k + w];
        if (cost(a, out[b]) + cost(b, out[a]) + 1e-9 < cost(a, out[a]) + cost(b, out[b])) {
          [out[a], out[b]] = [out[b], out[a]];
          swaps++;
        }
      }
    }
    if (swaps === 0) break;
  }
  return out;
}

/** Reorder a `stride`-wide attribute by an assignment. */
export function permute(src: Float32Array, assignment: Uint32Array, stride: number): Float32Array {
  const out = new Float32Array(assignment.length * stride);
  for (let i = 0; i < assignment.length; i++) {
    for (let s = 0; s < stride; s++) out[i * stride + s] = src[assignment[i] * stride + s];
  }
  return out;
}
