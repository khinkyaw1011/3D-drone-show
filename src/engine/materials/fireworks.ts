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
  max,
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
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { AdditiveBlending, Color, DoubleSide, MeshBasicNodeMaterial } from 'three/webgpu';

export const FIREWORK_SHELLS = 10;
export const FIREWORK_SPARKS = 200;
export const FIREWORK_COUNT = FIREWORK_SHELLS * FIREWORK_SPARKS;
export const FIREWORK_STYLE = { mixed: 0, peony: 1, willow: 2, ring: 3 } as const;

/** Fraction of a shell's cycle spent climbing before it bursts. */
const RISE = 0.24;
/** How quickly sparks shed their launch speed (air drag). */
const DRAG = 3.2;

/**
 * Fireworks behind the show, entirely in the vertex shader: every spark's position and
 * velocity is a closed-form function of time and its index (shell, cycle, spark). No
 * simulation state, no per-frame CPU work, one draw call.
 *
 * A shell climbs with a short tail, flashes, then bursts as one of three classic types:
 *  - peony  : a round ball of stars
 *  - willow : slow, heavy stars that droop into long golden trails
 *  - ring   : a tilted circle
 * Sparks are quads stretched along their screen-space velocity, so they streak while fast
 * and shrink to glittering points as they die.
 */
