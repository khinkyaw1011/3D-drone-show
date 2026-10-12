import { float, length, mix, mx_noise_vec3, positionWorld, reflector, smoothstep, time, uniform, vec3 } from 'three/tsl';
import { Color, MeshBasicNodeMaterial } from 'three/webgpu';

/**
 * Dark water plane. With `reflections` it mirrors the scene through three's TSL reflector,
 * rippled by noise; without (low tier) it is a plain dark surface that still fades to the horizon.
 */
export function createWaterMaterial(reflections: boolean, resolutionScale = 0.5) {
  const u = { tint: uniform(new Color('#0d1018')), horizon: uniform(new Color('#111b34')), ripple: uniform(0.035) };
  const material = new MeshBasicNodeMaterial({ fog: false });
  const distance = length(positionWorld.xz);
  const fade = smoothstep(60, 280, distance);

  let target = null;
  if (reflections) {
    const reflection = reflector({ resolutionScale, generateMipmaps: false });
    reflection.target.rotateX(-Math.PI / 2);
    const ripple = mx_noise_vec3(vec3(positionWorld.x.mul(0.35), positionWorld.z.mul(0.9), time.mul(0.35)));
    reflection.uvNode = reflection.uvNode!.add(ripple.xy.mul(u.ripple).mul(float(1).sub(fade)));
    material.colorNode = mix(reflection.rgb.mul(0.62).add(u.tint), u.horizon, fade);
    target = reflection.target;
  } else {
    material.colorNode = mix(u.tint, u.horizon, fade);
  }
  return { material, uniforms: u, target };
}
