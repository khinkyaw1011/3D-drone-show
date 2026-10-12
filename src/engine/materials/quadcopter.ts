import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { attribute, cameraPosition, cos, float, hash, instanceIndex, length, mix, normalLocal, positionLocal, sin, smoothstep, time, vec3 } from 'three/tsl';
import { BoxGeometry, BufferAttribute, type BufferGeometry, CylinderGeometry, MeshBasicNodeMaterial, SphereGeometry } from 'three/webgpu';
import type { SimBuffers } from '../sim/Simulator';
import { type DroneUniforms, droneWorldPosition } from './droneSprite';

/** Airframes fade out between these camera distances (world units); beyond that only the LEDs remain. */
export const AIRFRAME_FADE = { near: 110, far: 170 };

const ARM = 0.42; // motor distance from the hub, in model units (the model is ~1 unit across)
const PART = { frame: 0, led: 1, motor: 2 } as const;

/**
 * Tag a part's vertices:
 *  - `color.x`  1 on the LED, 0 elsewhere (drives emissive colour)
 *  - `color.y`  shade tint for the part (0 dark carbon .. 1 pale)
 *  - `rotor`    xz of the motor a propeller turns about + spin direction (0 = does not spin)
 */
function part(geometry: BufferGeometry, kind: number, tint = 0, rotor: [number, number, number] = [0, 0, 0]): BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const count = g.attributes.position.count;
  const color = new Float32Array(count * 3);
  const spin = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    color.set([kind === PART.led ? 1 : 0, tint, 0], i * 3);
    spin.set(rotor, i * 3);
  }
  g.setAttribute('color', new BufferAttribute(color, 3));
  g.setAttribute('rotor', new BufferAttribute(spin, 3));
  g.deleteAttribute('uv');
  return g;
}

/**
 * Low-poly show drone, built in code so there is no asset or licence: canopy, battery,
 * four arms, motors with two-blade propellers that spin (alternating direction, as on a
 * real quadcopter), landing skids and the downward LED.
 */
export function createQuadcopterGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [
    part(new SphereGeometry(0.17, 12, 8).scale(1, 0.55, 1.25).translate(0, 0.03, 0), PART.frame, 0.25), // canopy
    part(new BoxGeometry(0.2, 0.07, 0.3).translate(0, -0.05, 0), PART.frame, 0.1), // battery tray
    part(new SphereGeometry(0.075, 10, 8).translate(0, -0.13, 0), PART.led),
  ];
  for (const side of [-1, 1]) {
    parts.push(part(new BoxGeometry(0.02, 0.02, 0.46).translate(side * 0.13, -0.2, 0), PART.frame, 0.05)); // skid
    for (const z of [-0.15, 0.15]) parts.push(part(new BoxGeometry(0.014, 0.12, 0.014).translate(side * 0.13, -0.14, z), PART.frame, 0.05));
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const [x, z] = [Math.cos(a) * ARM, Math.sin(a) * ARM];
    const direction = i % 2 === 0 ? 1 : -1;
    parts.push(part(new BoxGeometry(ARM, 0.03, 0.045).rotateY(-a).translate(x / 2, 0, z / 2), PART.frame, 0.12)); // arm
    parts.push(part(new CylinderGeometry(0.045, 0.05, 0.07, 10).translate(x, 0.03, z), PART.motor, 0.4)); // motor
    // Two-blade propeller: a thin, slightly pitched bar centred on the motor.
    parts.push(part(new BoxGeometry(0.36, 0.008, 0.04).rotateX(0.12).translate(x, 0.075, z), PART.frame, 0.55, [x, z, direction]));
  }
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

/**
 * Instanced airframes riding the same simulation buffers as the LED sprites. Propellers
 * spin, the frame banks into its velocity, and the body catches a little of its own LED
 * so it reads against the night sky. Everything shrinks to nothing past the fade distance.
 */
export function createQuadcopterMaterial(buffers: SimBuffers, u: DroneUniforms) {
  const world = droneWorldPosition(buffers, u);
  const velocity = buffers.velocity.toAttribute().xyz;
  const visible = smoothstep(AIRFRAME_FADE.far, AIRFRAME_FADE.near, length(world.sub(cameraPosition)));
  const tag = attribute('color', 'vec3');
  const rotor = attribute('rotor', 'vec3');

  // Propellers: rotate about their own motor axis; each drone starts at a different blade angle.
  const angle = time.mul(34).mul(rotor.z).add(hash(instanceIndex).mul(6.283));
  const rel = positionLocal.xz.sub(rotor.xy);
  const spun = vec3(
    rel.x.mul(cos(angle)).sub(rel.y.mul(sin(angle))).add(rotor.x),
    positionLocal.y,
    rel.x.mul(sin(angle)).add(rel.y.mul(cos(angle))).add(rotor.y),
  );
  const model = mix(positionLocal, spun, rotor.z.abs());

  // Shear the frame along horizontal velocity: reads as pitching/rolling into the move.
  const bank = vec3(velocity.x, 0, velocity.z).mul(0.05).clamp(vec3(-0.4), vec3(0.4));
  const tilted = model.add(bank.mul(model.y.add(0.1)).mul(1.6)).sub(vec3(0, bank.dot(vec3(model.x, 0, model.z)).mul(0.9), 0));

  const material = new MeshBasicNodeMaterial({ fog: false });
  material.positionNode = tilted.mul(u.body).mul(visible).add(world);

  const led = buffers.color.toAttribute().xyz.pow(vec3(2.2)).mul(u.power);
  const shade = normalLocal.y.mul(0.35).add(0.65);
  const underglow = float(1).sub(normalLocal.y).mul(0.5).add(0.2);
  const frame = mix(vec3(0.035, 0.038, 0.048), vec3(0.2, 0.21, 0.24), tag.y).mul(shade).add(led.mul(0.09).mul(underglow));
  material.colorNode = mix(frame, led.mul(2.6), tag.x);
  return material;
}
