import { attribute, cos, float, length, mix, mx_noise_float, normalLocal, normalize, positionGeometry, sin, smoothstep, time, uniform, vec2, vec3 } from 'three/tsl';
import { DoubleSide, MeshBasicNodeMaterial, Vector2 } from 'three/webgpu';
import type { SceneLight } from './lighting';

/** Wind shared by the grass and the trees: a direction on the ground plane and a 0..1 strength. */
export function createWindUniforms() {
  return { direction: uniform(new Vector2(1, 0)), strength: uniform(0.3) };
}
export type WindUniforms = ReturnType<typeof createWindUniforms>;

/**
 * Gusts roll across the field: large slow waves of noise travelling downwind, with a faster
 * flutter on top. Returns how far (0..~1.3) something at `ground` is pushed right now.
 */
function gust(ground: ReturnType<typeof vec3>['xz'], wind: WindUniforms) {
  const travel = ground.sub(wind.direction.mul(time.mul(wind.strength.mul(9).add(1.5))));
  const swell = mx_noise_float(vec3(travel.mul(0.045), time.mul(0.12))).mul(0.5).add(0.5);
  const flutter = sin(time.mul(wind.strength.mul(4).add(2.2)).add(ground.x.mul(0.9)).add(ground.y.mul(0.7))).mul(0.18);
  return swell.add(flutter).mul(wind.strength.mul(1.2).add(0.08));
}

/**
 * Grass: one tapered blade per instance, placed by the `blade` attribute (x, z, height, yaw).
 * Each blade bends downwind like a cantilever (deflection grows with the square of height
 * along the blade), so the tips move and the roots stay planted.
 */
export function createGrassMaterial(wind: WindUniforms, light: SceneLight) {
  const u = { ambient: uniform(0.3) };
  const blade = attribute('blade', 'vec4');
  const along = positionGeometry.y; // 0 at the root, 1 at the tip
  const width = positionGeometry.x.mul(float(1).sub(along.mul(0.9))).mul(0.075);
  const root = vec3(blade.x, 0, blade.y);
  const side = vec3(cos(blade.w), 0, sin(blade.w));

  const push = gust(root.xz, wind).mul(along.mul(along)).mul(blade.z).mul(0.85);
  const bend = vec3(wind.direction.x, 0, wind.direction.y).mul(push);
  // Bending shortens the blade's reach upward a little, keeping its length roughly constant.
  const height = blade.z.mul(along).mul(float(1).sub(push.div(blade.z.add(0.001)).pow(2).mul(0.35)));

  const material = new MeshBasicNodeMaterial({ side: DoubleSide, fog: false });
  material.positionNode = root.add(side.mul(width)).add(vec3(0, height, 0)).add(bend);

  // Dark at the root, lighter at the tip. Then the show's own light: the fleet's LEDs wash the
  // grass beneath it in their colour (strongest under the formation, on the blade tips that
  // face the sky), and every firework burst flashes across the whole field.
  const shade = mix(vec3(0.004, 0.012, 0.006), vec3(0.03, 0.085, 0.035), along.pow(1.5)).mul(u.ambient.mul(1.6).add(0.35));
  const underShow = smoothstep(52, 4, length(root.xz.sub(vec2(0, 3))));
  const lit = mix(vec3(0), light.fleet, underShow.mul(along).mul(0.16)).add(mix(vec3(0), light.burst, along.mul(0.1)));
  material.colorNode = shade.add(lit);
  return { material, uniforms: u };
}

/** Trees: a canopy that leans and shivers with the same wind, the trunk held at the ground. */
export function createTreeMaterial(wind: WindUniforms, light: SceneLight) {
  const u = { ambient: uniform(0.3) };
  const tree = attribute('tree', 'vec4'); // x, z, scale, phase
  const local = positionGeometry;
  const root = vec3(tree.x, 0, tree.y);
  const heightUp = local.y.max(0);
  const sway = gust(root.xz.add(tree.w), wind).mul(heightUp.mul(heightUp)).mul(0.05);
  const material = new MeshBasicNodeMaterial({ fog: false });
  material.positionNode = root.add(local.mul(tree.z)).add(vec3(wind.direction.x, 0, wind.direction.y).mul(sway).mul(tree.z));
  const base = mix(vec3(0.004, 0.006, 0.006), vec3(0.012, 0.03, 0.018), smoothstep(0.3, 1, local.y.div(6))).mul(u.ambient.mul(1.5).add(0.3));
  // Only the faces turned towards the show catch its light; the far side of each tree stays dark.
  const toShow = normalize(vec3(0, 17, 0).sub(root));
  const facing = normalLocal.dot(toShow).max(0);
  const upward = normalLocal.y.max(0).mul(0.6).add(0.4);
  material.colorNode = base.add(mix(vec3(0), light.fleet, facing.mul(0.07))).add(mix(vec3(0), light.burst, upward.mul(0.06)));
  return { material, uniforms: u };
}
