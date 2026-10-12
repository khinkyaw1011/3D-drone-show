import type { Capabilities, QualityTier } from '../types';

/**
 * Fleet size limits, the single source of truth. Every drone is a full 3D airframe, so the
 * ceiling is what each class of device can draw smoothly, not what the simulation could move.
 */
export const FLEET = { min: 100, step: 100 } as const;

export const TIERS: Record<QualityTier['name'], QualityTier> = {
  low: { name: 'low', maxDrones: 600, dpr: [1, 1.25], reflections: false, bloomScale: 0.5 },
  medium: { name: 'medium', maxDrones: 1500, dpr: [1, 1.5], reflections: true, bloomScale: 0.5 },
  high: { name: 'high', maxDrones: 3000, dpr: [1, 2], reflections: true, bloomScale: 1 },
};

/** Smallest and largest fleet this device may fly. `deviceMax` is a lower ceiling found at runtime (see the frame-rate watchdog). */
export function fleetLimits(capabilities: Capabilities | null, deviceMax: number | null = null) {
  const max = Math.max(FLEET.min, Math.min(capabilities?.tier.maxDrones ?? TIERS.high.maxDrones, deviceMax ?? Infinity));
  return { min: FLEET.min, max, clamp: (count: number) => Math.round(Math.min(max, Math.max(FLEET.min, count)) / FLEET.step) * FLEET.step };
}

/** The ceiling to fall back to when a fleet of `count` could not hold a smooth frame rate. */
export const reducedFleet = (count: number) => Math.max(FLEET.min, Math.floor((count * 0.6) / FLEET.step) * FLEET.step);

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Decide what this device can comfortably run, from the backend the renderer actually got. */
export function detectCapabilities(webgpu: boolean): Capabilities {
  const mobile = isMobileDevice();
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4;
  const tier = !webgpu ? TIERS.low : mobile || cores < 8 ? TIERS.medium : TIERS.high;
  return { webgpu, compute: webgpu, mobile, tier };
}
