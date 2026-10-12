import { z } from 'zod';

/** Bump when the persisted/shared Show shape changes, and add a step in `migrateShow`. */
export const SHOW_VERSION = 1;

export const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const COLOR_MODES = ['formation', 'solid', 'gradient', 'palette', 'rainbow', 'height'] as const;
export const AXES = ['x', 'y', 'z'] as const;
export const SKY_PRESETS = ['midnight', 'aurora', 'dusk', 'deep-space'] as const;
export const GROUNDS = ['water', 'city', 'none'] as const;
export const CAMERA_PRESETS = ['front', 'low-hero', 'top-down', 'fly-around'] as const;
export const ORDERS = ['random', 'radial', 'top-down', 'by-color'] as const;
export const EFFECTS = ['drop', 'burst', 'wind'] as const;
/** Integrated curves; any other string is treated as a GSAP ease name. */
export const SIM_CURVES = ['spring', 'swarm', 'physics'] as const;
export const EASE_CURVES = ['power2.inOut', 'power3.inOut', 'expo.inOut', 'back.out(1.4)', 'sine.inOut', 'none'] as const;

export const droneLookSchema = z.object({
  size: z.number().min(0.08).max(0.8).default(0.3),
  glow: z.number().min(0).max(3).default(1.2),
  twinkle: z.number().min(0).max(1).default(0.25),
  trails: z.boolean().default(true),
  colorMode: z.enum(COLOR_MODES).default('formation'),
  colors: z.array(hex).min(1).max(3).default(['#ffd27a', '#ff8fb1', '#7cf7e4']),
  gradientAxis: z.enum(AXES).default('y'),
  swarm: z.number().min(0).max(1).default(0.25),
  hoverBob: z.number().min(0).max(1).default(0.2),
});

export const physicsSettingsSchema = z.object({
  gravity: z.number().min(1).max(30).default(9.8),
  restitution: z.number().min(0).max(1).default(0.45),
  windDirection: z.number().min(0).max(360).default(90),
  windStrength: z.number().min(0).max(20).default(6),
  maxBodies: z.number().int().min(100).max(3000).default(1500),
});

export const sceneSettingsSchema = z.object({
  sky: z.enum(SKY_PRESETS).default('midnight'),
  ground: z.enum(GROUNDS).default('water'),
  stars: z.number().min(0).max(1).default(0.6),
  fog: z.number().min(0).max(1).default(0.15),
  cameraPreset: z.enum(CAMERA_PRESETS).default('front'),
  autoOrbit: z.number().min(0).max(1).default(0.15),
  bloom: z
    .object({
      strength: z.number().min(0).max(3).default(0.7),
      radius: z.number().min(0).max(1).default(0.6),
      threshold: z.number().min(0).max(1).default(0.1),
    })
    .prefault({}),
  grain: z.number().min(0).max(1).default(0.12),
  vignette: z.number().min(0).max(1).default(0.45),
  exposure: z.number().min(0.3).max(2.5).default(1),
  physics: physicsSettingsSchema.prefault({}),
});

export const cameraShotSchema = z.object({ preset: z.enum(CAMERA_PRESETS) });

export const transitionSchema = z.object({
  duration: z.number().min(0.2).max(20).default(3),
  curve: z.string().default('power3.inOut'),
  effect: z.enum(EFFECTS).optional(),
  stagger: z.number().min(0).max(1).default(0.35),
  order: z.enum(ORDERS).default('radial'),
});

export const keyframeSchema = z.object({
  id: z.string(),
  name: z.string().default('Formation'),
  formation: z.object({ sourceId: z.string(), input: z.unknown() }),
  hold: z.number().min(0).max(30).default(2.5),
  /** Degrees per second the formation turns about the vertical axis, like a hologram on a turntable. */
  spin: z.number().min(-60).max(60).default(0),
  transition: transitionSchema.prefault({}),
  look: droneLookSchema.partial().optional(),
  camera: cameraShotSchema.optional(),
});

export const showSchema = z.object({
  version: z.number().int().default(SHOW_VERSION),
  id: z.string(),
  name: z.string().min(1).max(60),
  droneCount: z.number().int().min(100).max(20000).default(2000),
  keyframes: z.array(keyframeSchema).max(40),
  look: droneLookSchema.prefault({}),
  scene: sceneSettingsSchema.prefault({}),
});

/** Upgrade older show payloads (persisted, imported or shared) to the current version. */
export function migrateShow(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const show = { ...(raw as Record<string, unknown>) };
  // v0 (pre-release) had no version field.
  if (typeof show.version !== 'number') show.version = SHOW_VERSION;
  return show;
}

export function parseShow(raw: unknown) {
  return showSchema.parse(migrateShow(raw));
}
