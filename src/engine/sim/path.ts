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

/** Hardest a show drone accelerates in formation flight, in m/s^2 (a comfortable ~30 degree tilt). */
export const MAX_ACCELERATION = 6;

/** Peak acceleration (units/s^2) of the eased path: smoothstep peaks at 6 d / T^2, squeezed by stagger like the speed. */
export function peakAcceleration(distance: number, duration: number, stagger: number, launch: boolean) {
  const shaping = launch ? 1 / Math.min(LAUNCH.riseEnd, 1 - LAUNCH.slideStart) : 1;
  return (6 * distance * ((1 + stagger) * shaping) ** 2) / Math.max(duration, 1e-6) ** 2;
}

/** Shortest duration that keeps the peak acceleration at or under `maxAcceleration` (units/s^2). */
export const durationForAcceleration = (distance: number, maxAcceleration: number, stagger: number, launch: boolean) =>
  Math.sqrt(peakAcceleration(distance, 1, stagger, launch) / Math.max(maxAcceleration, 1e-6));

/** Shortest duration that keeps the peak speed at or under `maxSpeed` (units/s). */
export const durationForSpeed = (distance: number, maxSpeed: number, stagger: number, launch: boolean) =>
  peakSpeed(distance, 1, stagger, launch) / Math.max(maxSpeed, 1e-6);

/** Rotate (x, z) about the vertical axis through (cx, cz); the simulators' hologram spin. */
export function spinXZ(x: number, z: number, cx: number, cz: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = x - cx;
  const dz = z - cz;
  return [dx * c + dz * s + cx, dz * c - dx * s + cz];
}
