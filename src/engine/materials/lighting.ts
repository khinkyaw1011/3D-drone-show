import { uniform } from 'three/tsl';
import { Color } from 'three/webgpu';
import { seededRng } from '../formations/sample';

/** Fraction of a firework shell's cycle spent climbing before it bursts. */
export const FIREWORK_RISE = 0.24;
export const FIREWORK_SHELLS = 10;

/**
 * When each firework shell fires: a period and a phase offset per shell. Decided here, on
 * the CPU, and handed to the shader, so both sides agree on the exact moment of every burst.
 */
export const FIREWORK_SCHEDULE = (() => {
  const rng = seededRng(2027);
  return Array.from({ length: FIREWORK_SHELLS }, () => ({ period: 3.6 + rng() * 2.6, offset: rng() }));
})();

/** How much light the bursts in the air are throwing right now (0 = none). Pure function of time. */
export function burstLight(time: number, activeShells: number): number {
  let light = 0;
  for (let k = 0; k < Math.min(activeShells, FIREWORK_SHELLS); k++) {
    const { period, offset } = FIREWORK_SCHEDULE[k];
    const phase = (time / period + offset) % 1;
    const burst = (phase - FIREWORK_RISE) / (1 - FIREWORK_RISE);
    // Brightest at the break, gone by the time the stars have spread.
    if (burst >= 0 && burst < 0.45) light += (1 - burst / 0.45) ** 2;
  }
  return light;
}

/**
 * Light the show throws on its surroundings, shared by everything on the ground (grass,
 * trees). Colours are premultiplied by intensity, so black means "no light".
 */
export function createSceneLight() {
  return {
    /** The fleet's LEDs: the average colour of the formation on stage. */
    fleet: uniform(new Color(0, 0, 0)),
    /** Firework bursts: flashes in step with the shells. */
    burst: uniform(new Color(0, 0, 0)),
  };
}
export type SceneLight = ReturnType<typeof createSceneLight>;

/** Mean colour of a formation (sRGB triples in, linear Color out). */
export function averageColor(colors: Float32Array, target = new Color()): Color {
  let [r, g, b] = [0, 0, 0];
  const step = Math.max(3, Math.floor(colors.length / 3 / 200) * 3); // a sample is plenty
  let n = 0;
  for (let i = 0; i < colors.length; i += step, n++) {
    r += colors[i];
    g += colors[i + 1];
    b += colors[i + 2];
  }
  return target.setRGB(r / n, g / n, b / n, 'srgb');
}
