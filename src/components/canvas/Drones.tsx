'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, type Mesh, type PerspectiveCamera, Plane, PlaneGeometry, Vector3 } from 'three/webgpu';
import { SHOW_VOLUME } from '@/engine/formations/fit';
import { MOTION_ID, createDroneMaterial, createDroneUniforms } from '@/engine/materials/droneSprite';
import { AIRFRAME_FADE, createQuadcopterGeometry, createQuadcopterMaterial } from '@/engine/materials/quadcopter';
import type { ShowPlayer } from '@/engine/playback/ShowPlayer';
import type { DroneLook } from '@/engine/types';

const VOLUME = new Box3().setFromCenterAndSize(new Vector3(...SHOW_VOLUME.center), new Vector3(...SHOW_VOLUME.size));
const CENTER = new Vector3(...SHOW_VOLUME.center);

interface DronesProps {
  /** Owns the simulator and the show clock the drones animate on. */
  player: ShowPlayer;
  look: DroneLook;
  /** 0..1 LED power (dimmed while drones "power off" and fall). */
  power: number;
  /** Let the pointer shove nearby drones. */
  pushToy?: boolean;
  /** Tightest spacing between neighbouring drones; airframes and LEDs are sized to stay inside it. */
  spacing: number;
}

/** The fleet in two instanced draws that read the simulator's buffers: the 3D airframes, and the LED each one carries. */
export function Drones({ player, look, power, spacing, pushToy = false }: DronesProps) {
  const sim = player.sim;
  const size = useThree((s) => s.size);
  const quadRef = useRef<Mesh>(null);
  const uniforms = useMemo(() => createDroneUniforms(), []);
  const goal = useRef({ body: uniforms.body.value, size: uniforms.size.value, glow: uniforms.glow.value });
  const sprite = useMemo(() => {
    const { material } = createDroneMaterial(sim.buffers, uniforms);
    return { material, geometry: new PlaneGeometry(1, 1) };
  }, [sim, uniforms]);
  const quad = useMemo(
    () => ({ material: createQuadcopterMaterial(sim.buffers, uniforms), geometry: createQuadcopterGeometry() }),
    [sim, uniforms],
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
      quad.material.dispose();
      quad.geometry.dispose();
    },
    [quad],
  );

  useEffect(() => {
    // Never draw a drone wider than the gap to its neighbour: real fleets do not touch.
    const body = Math.min(1.1, Math.max(0.1, spacing * 0.95 * look.body));
    // The LED is a lamp on the airframe, never bigger than the drone carrying it.
    // Sizes and glow are targets: the frame loop eases towards them, so nothing pops when a new
    // formation changes the fleet's spacing or a slider moves.
    goal.current = { body, size: Math.min(look.size, body * 0.55), glow: look.glow };
    uniforms.twinkle.value = look.twinkle;
    uniforms.trail.value = look.trails ? 1 : 0;
    uniforms.bob.value = look.hoverBob;
  }, [look, spacing, uniforms]);

  const scratch = useMemo(() => ({ plane: new Plane(), hit: new Vector3(), normal: new Vector3() }), []);

  useFrame(({ camera, pointer, raycaster }, dt) => {
    const ease = Math.min(1, dt * 3.5);
    uniforms.body.value += (goal.current.body - uniforms.body.value) * ease;
    uniforms.size.value += (goal.current.size - uniforms.size.value) * ease;
    uniforms.glow.value += (goal.current.glow - uniforms.glow.value) * ease;
    const cam = camera as PerspectiveCamera;
    uniforms.pixelScale.value = (2 * Math.tan((cam.fov * Math.PI) / 360)) / size.height;
    uniforms.power.value += (power - uniforms.power.value) * Math.min(1, dt * 4);
    // Show clock + the movement of the formation on stage (flap, wave...), eased so it never pops.
    const motion = player.motion;
    uniforms.clock.value = player.motionTime;
    if (motion.kind !== 'none') uniforms.motion.value = MOTION_ID[motion.kind];
    uniforms.motionYaw.value = motion.yaw;
    uniforms.motionSpan.value = motion.span;
    uniforms.motionAmount.value += ((motion.kind === 'none' ? 0 : motion.amount) - uniforms.motionAmount.value) * Math.min(1, dt * 2.5);

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
      <mesh ref={quadRef} geometry={quad.geometry} material={quad.material} count={sim.count} frustumCulled={false} />
    </>
  );
}
