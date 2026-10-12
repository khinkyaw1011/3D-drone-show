import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { attribute, cameraPosition, float, length, mix, normalLocal, positionLocal, smoothstep, vec3 } from 'three/tsl';
import { BoxGeometry, BufferAttribute, type BufferGeometry, CylinderGeometry, MeshBasicNodeMaterial, SphereGeometry } from 'three/webgpu';
import type { SimBuffers } from '../sim/Simulator';
import { type DroneUniforms, droneWorldPosition } from './droneSprite';

/** Airframes fade out between these camera distances (world units); beyond that only the LEDs remain. */
export const AIRFRAME_FADE = { near: 110, far: 170 };

/** Tag every vertex of a part: 0 = airframe, 1 = LED. */
function tag(geometry: BufferGeometry, led: number): BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.setAttribute('color', new BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(led), 3));
  g.deleteAttribute('uv');
  return g;
}

/** Procedural quadcopter (body, 4 arms, 4 rotors, LED), about 1 unit across: no asset, no licence. */
export function createQuadcopterGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [tag(new BoxGeometry(0.34, 0.1, 0.34), 0), tag(new SphereGeometry(0.09, 10, 8).translate(0, -0.09, 0), 1)];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const [x, z] = [Math.cos(a) * 0.42, Math.sin(a) * 0.42];
    parts.push(tag(new BoxGeometry(0.6, 0.035, 0.05).rotateY(-a).translate(x / 2, 0, z / 2), 0));
    parts.push(tag(new CylinderGeometry(0.2, 0.2, 0.012, 14).translate(x, 0.05, z), 0));
  }
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

/**
 * Instanced 3D airframes riding the same simulation buffers as the LED sprites.
 * They bank into their velocity, catch a little of their own LED colour so the body is
 * readable against the night sky, and shrink to nothing past the fade distance.
 */
export function createQuadcopterMaterial(buffers: SimBuffers, u: DroneUniforms) {
  const world = droneWorldPosition(buffers, u);
  const velocity = buffers.velocity.toAttribute().xyz;
  const visible = smoothstep(AIRFRAME_FADE.far, AIRFRAME_FADE.near, length(world.sub(cameraPosition)));
  // Shear the frame along horizontal velocity: reads as pitching/rolling into the turn.
  const bank = vec3(velocity.x, 0, velocity.z).mul(0.035).clamp(vec3(-0.45), vec3(0.45));
  const local = positionLocal.add(bank.mul(positionLocal.y.add(0.12)).mul(2)).add(vec3(0, bank.length().mul(-0.25), 0));
  const material = new MeshBasicNodeMaterial({ fog: false });
  material.positionNode = local.mul(u.body).mul(visible).add(world);
  const ledColor = buffers.color.toAttribute().xyz.pow(vec3(2.2)).mul(u.power);
  const shade = normalLocal.y.mul(0.4).add(0.6);
  const airframe = vec3(0.05, 0.055, 0.07).mul(shade).add(ledColor.mul(0.07).mul(float(1).sub(normalLocal.y).mul(0.5).add(0.25)));
  material.colorNode = mix(airframe, ledColor.mul(2.6), attribute('color', 'vec3').x);
  return material;
}
