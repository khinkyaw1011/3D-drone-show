import { type Assigner, improveAssignment, mortonAssign, permute } from '../formations/assign';
import { resolveColors } from '../formations/colors';
import { groundGrid, padLayout } from '../formations/fit';
import { launchDelays } from '../formations/order';
import { UNIT_METERS, durationForSpeed, peakSpeed } from '../sim/path';
import type { FormationData, Show } from '../types';
import { curveKind } from './buildTimeline';
import { formationSpacing, planPaths } from './planPaths';

export interface CompiledFrame {
  positions: Float32Array; // xyz per drone, already assigned
  colors: Float32Array; // sRGB rgb per drone
  delays: Float32Array; // 0..1 launch delay per drone
  /** Planned mid-flight detour per drone (xyz) for the transition INTO this frame. */
  detours: Float32Array;
  /** Transition length actually flown, in seconds (>= the keyframe's own duration). */
  duration: number;
  /** Flight statistics for the transition into this frame. */
  stats: { peakSpeed: number; minSeparation: number; conflicts: number }; // m/s, m, pairs
}

export interface CompiledShow {
  count: number;
  ground: CompiledFrame;
  frames: CompiledFrame[];
  /** Tightest neighbour spacing across all formations (world units): how big a drone may be drawn. */
  spacing: number;
}

const GROUND_COLOR = [0.5, 0.42, 0.28];

/**
 * Chain the assignment through the whole show: frame N is assigned against frame N-1,
 * so every keyframe has a fixed per-drone target and the timeline can be scrubbed exactly.
 * With realistic flight on, each transition is also stretched to respect the fleet's top
 * speed and its routes are de-conflicted before take-off.
 */
export function compileShow(show: Show, formations: FormationData[], assigner: Assigner = mortonAssign): CompiledShow {
  const count = show.droneCount;
  const groundPositions = groundGrid(count);
  const ground: CompiledFrame = {
    positions: groundPositions,
    colors: Float32Array.from({ length: count * 3 }, (_, i) => GROUND_COLOR[i % 3]),
    delays: new Float32Array(count),
    detours: new Float32Array(count * 3),
    duration: 0,
    stats: { peakSpeed: 0, minSeparation: 0, conflicts: 0 },
  };
  let previous = groundPositions;
  const frames = show.keyframes.map((kf, i) => {
    const formation = formations[i];
    const look = { ...show.look, ...kf.look };
    const launch = i === 0;
    const { stagger, order } = kf.transition;
    const assignment = improveAssignment(previous, formation.positions, assigner(previous, formation.positions));
    const positions = permute(formation.positions, assignment, 3);
    const colors = permute(resolveColors(formation, look), assignment, 3);
    // Lift-off goes row by row from the back of the pad; other transitions follow the keyframe's order.
    const delays = launch ? launchDelays('top-down', flipY(previous), colors) : launchDelays(order, positions, colors);

    const frame: CompiledFrame = {
      positions,
      colors,
      delays,
      ...planTransition(previous, positions, delays, show.flight, {
        stagger,
        launch,
        duration: kf.transition.duration,
        planned: curveKind(kf.transition.curve) === 'ease',
        spacingFrom: launch ? Infinity : formationSpacing(previous),
      }),
    };
    previous = positions;
    return frame;
  });
  const spacing = Math.min(padLayout(count).spacing, ...frames.map((f) => formationSpacing(f.positions)));
  return { count, ground, frames, spacing };
}

interface TransitionOptions {
  stagger: number;
  launch: boolean;
  /** The duration the keyframe asks for; realistic flight may lengthen it. */
  duration: number;
  /** Whether the route is a pure function of progress (and so can be de-conflicted ahead of time). */
  planned: boolean;
  /** Nearest-neighbour spacing of the departing formation, if known. */
  spacingFrom?: number;
}

/**
 * Timing and routes for one transition: stretch it until the farthest-flying drone obeys the
 * fleet's top speed, then de-conflict. Shared by the compiled show and by live "fly to" moves.
 */
export function planTransition(
  from: Float32Array,
  to: Float32Array,
  delays: Float32Array,
  flight: Show['flight'],
  { stagger, launch, duration: requested, planned, spacingFrom = Infinity }: TransitionOptions,
): Pick<CompiledFrame, 'detours' | 'duration' | 'stats'> {
  const count = to.length / 3;
  let farthest = 0;
  for (let i = 0; i < to.length; i += 3) farthest = Math.max(farthest, Math.hypot(to[i] - from[i], to[i + 1] - from[i + 1], to[i + 2] - from[i + 2]));
  const duration = flight.realistic ? Math.max(requested, durationForSpeed(farthest, flight.maxSpeed / UNIT_METERS, stagger, launch)) : requested;
  // Never ask for more clearance than the formations themselves provide.
  const clearance = Math.min(flight.separation / UNIT_METERS, formationSpacing(to) * 0.85, spacingFrom * 0.85);
  const plan =
    flight.realistic && planned && farthest > 1e-3
      ? planPaths(from, to, delays, { stagger, launch, separation: clearance, iterations: count > 6000 ? 4 : 12 })
      : { detours: new Float32Array(count * 3), minSeparation: 0, conflicts: 0 };
  return {
    detours: plan.detours,
    duration,
    stats: { peakSpeed: peakSpeed(farthest, duration, stagger, launch) * UNIT_METERS, minSeparation: plan.minSeparation * UNIT_METERS, conflicts: plan.conflicts },
  };
}

/** Rows of the launch pad run along z; reuse the top-down ordering by presenting z as height. */
function flipY(positions: Float32Array): Float32Array {
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    out[i] = positions[i];
    out[i + 1] = -positions[i + 2];
    out[i + 2] = positions[i + 1];
  }
  return out;
}
