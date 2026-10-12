import { SpatialGrid } from './spatialGrid';

/**
 * The gap a fleet of `count` drones can hold inside the show volume, in world units.
 * Small fleets get generous spacing; very large ones are packed as tightly as they must be.
 */
export function fleetSpacing(count: number): number {
  return Math.min(0.5, Math.max(0.12, 0.55 * Math.sqrt(300 / count)));
}

/**
 * Push points apart until no two are closer than `spacing` (in place). Real fleets keep a
 * safety gap, so an over-dense shape (a thin ring, a tight helix) swells slightly instead
 * of stacking drones on top of each other.
 */
export function relax(positions: Float32Array, spacing: number, iterations = 12): Float32Array {
  const count = positions.length / 3;
  const grid = new SpatialGrid(positions, spacing);
  for (let iteration = 0; iteration < iterations; iteration++) {
    grid.rebuild(count);
    let moved = 0;
    for (let i = 0; i < count; i++) {
      const o = i * 3;
      grid.near(positions[o], positions[o + 1], positions[o + 2], spacing, (j, d) => {
        if (j <= i) return;
        let dx = positions[o] - positions[j * 3];
        let dy = positions[o + 1] - positions[j * 3 + 1];
        let dz = positions[o + 2] - positions[j * 3 + 2];
        if (d < 1e-5) {
          // Coincident points: split along a stable pseudo-random direction.
          [dx, dy, dz, d] = [Math.sin(i * 12.99 + j), Math.cos(i * 78.23 + j), Math.sin(i + j * 37.7), 1];
        }
        const push = ((spacing - d) / d) * 0.5;
        positions[o] += dx * push;
        positions[o + 1] += dy * push;
        positions[o + 2] += dz * push;
        positions[j * 3] -= dx * push;
        positions[j * 3 + 1] -= dy * push;
        positions[j * 3 + 2] -= dz * push;
        moved++;
      });
    }
    if (moved === 0) break;
  }
  return positions;
}
