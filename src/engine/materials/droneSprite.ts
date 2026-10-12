import {
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
import type { SimBuffers } from '../sim/Simulator';

export function createDroneUniforms() {
  return {
    size: uniform(0.22),
    /** Airframe scale in world units (the LED size is `size`). */
    body: uniform(0.62),
    glow: uniform(1.2),
    twinkle: uniform(0.25),
    trail: uniform(1),
    bob: uniform(0.2),
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

/** Where a drone is drawn: simulated position + hover bob + cursor push. Shared by the sprite and the close-up mesh. */
export function droneWorldPosition(buffers: SimBuffers, u: DroneUniforms) {
  const position = buffers.position.toAttribute();
  const seed = hash(instanceIndex);
  // Hover bob: every drone drifts on its own little orbit so a held formation still breathes.
  const phase = time.mul(seed.mul(0.6).add(0.9)).add(seed.mul(6.283));
  const bob = vec3(sin(phase.mul(0.7)), sin(phase), sin(phase.mul(0.5).add(1.3))).mul(u.bob).mul(0.14);
  // Cursor push: displace radially from the pointer, falling off with distance.
  const away = position.xyz.sub(u.pushPoint);
  const push = normalize(away.add(vec3(0.0001))).mul(smoothstep(4.5, 0, length(away))).mul(u.pushStrength);
  return position.xyz.add(bob).add(push);
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
  const size = max(u.size.mul(seed.mul(0.3).add(0.85)), viewCenter.z.negate().mul(u.pixelScale).mul(1.5));
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
  const halo = exp(d.mul(d).mul(-7)).mul(u.glow).mul(0.28);
  const shape = core.add(halo).mul(smoothstep(1, 0.75, d));

  material.colorNode = color.xyz
    .pow(vec3(2.2)) // formation colours are sRGB; the working space is linear
    .mul(u.glow.mul(0.35).add(0.55)).mul(twinkle).mul(energy).mul(u.power);
  material.opacityNode = shape;
  return { material, uniforms: u };
}