export function createFireworksMaterial() {
  const u = {
    /** How many of the shells are firing (0 = off). */
    active: uniform(0),
    scale: uniform(1),
    /** Burst height multiplier. */
    height: uniform(1),
    /** FIREWORK_STYLE; `mixed` lets every shell pick its own type each time it fires. */
    style: uniform(0),
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
  const period = hash(shell.mul(7.13)).mul(2.6).add(3.6);
  const clock = time.div(period).add(hash(shell.mul(3.31)));
  const cycle = floor(clock);
  const phase = fract(clock);
  const seed = shell.mul(17).add(cycle.mul(31));

  const rise = clamp(phase.div(RISE), 0, 1);
  const burst = clamp(phase.sub(RISE).div(1 - RISE), 0, 1);
  const exploded = step(RISE, phase);

  // Shell type for this firing.
  const picked = floor(hash(seed.add(6)).mul(3)).add(1);
  const type = select(u.style.lessThan(0.5), picked, u.style);
  const willow = float(1).sub(clamp(type.sub(2).abs(), 0, 1));
  const ring = float(1).sub(clamp(type.sub(3).abs(), 0, 1));

  // Shells go up to either side of the fleet and well behind it, so bursts frame the show.
  const side = select(hash(seed.add(7)).lessThan(0.5), float(-1), float(1));
  const launch = vec3(side.mul(hash(seed.add(1)).mul(46).add(26)), 0.5, hash(seed.add(2)).mul(-50).sub(34));
  const apex = hash(seed.add(3)).mul(16).add(28).mul(u.height);
  const rocket = launch.add(vec3(0, apex.mul(float(1).sub(float(1).sub(rise).pow(2))), 0));

  // Launch direction: a point on a sphere, or (ring) on a tilted circle.
  const ball = normalize(
    vec3(hash(spark.mul(1.31).add(seed)), hash(spark.mul(2.73).add(seed).add(5)), hash(spark.mul(4.19).add(seed).add(9))).sub(0.5),
  );
  const angle = spark.div(FIREWORK_SPARKS).mul(6.283);
  const tilt = hash(seed.add(8)).sub(0.5).mul(1.6);
  const circle = vec3(cos(angle), sin(angle).mul(cos(tilt)), sin(angle).mul(sin(tilt)));
  const direction = mix(ball, circle, ring);

  // Peony stars leave at similar speeds (a clean ball); willow stars are slower and vary more.
  const speed = mix(hash(spark.add(seed)).mul(2.5).add(11), hash(spark.add(seed)).mul(5).add(5.5), willow).mul(u.scale);
  const gravity = mix(float(6), float(13), willow).mul(u.scale);
  const coast = float(1).sub(exp(burst.mul(-DRAG)));
  const spread = direction.mul(speed).mul(coast);
  const sag = vec3(0, burst.mul(burst).mul(gravity).negate(), 0);
  // d(position)/d(burst): which way, and how fast, the spark is moving right now.
  const velocity = direction.mul(speed).mul(exp(burst.mul(-DRAG))).mul(DRAG).add(vec3(0, burst.mul(gravity).mul(-2), 0));

  // While climbing, a few sparks trail behind the rocket as its tail; the rest wait, invisible.
  const tail = vec3(0, hash(spark).mul(-3.4).mul(rise), 0);
  const world = rocket.add(mix(tail, spread.add(sag), exploded));
  const worldVelocity = mix(vec3(0, 1, 0), velocity, exploded);

  // Brightness over the shell's life.
  const lit = step(shell.add(0.5), u.active);
  const climbing = step(spark, 13).mul(float(1).sub(hash(spark).mul(0.7))).mul(0.6);
  const life = mix(float(1), float(1.25), willow); // willow hangs in the air longer
  const fade = clamp(float(1).sub(burst.div(life)), 0, 1).pow(1.5);
  // Dying stars crackle: fast per-spark flicker that takes over in the last third.
  const glitter = mix(float(1), step(0.45, fract(time.mul(17).add(hash(spark.mul(9.1)).mul(7)))).mul(1.6), smoothstep(0.55, 0.9, burst));
  // Spark 0 of every shell is the break flash: one large, very short bloom of light.
  const flashSpark = step(spark, 0.5);
  const flash = smoothstep(0.1, 0, burst).mul(exploded);
  const brightness = mix(mix(climbing, fade.mul(glitter), exploded), flash.mul(0.35), flashSpark).mul(lit);

  // Billboard stretched along screen-space velocity: streaks while fast, points when slow.
  const viewCenter = cameraViewMatrix.mul(vec4(world, 1));
  const viewVelocity = cameraViewMatrix.mul(vec4(worldVelocity, 0)).xy;
  const pace = length(viewVelocity);
  const along = normalize(viewVelocity.add(vec2(0.0001, 0)));
  const stretch = mix(float(1), clamp(pace.mul(mix(float(0.16), float(0.34), willow)), 1, 7), exploded.mul(float(1).sub(flashSpark)));
  const size = mix(mix(float(0.3), float(0.36), exploded), float(3.2).mul(flash.add(0.2)), flashSpark)
    .mul(u.scale)
    .mul(step(0.001, brightness));
  const corner = positionGeometry.xy;
  const offset = along
    .mul(corner.x.sub(0.35).mul(stretch)) // the head leads; the streak trails behind it
    .add(vec2(along.y.negate(), along.x).mul(corner.y))
    .mul(size);

  const material = new MeshBasicNodeMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false, depthTest: false, side: DoubleSide, fog: false });
  material.vertexNode = cameraProjectionMatrix.mul(vec4(viewCenter.xy.add(offset), viewCenter.z, 1));

  const pick = hash(seed.add(4));
  const palette = select(pick.lessThan(0.34), u.colorA, select(pick.lessThan(0.67), u.colorB, u.colorC));
  const hue = cos(vec3(0, 0.33, 0.67).add(pick).mul(6.283)).mul(0.5).add(0.5);
  const gold = vec3(1, 0.72, 0.32);
  // Willows burn gold whatever the palette; every burst starts white-hot and cools into its colour.
  const base = mix(mix(palette, hue, u.rainbow), gold, willow.mul(0.75));
  const color = mix(base, vec3(1, 0.96, 0.88), max(smoothstep(0.1, 0, burst).mul(0.5), flashSpark));

  // Head bright, tail fading; soft round cross-section.
  const across = uv().y.sub(0.5).abs().mul(2);
  const headToTail = smoothstep(0, 0.85, uv().x);
  const disc = length(uv().sub(0.5)).mul(2);
  material.colorNode = color.mul(brightness.toVarying()).mul(1.15);
  material.opacityNode = mix(smoothstep(1, 0.15, across).mul(headToTail), smoothstep(1, 0, disc), flashSpark.toVarying());
  return { material, uniforms: u };
}
