'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, type Mesh, type PerspectiveCamera, Plane, PlaneGeometry, Vector3 } from 'three/webgpu';
import { SHOW_VOLUME } from '@/engine/formations/fit';
import { createDroneMaterial, createDroneUniforms } from '@/engine/materials/droneSprite';
import { AIRFRAME_FADE, createQuadcopterGeometry, createQuadcopterMaterial } from '@/engine/materials/quadcopter';
import type { Simulator } from '@/engine/sim/Simulator';
import type { DroneLook } from '@/engine/types';

const VOLUME = new Box3().setFromCenterAndSize(new Vector3(...SHOW_VOLUME.center), new Vector3(...SHOW_VOLUME.size));
const CENTER = new Vector3(...SHOW_VOLUME.center);

interface DronesProps {
  sim: Simulator;
  look: DroneLook;
  /** 0..1 LED power (dimmed while drones "power off" and fall). */
  power: number;
  /** Let the pointer shove nearby drones. */
  pushToy?: boolean;
  /** Draw the 3D quadcopter airframes (off on the low tier / very large fleets). */
  airframes?: boolean;
}

/** All drones in one draw call: an instanced quad whose material reads the simulator's buffers. */
export function Drones({ sim, look, power, pushToy = false, airframes = true }: DronesProps) {
  const size = useThree((s) => s.size);
  const quadRef = useRef<Mesh>(null);
  const uniforms = useMemo(() => createDroneUniforms(), []);
  const sprite = useMemo(() => {
    const { material } = createDroneMaterial(sim.buffers, uniforms);
    return { material, geometry: new PlaneGeometry(1, 1) };
  }, [sim, uniforms]);
  const quad = useMemo(
    () => (airframes ? { material: createQuadcopterMaterial(sim.buffers, uniforms), geometry: createQuadcopterGeometry() } : null),
    [sim, uniforms, airframes],
  );

  useEffect(
    () => () => {
      sprite.material.dispose();
      sprite.geometry.dispose();
    },
    [sprite],
  );
  useEffect(
    () => () => {
      quad?.material.dispose();
      quad?.geometry.dispose();
    },
    [quad],
  );

  useEffect(() => {
    uniforms.size.value = look.size;
    uniforms.body.value = 0.35 + look.size * 1.2;
    uniforms.glow.value = look.glow;
    uniforms.twinkle.value = look.twinkle;
    uniforms.trail.value = look.trails ? 1 : 0;
    uniforms.bob.value = look.hoverBob;
  }, [look, uniforms]);

  const scratch = useMemo(() => ({ plane: new Plane(), hit: new Vector3(), normal: new Vector3() }), []);

  useFrame(({ camera, pointer, raycaster }, dt) => {
    const cam = camera as PerspectiveCamera;
    uniforms.pixelScale.value = (2 * Math.tan((cam.fov * Math.PI) / 360)) / size.height;
    uniforms.power.value += (power - uniforms.power.value) * Math.min(1, dt * 4);

    // Cursor push: intersect the pointer ray with a camera-facing plane through the show.
    let strength = 0;
    if (pushToy) {
      raycaster.setFromCamera(pointer, camera);
      scratch.plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(scratch.normal), CENTER);
      if (raycaster.ray.intersectPlane(scratch.plane, scratch.hit)) {
        uniforms.pushPoint.value.copy(scratch.hit);
        strength = 2.4;
      }
    }
    uniforms.pushStrength.value += (strength - uniforms.pushStrength.value) * Math.min(1, dt * 6);

    if (quadRef.current) quadRef.current.visible = VOLUME.distanceToPoint(camera.position) < AIRFRAME_FADE.far;
  });

  return (
    <>
      <mesh geometry={sprite.geometry} material={sprite.material} count={sim.count} frustumCulled={false} renderOrder={2} />
      {quad && (
        <mesh ref={quadRef} geometry={quad.geometry} material={quad.material} count={sim.count} frustumCulled={false} visible={false} />
      )}
    </>
  );
}
