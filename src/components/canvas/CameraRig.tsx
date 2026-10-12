'use client';

import { CameraControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { SceneSettings, Vec3 } from '@/engine/types';

type Preset = SceneSettings['cameraPreset'];

export const CAMERA_SHOTS: Record<Preset, { position: Vec3; target: Vec3; orbit: number }> = {
  front: { position: [0, 9, 56], target: [0, 13.5, 0], orbit: 1 },
  'low-hero': { position: [-22, 2.4, 44], target: [0, 16, 0], orbit: 1 },
  'top-down': { position: [0, 78, 26], target: [0, 9, 0], orbit: 0.5 },
  'fly-around': { position: [42, 20, 44], target: [0, 14, 0], orbit: 5 },
};

interface CameraRigProps {
  preset: Preset;
  /** 0..1 slider value. */
  autoOrbit: number;
  /** Allow the user to orbit / zoom. */
  interactive: boolean;
  reducedMotion: boolean;
}

/**
 * drei CameraControls with named shots. Narrow viewports pull the camera back so the
 * whole formation stays in frame on phones.
 */
export function CameraRig({ preset, autoOrbit, interactive, reducedMotion }: CameraRigProps) {
  const controls = useRef<CameraControls>(null);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const lastInput = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const shot = CAMERA_SHOTS[preset];
    const pullBack = Math.min(3, Math.max(1, 1.5 / aspect));
    const [tx, ty, tz] = shot.target;
    const [px, py, pz] = shot.position;
    void c.setLookAt(
      tx + (px - tx) * pullBack,
      ty + (py - ty) * pullBack,
      tz + (pz - tz) * pullBack,
      tx,
      ty,
      tz,
      !first.current && !reducedMotion,
    );
    first.current = false;
  }, [preset, aspect, reducedMotion]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c || reducedMotion || autoOrbit <= 0) return;
    // Resume orbiting a moment after the user lets go.
    if (performance.now() - lastInput.current < 2500) return;
    void c.rotate(autoOrbit * CAMERA_SHOTS[preset].orbit * 0.22 * Math.min(dt, 0.05), 0, false);
  });

  return (
    <CameraControls
      ref={controls}
      makeDefault
      enabled={interactive}
      minDistance={4}
      maxDistance={220}
      maxPolarAngle={Math.PI * 0.497}
      smoothTime={reducedMotion ? 0.6 : 0.35}
      onStart={() => (lastInput.current = performance.now())}
      onChange={() => {
        if (controls.current?.currentAction) lastInput.current = performance.now();
      }}
    />
  );
}
