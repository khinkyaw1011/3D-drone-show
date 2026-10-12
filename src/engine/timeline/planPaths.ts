import { SpatialGrid } from '../formations/spatialGrid';
import { carryWeight, detourWeight, flightPose, localProgress } from '../sim/path';

/** Detour weight above which a drone counts as in transit (roughly the middle 80% of its flight). */
const IN_TRANSIT = 0.3;
/** Fraction of the requested clearance a pair may dip to before it is treated as a conflict. */
const TOLERANCE = 0.85;

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
  /** Momentum each drone carries into the transition (see `carryWeight`); part of the path, so it is planned around. */
  carry?: Float32Array;
}

/**
 * Pre-flight de-confliction, the way real shows are choreographed: sample the transition,
 * find every pair of drones that would pass closer than `separation` (spatial hash, so it
 * stays linear in fleet size), and bend both routes apart with a mid-flight detour.
 * Repeat until clean. End poses are never moved, so formations stay exact.
 */
export function planPaths(from: Float32Array, to: Float32Array, delays: Float32Array, options: PlanOptions): PathPlan {
  const { stagger, separation, samples = 14, iterations = 12, maxDetour = 8, carry } = options;
  const launch = options.launch ? 1 : 0;
  const count = from.length / 3;
  const detours = new Float32Array(count * 3);
  const poses = new Float32Array(count * 3);
  const weights = new Float32Array(count);
  const pose = [0, 0, 0];
  const grid = new SpatialGrid(poses, Math.max(separation, 1e-3));
  let minSeparation = Infinity;
  let conflicts = 0;

  for (let iteration = 0; iteration <= iterations; iteration++) {
    const measureOnly = iteration === iterations;
    conflicts = 0;
    minSeparation = Infinity;
    for (let s = 1; s < samples; s++) {
      const progress = s / samples;
      const coasting = carryWeight(progress);
      for (let i = 0; i < count; i++) {
        const local = localProgress(progress, stagger, delays[i]);
        weights[i] = detourWeight(local);
        flightPose(pose, from, to, detours, i, local, launch);
        if (carry) for (let k = 0; k < 3; k++) pose[k] += carry[i * 3 + k] * coasting;
        poses.set(pose, i * 3);
      }
      grid.rebuild(count);
      for (let i = 0; i < count; i++) {
        const o = i * 3;
        grid.near(poses[o], poses[o + 1], poses[o + 2], separation, (j, distance) => {
          if (j <= i) return;
          // Two drones that are both (almost) parked or (almost) in formation are as close as the
          // formation itself puts them; only pairs with at least one drone in transit are routed.
          if (weights[i] < IN_TRANSIT && weights[j] < IN_TRANSIT) return;
          if (distance < minSeparation) minSeparation = distance;
          // Neighbours flying side by side breathe a little; only a real intrusion counts as a conflict.
          if (distance >= separation * TOLERANCE) return;
          conflicts++;
          if (measureOnly) return;
          let dx = poses[o] - poses[j * 3];
          let dy = poses[o + 1] - poses[j * 3 + 1];
          let dz = poses[o + 2] - poses[j * 3 + 2];
          let d = distance;
          if (d < 1e-4) {
            // Coincident: pick a stable arbitrary direction from the indices.
            [dx, dy, dz, d] = [Math.sin(i * 12.99 + j), Math.cos(i * 78.23 + j), Math.sin(i + j * 37.7), 1];
          }
          // Split the push by how much say each drone's detour has at this instant.
          const total = weights[i] + weights[j];
          const push = ((separation - d) * 1.3) / d / Math.max(total, 0.15);
          for (const [index, sign] of [
            [i, 1],
            [j, -1],
          ] as const) {
            const share = (weights[index] / total) * push * sign;
            detours[index * 3] += dx * share;
            detours[index * 3 + 1] += dy * share;
            detours[index * 3 + 2] += dz * share;
          }
        });
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
  return nearest[Math.floor(nearest.length * 0.02)];
}
