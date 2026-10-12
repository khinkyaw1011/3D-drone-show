import { z } from 'zod';

/** Bump when the persisted/shared Show shape changes, and add a step in `migrateShow`. */
export const SHOW_VERSION = 2;

export const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const COLOR_MODES = ['formation', 'solid', 'gradient', 'palette', 'rainbow', 'random', 'height'] as const;
export const AXES = ['x', 'y', 'z'] as const;
export const SKY_PRESETS = ['midnight', 'aurora', 'dusk', 'deep-space'] as const;
export const GROUNDS = ['field', 'water', 'city', 'none'] as const;
export const CAMERA_PRESETS = ['spectator', 'walk', 'close-up', 'front', 'low-hero', 'top-down', 'fly-around'] as const;
export const ORDERS = ['random', 'radial', 'top-down', 'by-color'] as const;
export const EFFECTS = ['drop', 'burst', 'wind'] as const;
/** Integrated curves; any other string is treated as a GSAP ease name. */
export const SIM_CURVES = ['spring', 'swarm', 'physics'] as const;
export const EASE_CURVES = ['power2.inOut', 'power3.inOut', 'expo.inOut', 'back.out(1.4)', 'sine.inOut', 'none'] as const;

export const droneLookSchema = z.object({
  size: z.number().min(0.08).max(0.8).default(0.2),
  /** Airframe size as a fraction of the largest that still clears the neighbouring drone. */
  body: z.number().min(0.35).max(1).default(1),
  glow: z.number().min(0).max(3).default(1.2),
  /**
   * 0 = airframe lit only by its own lamp and the sky (realistic); 1 = the whole airframe glows in its colour.
   * Unset until the visitor chooses: the site default then applies (`defaultBodyGlow` in `lib/site.ts`, set from the environment).
   */
  bodyGlow: z.number().min(0).max(1).optional(),
  twinkle: z.number().min(0).max(1).default(0.25),
  trails: z.boolean().default(true),
  colorMode: z.enum(COLOR_MODES).default('formation'),
  colors: z.array(hex).min(1).max(3).default(['#ffd27a', '#ff8fb1', '#7cf7e4']),
  gradientAxis: z.enum(AXES).default('y'),
  swarm: z.number().min(0).max(1).default(0.25),
  hoverBob: z.number().min(0).max(1).default(0.06),
});

export const physicsSettingsSchema = z.object({
  gravity: z.number().min(1).max(30).default(9.8),
  restitution: z.number().min(0).max(1).default(0.45),
  windDirection: z.number().min(0).max(360).default(90),
  windStrength: z.number().min(0).max(20).default(6),
  maxBodies: z.number().int().min(100).max(3000).default(1500),
});

export const FIREWORK_PALETTES = ['show', 'rainbow', 'gold'] as const;
export const FIREWORK_STYLES = ['mixed', 'peony', 'willow', 'ring'] as const;

/** Fireworks behind the show. Intensity 0 switches them off. */
export const fireworksSchema = z.object({
  intensity: z.number().min(0).max(1).default(0),
  size: z.number().min(0.5).max(2).default(1),
  palette: z.enum(FIREWORK_PALETTES).default('show'),
  style: z.enum(FIREWORK_STYLES).default('mixed'),
  height: z.number().min(0.6).max(1.4).default(1),
});

/** Lighting on the ground, as at a real show site. */
export const venueSchema = z.object({
  /** Searchlight beams sweeping the sky from beside the launch pad. */
  beams: z.number().min(0).max(1).default(0.35),
  /** Pool of coloured light the fleet throws on the ground beneath it. */
  glow: z.number().min(0).max(1).default(0.5),
});

export const sceneSettingsSchema = z.object({
  sky: z.enum(SKY_PRESETS).default('midnight'),
  ground: z.enum(GROUNDS).default('water'),
  stars: z.number().min(0).max(1).default(0.35),
  /** Brightness of everything that is not a drone (sky glow, city lights), so the LEDs can stand out. */
  ambient: z.number().min(0).max(1).default(0.3),
  fog: z.number().min(0).max(1).default(0.15),
  cameraPreset: z.enum(CAMERA_PRESETS).default('spectator'),
  autoOrbit: z.number().min(0).max(1).default(0),
  bloom: z
    .object({
      strength: z.number().min(0).max(3).default(0.45),
      radius: z.number().min(0).max(1).default(0.6),
      threshold: z.number().min(0).max(1).default(0.1),
    })
    .prefault({}),
  grain: z.number().min(0).max(1).default(0.12),
  vignette: z.number().min(0).max(1).default(0.45),
  exposure: z.number().min(0.3).max(2.5).default(1),
  physics: physicsSettingsSchema.prefault({}),
  fireworks: fireworksSchema.prefault({}),
  /** Apparent size of the stars. */
  starSize: z.number().min(0).max(1).default(0.3),
  starTwinkle: z.number().min(0).max(1).default(0.5),
  /** Strength of the Milky Way band across the sky. */
  milkyWay: z.number().min(0).max(1).default(0.3),
  venue: venueSchema.prefault({}),
});

/** How faithfully the fleet obeys real-world limits. Speeds and distances are in metres. */
export const flightSchema = z.object({
  /** Stretch transitions so no drone exceeds `maxSpeed`, and plan routes that keep `separation`. */
  realistic: z.boolean().default(true),
  maxSpeed: z.number().min(3).max(25).default(16),
  separation: z.number().min(0.5).max(4).default(1.5),
});

/** How a formation moves while it holds. All are smooth fields over the whole formation, so neighbours move together. */
export const MOTIONS = ['none', 'flap', 'wave', 'pulse', 'sway'] as const;

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
  /** Added by the visitor (typed, picked or uploaded), as opposed to part of the show it came with. */
  custom: z.boolean().default(false),
  motion: z.enum(MOTIONS).default('none'),
  motionAmount: z.number().min(0).max(1).default(0.5),
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
  /** Id of the preset this show was loaded from, so the visitor's own changes can be told apart from the preset's. */
  basedOn: z.string().optional(),
  droneCount: z.number().int().min(100).max(20000).default(800),
  keyframes: z.array(keyframeSchema).max(40),
  look: droneLookSchema.prefault({}),
  scene: sceneSettingsSchema.prefault({}),
  flight: flightSchema.prefault({}),
});

/** Upgrade older show payloads (persisted, imported or shared) to the current version. */
export function migrateShow(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const show = { ...(raw as Record<string, unknown>) };
  // v0 (pre-release) had no version field.
  if (typeof show.version !== 'number') show.version = 1;
  // v1 always stored `look.bodyGlow`, 1 unless changed. From v2 it is only stored once the visitor
  // chooses, so the site default can apply; a stored 1 cannot be told from "never touched" and is dropped.
  if ((show.version as number) < 2) {
    const look = show.look as Record<string, unknown> | undefined;
    if (look && look.bodyGlow === 1) show.look = Object.fromEntries(Object.entries(look).filter(([key]) => key !== 'bodyGlow'));
    show.version = 2;
  }
  return show;
}

export function parseShow(raw: unknown) {
  return showSchema.parse(migrateShow(raw));
}
