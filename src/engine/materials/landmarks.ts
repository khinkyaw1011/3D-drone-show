import {
  atan,
  cos,
  float,
  fract,
  length,
  max,
  min,
  mix,
  mx_noise_float,
  normalWorld,
  normalize,
  positionLocal,
  positionWorld,
  smoothstep,
  step,
  time,
  uniform,
  uv,
  vec3,
} from 'three/tsl';
import { Color, DoubleSide, MeshBasicNodeMaterial, type Node } from 'three/webgpu';

/**
 * Night-time landmarks around the show site. Each is self-lit (floodlights, outline bulbs),
 * so none of them needs scene lights, and all fade into the horizon colour with distance and haze.
 * They are scenery: their lights run on wall time, like the searchlights, not on the show clock.
 */

export type LandmarkUniforms = ReturnType<typeof createLandmarkUniforms>;

export function createLandmarkUniforms() {
  return {
    /** Colour distant scenery fades into (`horizonColor`). */
    horizon: uniform(new Color('#111b34')),
    /** The scene's haze. */
    haze: uniform(0.15),
    /** How bright the floodlights are; follows the scene's background brightness. */
    lights: uniform(0.3),
  };
}

/** Blend towards the horizon with distance; lamps (`keep` 1) hold their colour better than lit surfaces. */
function distant(color: Node<'vec3'>, u: LandmarkUniforms, keep = 0): Node<'vec3'> {
  const far = smoothstep(60, 440, length(positionWorld.xz));
  return mix(color, u.horizon, far.mul(u.haze.mul(0.6).add(0.3)).mul(1 - keep * 0.5));
}

/** 1 on a thin line where `x` crosses a whole number, 0 elsewhere. */
const line = (x: Node<'float'>, width: number) => float(1).sub(smoothstep(0, width, min(fract(x), float(1).sub(fract(x)))));

/** How much a surface faces floodlights standing in front of it (towards the audience). */
const floodlit = () => max(normalWorld.dot(normalize(vec3(0.2, 0.35, 1))), 0).mul(0.75).add(0.25);

const lightLevel = (u: LandmarkUniforms) => u.lights.mul(1.6).add(0.25);

/**
 * Lattice tower: open steelwork lit warm orange. The cylinder pieces have 4 sides; the lattice is
 * cut out of them (alpha test), so the sky shows through.
 */
export function createLatticeMaterial(u: LandmarkUniforms) {
  const material = new MeshBasicNodeMaterial({ side: DoubleSide, alphaTest: 0.5, fog: false });
  const s = uv().x.mul(16);
  const t = uv().y.mul(8);
  const mask = max(max(line(s.add(t), 0.07), line(s.sub(t), 0.07)), max(line(t, 0.05), line(uv().x.mul(4), 0.04)));
  material.opacityNode = mask;
  material.colorNode = distant(vec3(1, 0.42, 0.12).mul(lightLevel(u)).mul(uv().y.mul(-0.35).add(1)), u, 0.5);
  return material;
}

/** Solid parts of a tower (observation decks, antenna): a dark body with a band of lit windows. */
export function createDeckMaterial(u: LandmarkUniforms) {
  const material = new MeshBasicNodeMaterial({ fog: false });
  const windows = step(0.35, fract(positionWorld.x.add(positionWorld.z).mul(0.9))).mul(smoothstep(0.3, 0.4, uv().y)).mul(smoothstep(0.75, 0.65, uv().y));
  material.colorNode = distant(vec3(0.01, 0.012, 0.02).add(vec3(1, 0.85, 0.6).mul(windows).mul(lightLevel(u)).mul(0.8)), u, 0.5);
  return material;
}

/** Aviation warning lamp: slow red blink. */
export function createBeaconMaterial(u: LandmarkUniforms) {
  const material = new MeshBasicNodeMaterial({ fog: false });
  const blink = smoothstep(0.35, 0.5, fract(time.mul(0.6))).mul(smoothstep(1, 0.85, fract(time.mul(0.6))));
  material.colorNode = distant(vec3(1, 0.08, 0.05).mul(blink.mul(2.5).add(0.15)), u, 1);
  return material;
}

