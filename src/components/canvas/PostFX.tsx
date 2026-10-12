'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { WebGPURenderer } from 'three/webgpu';
import { createPostFX } from '@/engine/renderer/postfx';
import type { SceneSettings } from '@/engine/types';

/** Bloom, exposure, vignette and grain. Takes over rendering from R3F (priority 1). */
export function PostFX({ scene: settings, bloomScale }: { scene: SceneSettings; bloomScale: number }) {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const fx = useMemo(() => createPostFX(gl, scene, camera, bloomScale), [gl, scene, camera, bloomScale]);
  useEffect(() => fx.apply(settings), [fx, settings]);
  useEffect(() => () => fx.dispose(), [fx]);
  useFrame(() => fx.render(), 1);
  return null;
}
