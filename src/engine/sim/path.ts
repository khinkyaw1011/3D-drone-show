/**
 * The flight path of one drone as a pure function of transition progress.
 * The GPU simulator (TSL), the CPU simulator and the pre-flight planner all implement
 * exactly this, which is what lets the planner guarantee separation ahead of time.
 */

/** World units -> metres. The show volume (38 x 20 units) is roughly a 150 m wide sky. */
export const UNIT_METERS = 4;

/** Fractions of a launch spent climbing / sliding sideways (climb leads, slide follows). */
export const LAUNCH = { riseEnd: 0.8, slideStart: 0.3 };

/** GLSL smoothstep(0, 1, t). */
export const smooth = (t: number) => t * t * (3 - 2 * t);
const saturate = (t: number) => Math.min(1, Math.max(0, t));

/** Per-drone 0..1 progress: a later `delay` leaves later. */
export const localProgress = (progress: number, stagger: number, delay: number) =>
  saturate(progress * (1 + stagger) - delay * stagger);

/** How far along the detour bulge a drone is (0 at both ends, 1 mid-flight). */
export const detourWeight = (local: number) => Math.sin(local * Math.PI);

/** Write the pose of drone `i` into `out` (xyz). `stride` is 3 or 4 for the from/to arrays. */
export function flightPose(
  out: number[] | Float32Array,
  from: ArrayLike<number>,
  to: ArrayLike<number>,
  detours: ArrayLike<number> | null,
  i: number,
  local: number,
  launch: number,
  stride = 3,
) {
  const eased = smooth(local);
  const rise = eased + (smooth(saturate(local / LAUNCH.riseEnd)) - eased) * launch;
  const slide = eased + (smooth(saturate((local - LAUNCH.slideStart) / (1 - LAUNCH.slideStart))) - eased) * launch;
  const bulge = detours ? detourWeight(local) : 0;
  const o = i * stride;
  for (let k = 0; k < 3; k++) {
    const e = k === 1 ? rise : slide;
    out[k] = from[o + k] + (to[o + k] - from[o + k]) * e + (detours ? detours[i * 3 + k] * bulge : 0);
  }
  return out;
}

/** Peak speed (units/s) of the eased path over `distance` flown in `duration` seconds with this stagger. */
export function peakSpeed(distance: number, duration: number, stagger: number, launch: boolean) {
  // smoothstep peaks at 1.5x average; staggering squeezes each flight into 1/(1+stagger) of the time.
  const shaping = launch ? 1 / Math.min(LAUNCH.riseEnd, 1 - LAUNCH.slideStart) : 1;
  return (1.5 * (1 + stagger) * shaping * distance) / Math.max(duration, 1e-6);
}

/** Shortest duration that keeps the peak speed at or under `maxSpeed` (units/s). */
export const durationForSpeed = (distance: number, maxSpeed: number, stagger: number, launch: boolean) =>
  peakSpeed(distance, 1, stagger, launch) / Math.max(maxSpeed, 1e-6);
