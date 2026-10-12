import type { Capabilities, QualityTier } from '../types';

export const TIERS: Record<QualityTier['name'], QualityTier> = {
  low: { name: 'low', maxDrones: 4000, dpr: [1, 1.25], reflections: false, bloomScale: 0.5 },
  medium: { name: 'medium', maxDrones: 8000, dpr: [1, 1.5], reflections: true, bloomScale: 0.5 },
  high: { name: 'high', maxDrones: 20000, dpr: [1, 2], reflections: true, bloomScale: 1 },
};

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
  // WebGL2 runs the CPU simulator, so the ceiling is CPU-bound regardless of tier.
  return { webgpu, compute: webgpu, mobile, tier: webgpu ? tier : { ...tier, maxDrones: mobile ? 3000 : 6000 } };
}
