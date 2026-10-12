import {
  abs,
  float,
  floor,
  fract,
  length,
  mix,
  mx_cell_noise_float,
  mx_fractal_noise_float,
  normalize,
  positionLocal,
  pow,
  sin,
  smoothstep,
  step,
  time,
  uniform,
  vec3,
} from 'three/tsl';
import { BackSide, Color, MeshBasicNodeMaterial } from 'three/webgpu';
import type { SceneSettings } from '../types';

interface SkyPreset {
  top: string;
  horizon: string;
  glow: string; // low band of light on the horizon
  aurora: number;
  starBoost: number;
}

export const SKY: Record<SceneSettings['sky'], SkyPreset> = {
  midnight: { top: '#04050c', horizon: '#111b34', glow: '#27365e', aurora: 0, starBoost: 1 },
  aurora: { top: '#02060d', horizon: '#082028', glow: '#0f4a44', aurora: 1, starBoost: 0.9 },
  dusk: { top: '#0a0920', horizon: '#3a1d33', glow: '#a4553f', aurora: 0, starBoost: 0.6 },
  'deep-space': { top: '#010103', horizon: '#080612', glow: '#1b1235', aurora: 0, starBoost: 1.7 },
};

export function createSkyMaterial() {
  const u = {
    top: uniform(new Color(SKY.midnight.top)),
    horizon: uniform(new Color(SKY.midnight.horizon)),
    glow: uniform(new Color(SKY.midnight.glow)),
    aurora: uniform(0),
    stars: uniform(0.6),
    haze: uniform(0.15),
    ambient: uniform(0.3),
    starSize: uniform(0.3),
    twinkle: uniform(0.5),
    milkyWay: uniform(0.3),
  };

  const dir = normalize(positionLocal);
  // Mirror below the horizon so the dome never shows a bright under-side past the ground plane.
  const up = abs(dir.y);

  // Gradient: horizon glow -> horizon -> zenith. Haze lifts and widens the glow band.
  const band = pow(float(1).sub(up), float(22).sub(u.haze.mul(14)));
  const base = mix(u.horizon, u.top, pow(up, 0.42)).add(u.glow.mul(band).mul(u.haze.mul(0.5).add(0.12)));

  // Stars: one candidate per cell of a 3D grid on the sky dome, kept by a density threshold.
  const p = dir.mul(190);
  const cell = floor(p);
  const rnd = mx_cell_noise_float(cell);
  const dist = length(fract(p).sub(0.5));
  const flicker = float(1).sub(sin(time.mul(rnd.mul(3).add(0.6)).add(rnd.mul(40))).mul(0.5).add(0.5).mul(u.twinkle).mul(0.85));
  const star = smoothstep(u.starSize.mul(0.34).add(0.06), 0.0, dist)
    .mul(step(float(1).sub(u.stars.mul(0.075)), rnd))
    .mul(flicker)
    .mul(smoothstep(0.02, 0.22, dir.y));
  const starColor = mix(vec3(0.75, 0.84, 1), vec3(1, 0.9, 0.78), fract(rnd.mul(17)));

  // Milky Way: a soft, clumpy band along a tilted great circle, with more (faint) stars inside it.
  const bandAxis = normalize(vec3(0.35, 0.5, -0.8));
  const inBand = smoothstep(0.42, 0, abs(dir.dot(bandAxis)));
  const dust = mx_fractal_noise_float(dir.mul(5.5), 4).mul(0.5).add(0.5);
  const milky = inBand.mul(dust).mul(dust).mul(u.milkyWay).mul(smoothstep(0, 0.25, dir.y));
  const milkyColor = mix(vec3(0.32, 0.36, 0.55), vec3(0.6, 0.5, 0.48), dust);

  // Aurora: slow vertical curtains from fractal noise, confined to a band of elevation.
  const curtain = mx_fractal_noise_float(vec3(dir.x.mul(2.2).add(time.mul(0.02)), dir.y.mul(0.6), dir.z.mul(2.2)), 3);
  const rays = abs(sin(dir.x.mul(26).add(curtain.mul(7)).add(time.mul(0.12))));
  const aurora = smoothstep(0.05, 0.3, dir.y)
    .mul(smoothstep(0.75, 0.25, dir.y))
    .mul(curtain.mul(0.5).add(0.5))
    .mul(rays.mul(0.5).add(0.5))
    .mul(u.aurora);
  const auroraColor = mix(vec3(0.1, 0.95, 0.6), vec3(0.35, 0.3, 0.95), smoothstep(0.2, 0.6, dir.y));

  const material = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
  // `ambient` dims the backdrop (never the stars' count) so drone LEDs stay the brightest thing in frame.
  const dim = u.ambient.mul(1.4).add(0.12);
  material.colorNode = base
    .mul(dim)
    .add(starColor.mul(star).mul(milky.mul(2).add(0.55)))
    .add(milkyColor.mul(milky).mul(0.2))
    .add(auroraColor.mul(aurora).mul(0.42).mul(dim));

  const apply = (scene: Pick<SceneSettings, 'sky' | 'stars' | 'fog' | 'ambient' | 'starSize' | 'starTwinkle' | 'milkyWay'>) => {
    const preset = SKY[scene.sky];
    u.top.value.set(preset.top);
    u.horizon.value.set(preset.horizon);
    u.glow.value.set(preset.glow);
    u.aurora.value = preset.aurora;
    u.stars.value = scene.stars * preset.starBoost;
    u.haze.value = scene.fog;
    u.ambient.value = scene.ambient;
    u.starSize.value = scene.starSize;
    u.twinkle.value = scene.starTwinkle;
    u.milkyWay.value = scene.milkyWay;
  };
  return { material, uniforms: u, apply };
}

/** The sky's colour exactly at the horizon, so the ground can fade into it seamlessly. */
export function horizonColor(scene: Pick<SceneSettings, 'sky' | 'fog' | 'ambient'>, target = new Color()): Color {
  const preset = SKY[scene.sky];
  return target
    .set(preset.horizon)
    .add(new Color(preset.glow).multiplyScalar(scene.fog * 0.5 + 0.12))
    .multiplyScalar(scene.ambient * 1.4 + 0.12);
}
