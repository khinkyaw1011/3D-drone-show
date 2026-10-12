'use client';

import { CameraControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, type PerspectiveCamera, Vector3 } from 'three';
import { SHOW_VOLUME } from '@/engine/formations/fit';
import type { SceneSettings, Vec3 } from '@/engine/types';

/** Height of the middle of the show. */
const SKY = SHOW_VOLUME.center[1];

type Preset = Exclude<SceneSettings['cameraPreset'], 'walk'>;

export const CAMERA_SHOTS: Record<Preset, { position: Vec3; target: Vec3; orbit: number }> = {
  // Standing in the crowd, looking up at the show.
  // Aimed below the middle of the show, so the launch deck on the ground stays in frame with the formation above it.
  spectator: { position: [0, 1.7, 40], target: [0, SKY - 8, 0], orbit: 0.6 },
  // In among the fleet: close enough to see airframes, skids and spinning propellers.
  'close-up': { position: [5, SKY + 1.5, 13], target: [0, SKY, 0], orbit: 1 },
  front: { position: [0, SKY - 3, 36], target: [0, SKY, 0], orbit: 1 },
  'low-hero': { position: [-20, 2, 34], target: [0, SKY, 0], orbit: 1 },
  'top-down': { position: [0, 70, 20], target: [0, SKY - 5, 0], orbit: 0.5 },
  'fly-around': { position: [34, SKY + 3, 34], target: [0, SKY - 1, 0], orbit: 5 },
};

/** Farthest the viewer may pull back: the whole show still fills a good part of the frame. */
const MAX_DISTANCE = 95;
/** The point being looked at stays inside this box, so panning can never lose the show. */
const TARGET_BOUNDS = new Box3(new Vector3(-26, 2, -16), new Vector3(26, 32, 16));

/** Eye height the camera may not go below (it would dip under the ground). */
const MIN_EYE = 1.2;

interface CameraRigProps {
  preset: Preset;
  /** 0..1 slider value. */
  autoOrbit: number;
  /** Allow the user to orbit / zoom. */
  interactive: boolean;
  reducedMotion: boolean;
}

/**
 * Slide the rendered picture sideways by `pixels` (positive = show moves left) so the show sits
 * in the part of the screen a side panel leaves free. A lens shift: perspective is unchanged.
 */
export function ViewOffset({ pixels }: { pixels: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    if (pixels) camera.setViewOffset(size.width, size.height, pixels, 0, size.width, size.height);
    else camera.clearViewOffset();
    return () => camera.clearViewOffset();
  }, [camera, size, pixels]);
  return null;
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
  const scratch = useMemo(() => new Vector3(), []);

  useEffect(() => {
    controls.current?.setBoundary(TARGET_BOUNDS);
  }, []);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const shot = CAMERA_SHOTS[preset];
    const pullBack = preset === 'close-up' ? 1 : Math.min(1.9, Math.max(1, 1.5 / aspect));
    const [tx, baseY, tz] = shot.target;
    // On a tall phone screen the pulled-back crowd view already shows the ground; aim higher so the
    // formation sits mid-screen, clear of the headline.
    const ty = baseY + (preset === 'spectator' && aspect < 1 ? 6 : 0);
    const [px, py, pz] = shot.position;
    void c.setLookAt(
      tx + (px - tx) * pullBack,
      // Pulling back along the view line must never take a low camera under the ground.
      Math.max(Math.min(py, 1.5), ty + (py - ty) * pullBack),
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
    if (!c) return;
    // Let the viewer swing all the way down to eye level and look up at the sky, but never below ground:
    // the lowest allowed polar angle depends on how far the camera is from its target.
    const drop = c.getTarget(scratch).y - MIN_EYE;
    c.maxPolarAngle = Math.PI / 2 + Math.asin(Math.min(0.98, Math.max(0, drop / Math.max(c.distance, 1e-3))));
    if (reducedMotion || autoOrbit <= 0) return;
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
      maxDistance={MAX_DISTANCE}
      smoothTime={reducedMotion ? 0.6 : 0.35}
      onStart={() => (lastInput.current = performance.now())}
      onChange={() => {
        if (controls.current?.currentAction) lastInput.current = performance.now();
      }}
    />
  );
}
