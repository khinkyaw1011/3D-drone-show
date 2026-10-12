import { type Assigner, mortonAssign, permute } from '../formations/assign';
import { resolveColors } from '../formations/colors';
import { groundGrid } from '../formations/fit';
import { launchDelays } from '../formations/order';
import type { FormationData, Show } from '../types';

export interface CompiledFrame {
  positions: Float32Array; // xyz per drone, already assigned
  colors: Float32Array; // sRGB rgb per drone
  delays: Float32Array; // 0..1 launch delay per drone
}

export interface CompiledShow {
  count: number;
  ground: CompiledFrame;
  frames: CompiledFrame[];
}

const GROUND_COLOR = [0.5, 0.42, 0.28];

/**
 * Chain the assignment through the whole show: frame N is assigned against frame N-1,
 * so every keyframe has a fixed per-drone target and the timeline can be scrubbed exactly.
 */
export function compileShow(show: Show, formations: FormationData[], assigner: Assigner = mortonAssign): CompiledShow {
  const count = show.droneCount;
  const groundPositions = groundGrid(count);
  const ground: CompiledFrame = {
    positions: groundPositions,
    colors: Float32Array.from({ length: count * 3 }, (_, i) => GROUND_COLOR[i % 3]),
    delays: new Float32Array(count),
  };
  let previous = groundPositions;
  const frames = show.keyframes.map((kf, i) => {
    const formation = formations[i];
    const look = { ...show.look, ...kf.look };
    const assignment = assigner(previous, formation.positions);
    const positions = permute(formation.positions, assignment, 3);
    const colors = permute(resolveColors(formation, look), assignment, 3);
    previous = positions;
    return { positions, colors, delays: launchDelays(kf.transition.order, positions, colors) };
  });
  return { count, ground, frames };
}
