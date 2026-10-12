import { detourWeight, flightPose, localProgress } from '../sim/path';

export interface PathPlan {
  /** Per-drone xyz offset applied mid-flight (scaled by sin(pi * local progress)). */
  detours: Float32Array;
  /** Closest any two drones come at the sampled instants, in world units. */
  minSeparation: number;
  /** Pairs still closer than requested after planning (0 = clean). */
  conflicts: number;
}

interface PlanOptions {
  stagger: number;
  launch: boolean;
  /** Required clearance between any two drones, in world units. */
  separation: number;
  samples?: number;
  iterations?: number;
  /** Largest detour allowed, in world units. */
  maxDetour?: number;
}

/**
 * Pre-flight de-confliction, the way real shows are choreographed: sample the transition,
 * find every pair of drones that would pass closer than `separation` (spatial hash, so it
 * stays linear in fleet size), and bend both routes apart with a mid-flight detour.
 * Repeat until clean. End poses are never moved, so formations stay exact.
 */
export function planPaths(from: Float32Array, to: Float32Array, delays: Float32Array, options: PlanOptions): PathPlan {
  const { stagger, separation, samples = 16, iterations = 10, maxDetour = 6 } = options;
  const launch = options.launch ? 1 : 0;
  const count = from.length / 3;
  const detours = new Float32Array(count * 3);
  const poses = new Float32Array(count * 3);
  const weights = new Float32Array(count);
  const pose = [0, 0, 0];
  const cell = Math.max(separation, 1e-3);
  const grid = new Map<number, number[]>();
  // Pack a cell coordinate into one integer key (cells within +-512 of the origin on each axis).
  const key = (x: number, y: number, z: number) => ((x + 512) << 20) | ((y + 512) << 10) | (z + 512);
  let minSeparation = Infinity;
  let conflicts = 0;

  for (let iteration = 0; iteration <= iterations; iteration++) {
    const measureOnly = iteration === iterations;
    conflicts = 0;
    minSeparation = Infinity;
    for (let s = 1; s < samples; s++) {
      const progress = s / samples;
      grid.clear();
      for (let i = 0; i < count; i++) {
        const local = localProgress(progress, stagger, delays[i]);
        weights[i] = detourWeight(local);
        flightPose(pose, from, to, detours, i, local, launch);
        poses.set(pose, i * 3);
        const k = key(Math.floor(pose[0] / cell), Math.floor(pose[1] / cell), Math.floor(pose[2] / cell));
        const bucket = grid.get(k);
        if (bucket) bucket.push(i);
        else grid.set(k, [i]);
      }
      for (let i = 0; i < count; i++) {
        const [px, py, pz] = [poses[i * 3], poses[i * 3 + 1], poses[i * 3 + 2]];
        const [cx, cy, cz] = [Math.floor(px / cell), Math.floor(py / cell), Math.floor(pz / cell)];
        for (let x = cx - 1; x <= cx + 1; x++)
          for (let y = cy - 1; y <= cy + 1; y++)
            for (let z = cz - 1; z <= cz + 1; z++) {
              const bucket = grid.get(key(x, y, z));
              if (!bucket) continue;
              for (const j of bucket) {
                if (j <= i) continue;
                let dx = px - poses[j * 3];
                let dy = py - poses[j * 3 + 1];
                let dz = pz - poses[j * 3 + 2];
                let d = Math.hypot(dx, dy, dz);
                // Neighbours parked or already in formation are as close as the formation puts them.
                if (weights[i] < 0.05 && weights[j] < 0.05) continue;
                if (d < minSeparation) minSeparation = d;
                if (d >= separation) continue;
                conflicts++;
                if (measureOnly) continue;
                if (d < 1e-4) {
                  // Coincident: pick a stable arbitrary direction from the indices.
                  [dx, dy, dz, d] = [Math.sin(i * 12.99 + j), Math.cos(i * 78.23 + j), Math.sin(i + j * 37.7), 1];
                }
                // Split the push by how much say each drone's detour has at this instant.
                const total = weights[i] + weights[j];
                const push = ((separation - d) * 1.15) / d / Math.max(total, 0.1);
                for (const [index, sign] of [
                  [i, 1],
                  [j, -1],
                ] as const) {
                  const share = (weights[index] / Math.max(total, 1e-6)) * push * sign;
                  detours[index * 3] += dx * share;
                  detours[index * 3 + 1] += dy * share;
                  detours[index * 3 + 2] += dz * share;
                }
              }
            }
      }
    }
    if (conflicts === 0) break;
    if (!measureOnly) {
      for (let i = 0; i < count; i++) {
        const length = Math.hypot(detours[i * 3], detours[i * 3 + 1], detours[i * 3 + 2]);
        if (length > maxDetour) for (let k = 0; k < 3; k++) detours[i * 3 + k] *= maxDetour / length;
      }
    }
  }
  return { detours, minSeparation: Number.isFinite(minSeparation) ? minSeparation : separation, conflicts };
}

/** Smallest nearest-neighbour distance in a formation (sampled), used to cap the requested clearance. */
export function formationSpacing(positions: Float32Array, probes = 400): number {
  const count = positions.length / 3;
  if (count < 2) return Infinity;
  const step = Math.max(1, Math.floor(count / probes));
  const nearest: number[] = [];
  for (let i = 0; i < count; i += step) {
    let best = Infinity;
    for (let j = 0; j < count; j++) {
      if (j === i) continue;
      const d = Math.hypot(positions[i * 3] - positions[j * 3], positions[i * 3 + 1] - positions[j * 3 + 1], positions[i * 3 + 2] - positions[j * 3 + 2]);
      if (d < best) best = d;
    }
    nearest.push(best);
  }
  // A low percentile rather than the minimum: one stray pair should not relax the whole plan.
  nearest.sort((a, b) => a - b);
  return nearest[Math.floor(nearest.length * 0.1)];
}