/** Gilded stupa under floodlights: bright where it faces the lamps, glowing at the spire. */
export function createGoldMaterial(u: LandmarkUniforms) {
  const material = new MeshBasicNodeMaterial({ fog: false });
  // Floodlights stand at the base; the spire is lit from its own lamps.
  const height = positionLocal.y.div(42);
  const lamps = smoothstep(0.55, 0, height).mul(0.5).add(smoothstep(0.65, 1, height).mul(0.6)).add(0.4);
  const sheen = mx_noise_float(positionLocal.mul(1.3)).mul(0.08).add(1);
  material.colorNode = distant(vec3(1, 0.68, 0.22).mul(floodlit()).mul(lamps).mul(sheen).mul(lightLevel(u)).mul(0.75), u, 0.4);
  return material;
}

/**
 * Ferris wheel rim and spokes: lines of bulbs chasing round in a slow rainbow.
 * Geometry is centred on the hub, so the angle around it is taken from local position.
 */
export function createWheelLightsMaterial(u: LandmarkUniforms) {
  const material = new MeshBasicNodeMaterial({ fog: false });
  const angle = atan(positionLocal.y, positionLocal.x).div(Math.PI * 2);
  const radius = length(positionLocal.xy);
  const hue = angle.mul(2).add(radius.mul(0.02)).sub(time.mul(0.08));
  const rainbow = cos(vec3(0, 2.09, 4.19).add(hue.mul(Math.PI * 2))).mul(0.5).add(0.5);
  const bulbs = line(radius.mul(0.8), 0.3).max(line(angle.mul(96), 0.25)).mul(0.7).add(0.3);
  material.colorNode = distant(rainbow.mul(bulbs).mul(lightLevel(u)).mul(1.3), u, 1);
  return material;
}

/** Unlit steelwork that only catches a little of the floodlight. */
export function createStructureMaterial(u: LandmarkUniforms, tint = new Color('#9fb3d9')) {
  const material = new MeshBasicNodeMaterial({ fog: false });
  material.colorNode = distant(vec3(tint.r, tint.g, tint.b).mul(floodlit()).mul(lightLevel(u)).mul(0.12), u);
  return material;
}

/** Suspension cables and deck edges strung with lamps, like a string of pearls. `along` is metres along the span. */
export function createBridgeLightsMaterial(u: LandmarkUniforms, along: 'uv' | 'x') {
  const material = new MeshBasicNodeMaterial({ fog: false });
  const s = along === 'uv' ? uv().x.mul(140) : positionWorld.x.mul(0.5);
  const lamps = line(s, 0.18);
  material.colorNode = distant(vec3(1, 0.9, 0.7).mul(lamps.mul(1.6).add(0.06)).mul(lightLevel(u)), u, 1);
  return material;
}

/**
 * Party lights strung from a boat's masthead to bow and stern: `count` bulbs along each tube,
 * each a different colour of the rainbow.
 */
export function createBoatLightsMaterial(u: LandmarkUniforms, count = 18) {
  const material = new MeshBasicNodeMaterial({ fog: false });
  const s = uv().x.mul(count);
  const bulb = s.floor();
  const rainbow = cos(vec3(0, 2.09, 4.19).add(bulb.mul(2.4))).mul(0.5).add(0.5);
  material.colorNode = distant(rainbow.mul(line(s.sub(0.5), 0.2).mul(1.8).add(0.04)).mul(lightLevel(u)), u, 1);
  return material;
}

/** A steady lamp (a masthead light), in one colour. */
export function createLampMaterial(u: LandmarkUniforms, color: Color) {
  const material = new MeshBasicNodeMaterial({ fog: false });
  material.colorNode = distant(vec3(color.r, color.g, color.b).mul(lightLevel(u).mul(1.5)), u, 1);
  return material;
}

/** A distant snow-capped volcano in moonlight: a silhouette with a pale, broken snow line. */
export function createMountainMaterial(u: LandmarkUniforms) {
  const material = new MeshBasicNodeMaterial({ fog: false });
  const height = positionLocal.y.div(110);
  const ragged = mx_noise_float(positionLocal.mul(vec3(0.08, 0.02, 0.08))).mul(0.12);
  const snow = smoothstep(0.62, 0.7, height.add(ragged));
  const rock = vec3(0.02, 0.025, 0.045);
  const moon = max(normalWorld.dot(normalize(vec3(-0.5, 0.6, 0.6))), 0).mul(0.7).add(0.3);
  // Snow stays well below the drones' brightness: moonlit, not floodlit.
  material.colorNode = mix(distant(mix(rock, vec3(0.13, 0.15, 0.2).mul(moon), snow).mul(u.lights.mul(0.8).add(0.4)), u), u.horizon, 0.35);
  return material;
}
