import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { attribute, cameraPosition, cos, float, hash, instanceIndex, length, mix, normalLocal, positionLocal, sin, smoothstep, time, vec3 } from 'three/tsl';
import { BoxGeometry, BufferAttribute, type BufferGeometry, CircleGeometry, CylinderGeometry, DoubleSide, MeshBasicNodeMaterial, SphereGeometry } from 'three/webgpu';
import { UNIT_METERS } from '../sim/path';
import type { SimBuffers } from '../sim/Simulator';
import { type DroneUniforms, droneWorldPosition } from './droneSprite';

/** Airframes fade out between these camera distances (world units); beyond that only the LEDs remain. */
export const AIRFRAME_FADE = { near: 170, far: 230 };

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
 * real quadcopter), landing skids and the downward LED. About 600 vertices: light enough
 * to draw a few thousand, since every drone in the show is one of these.
 */
export function createQuadcopterGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [
    part(new SphereGeometry(0.17, 8, 5).scale(1, 0.55, 1.25).translate(0, 0.03, 0), PART.frame, 0.25), // canopy
    part(new BoxGeometry(0.2, 0.06, 0.3).translate(0, -0.075, 0), PART.frame, 0.1), // battery tray
    part(new SphereGeometry(0.075, 6, 4).translate(0, -0.13, 0), PART.led),
  ];
  for (const side of [-1, 1]) {
    parts.push(part(new BoxGeometry(0.02, 0.02, 0.46).translate(side * 0.13, -0.2, 0), PART.frame, 0.05)); // skid
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const [x, z] = [Math.cos(a) * ARM, Math.sin(a) * ARM];
    const direction = i % 2 === 0 ? 1 : -1;
    parts.push(part(new BoxGeometry(ARM, 0.03, 0.045).rotateY(-a).translate(x / 2, 0.012, z / 2), PART.frame, 0.12)); // arm
    parts.push(part(new CylinderGeometry(0.045, 0.05, 0.07, 6, 1, true).translate(x, 0.03, z), PART.motor, 0.4)); // motor
    // Two-blade propeller: a thin, slightly pitched bar centred on the motor.
    parts.push(part(new BoxGeometry(0.36, 0.01, 0.045).rotateX(0.12).translate(x, 0.1, z), PART.frame, 1, [x, z, direction]));
    // The blur a fast propeller leaves: a thin disc just under the blades, so the "fan" reads even when small.
    parts.push(part(new CircleGeometry(0.185, 12).rotateX(-Math.PI / 2).translate(x, 0.072, z), PART.frame, 0.45));
  }
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

/**
 * Instanced airframes riding the same simulation buffers as the LED sprites. Propellers
 * spin, the frame leans with its acceleration, and the body catches a little of its own LED
 * so it reads against the night sky. Everything shrinks to nothing past the fade distance.
 */
export function createQuadcopterMaterial(buffers: SimBuffers, u: DroneUniforms) {
  const world = droneWorldPosition(buffers, u);
  const velocity = buffers.velocity.toAttribute().xyz;
  const visible = smoothstep(AIRFRAME_FADE.far, AIRFRAME_FADE.near, length(world.sub(cameraPosition)));
  const tag = attribute('color', 'vec3');
  const rotor = attribute('rotor', 'vec3');

  // Propellers: rotate about their own motor axis; each drone starts at a different blade angle.
  const angle = time.mul(26).mul(rotor.z).add(hash(instanceIndex).mul(6.283));
  const rel = positionLocal.xz.sub(rotor.xy);
  const spun = vec3(
    rel.x.mul(cos(angle)).sub(rel.y.mul(sin(angle))).add(rotor.x),
    positionLocal.y,
    rel.x.mul(sin(angle)).add(rel.y.mul(cos(angle))).add(rotor.y),
  );
  const model = mix(positionLocal, spun, rotor.z.abs());

  // Attitude from physics: a quadcopter can only accelerate by tilting its thrust, so it leans
  // in the direction it is accelerating by atan(a / g). It leans into a move as it speeds up
  // and back the other way as it brakes; hovering, it is level. (A little lean from drag too.)
  const accel = vec3(buffers.position.toAttribute().w, 0, buffers.color.toAttribute().w).mul(UNIT_METERS / 9.81);
  const lean = accel.add(vec3(velocity.x, 0, velocity.z).mul(0.008)).clamp(vec3(-0.75), vec3(0.75));
  const tilted = model.add(lean.mul(model.y.add(0.1)).mul(1.4)).sub(vec3(0, lean.dot(vec3(model.x, 0, model.z)), 0));

  // Double-sided: rotor discs are single planes, seen from below by the crowd.
  const material = new MeshBasicNodeMaterial({ fog: false, side: DoubleSide });
  material.positionNode = tilted.mul(u.body).mul(visible).add(world);

  const led = buffers.color.toAttribute().xyz.pow(vec3(2.2)).mul(u.power);
  const shade = normalLocal.y.mul(0.35).add(0.65);
  const underglow = float(1).sub(normalLocal.y).mul(0.5).add(0.2);
  // Dark carbon to pale plastic by part, strongly tinted by the drone's own LED: the body takes the
  // formation's colour, so a pink heart is made of pink drones.
  const frame = mix(mix(vec3(0.16, 0.17, 0.2), vec3(0.62, 0.64, 0.7), tag.y), led.mul(1.5), 0.55).mul(shade).add(led.mul(0.3).mul(underglow));
  material.colorNode = mix(frame, led.mul(2.6), tag.x);
  return material;
}
