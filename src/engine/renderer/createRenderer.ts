import { WebGPURenderer } from 'three/webgpu';
import type { Capabilities } from '../types';
import { detectCapabilities } from './capabilities';

export interface RendererOptions {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  /** Skip WebGPU (testing the fallback, or `?webgl` in the URL). */
  forceWebGL?: boolean;
}

/**
 * WebGPU-first renderer; three falls back to its WebGL2 backend automatically.
 * Must be awaited before first use (R3F accepts an async `gl` factory).
 */
export async function createRenderer({ canvas, forceWebGL = false }: RendererOptions): Promise<WebGPURenderer> {
  const renderer = new WebGPURenderer({
    canvas: canvas as HTMLCanvasElement,
    antialias: false, // sprites are soft; bloom hides the rest
    alpha: false,
    powerPreference: 'high-performance',
    forceWebGL,
  });
  await renderer.init();
  return renderer;
}

export function rendererCapabilities(renderer: WebGPURenderer): Capabilities {
  const backend = renderer.backend as unknown as { isWebGPUBackend?: boolean };
  return detectCapabilities(backend.isWebGPUBackend === true);
}
