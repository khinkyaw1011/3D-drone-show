import {
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  cos,
  exp,
  float,
  floor,
  fract,
  hash,
  instanceIndex,
  length,
  mix,
  normalize,
  positionGeometry,
  select,
  sin,
  smoothstep,
  step,
  time,
  uniform,
  uv,
  vec3,
  vec4,
} from 'three/tsl';
import { AdditiveBlending, Color, DoubleSide, MeshBasicNodeMaterial } from 'three/webgpu';

export const FIREWORK_SHELLS = 10;
export const FIREWORK_SPARKS = 150;
export const FIREWORK_COUNT = FIREWORK_SHELLS * FIREWORK_SPARKS;

/** Fraction of a shell's cycle spent climbing before it bursts. */
const RISE = 0.26;

/**
 * Fireworks behind the show, entirely in the vertex shader: every spark's position is a
 * pure function of time and its index (shell, cycle, spark), so there is no simulation
 * state, no CPU work per frame and one draw call for the whole display.
 */
export function createFireworksMaterial() {
  const u = {
    /** How many of the shells are firing (0 = off). */
    active: uniform(0),
    scale: uniform(1),
    /** 1 = every shell picks its own hue; 0 = use the three palette colours. */
    rainbow: uniform(0),
    colorA: uniform(new Color('#ffd27a')),
    colorB: uniform(new Color('#ff8fb1')),
    colorC: uniform(new Color('#7cf7e4')),
  };

  const index = float(instanceIndex);
  const shell = floor(index.div(FIREWORK_SPARKS));
  const spark = index.sub(shell.mul(FIREWORK_SPARKS));

  // Each shell loops on its own period and offset; `cycle` reseeds it every time it fires.
  const period = hash(shell.mul(7.13)).mul(2.4).add(3.4);
  const clock = time.div(period).add(hash(shell.mul(3.31)));
  const cycle = floor(clock);
  const phase = fract(clock);
  const seed = shell.mul(17).add(cycle.mul(31));

  const rise = clamp(phase.div(RISE), 0, 1);
  const burst = clamp(phase.sub(RISE).div(1 - RISE), 0, 1);
  const exploded = step(RISE, phase);

  const launch = vec3(hash(seed.add(1)).sub(0.5).mul(110), 0.5, hash(seed.add(2)).mul(-34).sub(22));
  const apex = hash(seed.add(3)).mul(18).add(26);
  const rocket = launch.add(vec3(0, apex.mul(float(1).sub(float(1).sub(rise).pow(2))), 0));

  const direction = normalize(
    vec3(hash(spark.mul(1.31).add(seed)), hash(spark.mul(2.73).add(seed).add(5)), hash(spark.mul(4.19).add(seed).add(9))).sub(0.5),
  );
  const speed = hash(spark.add(seed)).mul(5).add(9).mul(u.scale);
  // Drag-limited expansion, then the sparks sag under gravity.
  const spread = direction.mul(speed).mul(float(1).sub(exp(burst.mul(-3.2))));
  const sag = vec3(0, burst.mul(burst).mul(-7).mul(u.scale), 0);
  // While climbing, a handful of sparks trail behind the rocket; the rest wait, invisible.
  const trail = vec3(0, hash(spark).mul(-2.6).mul(rise), 0);
  const world = rocket.add(mix(trail, spread.add(sag), exploded));

  const lit = step(shell.add(0.5), u.active);
  const climbing = step(spark, 9).mul(0.55);
  const fading = float(1).sub(burst).pow(1.6).mul(sin(time.mul(26).add(spark.mul(3.7))).mul(0.25).add(0.75));
  const brightness = mix(climbing, fading, exploded).mul(lit);

  const viewCenter = cameraViewMatrix.mul(vec4(world, 1));
  const size = mix(float(0.42), float(0.6), exploded).mul(u.scale).mul(step(0.001, brightness));
  const material = new MeshBasicNodeMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false, depthTest: false, side: DoubleSide, fog: false });
  material.vertexNode = cameraProjectionMatrix.mul(vec4(viewCenter.xy.add(positionGeometry.xy.mul(size)), viewCenter.z, 1));

  const pick = hash(seed.add(4));
  const palette = select(pick.lessThan(0.34), u.colorA, select(pick.lessThan(0.67), u.colorB, u.colorC));
  const hue = cos(vec3(0, 0.33, 0.67).add(pick).mul(6.283)).mul(0.5).add(0.5);
  // Bursts flash white-hot, then settle into their colour.
  const color = mix(mix(palette, hue, u.rainbow), vec3(1, 0.95, 0.85), smoothstep(0.18, 0, burst).mul(0.7));

  const d = length(uv().sub(0.5)).mul(2);
  material.colorNode = color.mul(brightness.toVarying()).mul(2.2);
  material.opacityNode = smoothstep(1, 0.1, d);
  return { material, uniforms: u };
}
