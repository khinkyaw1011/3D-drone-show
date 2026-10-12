import {
  abs,
  cos,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  exp,
  float,
  hash,
  instanceIndex,
  length,
  max,
  normalize,
  positionGeometry,
  sin,
  smoothstep,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { AdditiveBlending, DoubleSide, MeshBasicNodeMaterial, Vector3 } from 'three/webgpu';
import { SHOW_VOLUME } from '../formations/fit';
import type { SimBuffers } from '../sim/Simulator';

export function createDroneUniforms() {
  return {
    size: uniform(0.22),
    /** Airframe scale in world units (the LED size is `size`). */
    body: uniform(0.62),
    glow: uniform(1.2),
    twinkle: uniform(0.25),
    trail: uniform(1),
    bob: uniform(0.06),
    /** Show time in seconds. Unlike `time` it stops when the show is paused, so a paused fleet holds dead still. */
    clock: uniform(0),
    /** Formation movement: 0 none, 1 flap, 2 wave, 3 pulse, 4 sway; and its 0..1 strength. */
    motion: uniform(0),
    motionAmount: uniform(0),
    /** 0..1 LED brightness (dimmed during a "power off" drop). */
    power: uniform(1),
    /** World-space point drones shy away from (studio cursor toy) and how hard. */
    pushPoint: uniform(new Vector3(0, -999, 0)),
    pushStrength: uniform(0),
    /** World units per pixel at distance 1; keeps far drones at least ~1.5px wide. */
    pixelScale: uniform(0.002),
  };
}
export type DroneUniforms = ReturnType<typeof createDroneUniforms>;

const CENTER = vec3(...SHOW_VOLUME.center);
export const MOTION_ID = { none: 0, flap: 1, wave: 2, pulse: 3, sway: 4 } as const;

/**
 * Where a drone is drawn: simulated position + formation movement + hover drift + cursor push.
 * Shared by the LED sprite and the airframe. Everything here runs on the show clock, so
 * pausing the show freezes the fleet in the air exactly where it is.
 */
export function droneWorldPosition(buffers: SimBuffers, u: DroneUniforms) {
  const position = buffers.position.toAttribute();
  const seed = hash(instanceIndex);
  const rel = position.xyz.sub(CENTER);
  const is = (id: number) => float(1).sub(clamp(abs(u.motion.sub(id)), 0, 1));

  // Flap: the farther from the vertical axis, the bigger the stroke (wing tips beat, the body barely moves).
  const span = length(rel.xz);
  const flap = vec3(0, sin(u.clock.mul(3.4).sub(span.mul(0.1))).mul(span).mul(0.3), 0);
  // Wave: a ripple travelling along the formation. Pulse: breathing. Sway: leaning like a tree in wind.
  const ripple = u.clock.mul(2.1).add(rel.x.mul(0.32));
  const wave = vec3(0, sin(ripple).mul(1.3), cos(ripple).mul(0.7));
  const pulse = rel.mul(sin(u.clock.mul(1.7)).mul(0.08));
  const sway = vec3(sin(u.clock.mul(1.1)).mul(rel.y.add(12)).mul(0.09), 0, 0);
  const movement = flap.mul(is(1)).add(wave.mul(is(2))).add(pulse.mul(is(3))).add(sway.mul(is(4))).mul(u.motionAmount);

  // Hover drift: station-keeping error of a few centimetres, each drone on its own tiny orbit.
  const phase = u.clock.mul(seed.mul(0.6).add(0.9)).add(seed.mul(6.283));
  const bob = vec3(sin(phase.mul(0.7)), sin(phase), sin(phase.mul(0.5).add(1.3))).mul(u.bob).mul(0.14);
  // Cursor push: displace radially from the pointer, falling off with distance.
  const away = position.xyz.sub(u.pushPoint);
  const push = normalize(away.add(vec3(0.0001))).mul(smoothstep(4.5, 0, length(away))).mul(u.pushStrength);
  return position.xyz.add(movement).add(bob).add(push);
}

/**
 * One instanced quad per drone, billboarded in view space and stretched along its
 * screen-space velocity (cheap trails). Reads the simulator's storage buffers directly.
 */
export function createDroneMaterial(buffers: SimBuffers, u: DroneUniforms = createDroneUniforms()) {
  const velocity = buffers.velocity.toAttribute();
  const color = buffers.color.toAttribute();
  const seed = hash(instanceIndex);
  const world = droneWorldPosition(buffers, u);
  const viewCenter = cameraViewMatrix.mul(vec4(world, 1));
  const viewVelocity = cameraViewMatrix.mul(vec4(velocity.xyz, 0)).xy;
  const speed = length(viewVelocity);
  const dir = viewVelocity.div(max(speed, 0.0001)).mul(smoothstep(0.02, 0.4, speed)).add(vec2(0.0001, 0));
  const axis = normalize(dir);
  const stretch = float(1).add(clamp(speed.mul(u.trail).mul(0.09), 0, 5));
  const size = max(u.size.mul(seed.mul(0.3).add(0.85)), viewCenter.z.negate().mul(u.pixelScale).mul(1.6));
  const corner = positionGeometry.xy;
  const offset = axis
    .mul(corner.x.mul(stretch))
    .add(vec2(axis.y.negate(), axis.x).mul(corner.y))
    .mul(size);

  const material = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: DoubleSide, // the water reflection renders with a mirrored camera
    fog: false,
  });
  material.vertexNode = cameraProjectionMatrix.mul(vec4(viewCenter.xy.add(offset), viewCenter.z, 1));

  const twinkle = float(1)
    .sub(u.twinkle.mul(sin(time.mul(seed.mul(5).add(2)).add(seed.mul(100))).mul(0.5).add(0.5)))
    .toVarying();
  const energy = float(1).div(stretch.sqrt()).toVarying(); // stretched sprites keep the same total light

  const d = length(uv().sub(0.5)).mul(2);
  // A hard bright LED with a soft, tight halo: a lamp, not a fuzzy particle.
  const core = smoothstep(0.3, 0.12, d);
  const halo = exp(d.mul(d).mul(-7)).mul(u.glow).mul(0.16);
  const shape = core.add(halo).mul(smoothstep(1, 0.75, d));

  material.colorNode = color.xyz
    .pow(vec3(2.2)) // formation colours are sRGB; the working space is linear
    .mul(u.glow.mul(0.9).add(1.3)).mul(twinkle).mul(energy).mul(u.power);
  material.opacityNode = shape;
  return { material, uniforms: u };
}
