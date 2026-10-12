'use client';

import { useFrame } from '@react-three/fiber';
import { CuboidCollider, InstancedRigidBodies, type InstancedRigidBodyProps, Physics, type RapierRigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import { hash01 } from '@/engine/formations/order';
import { SHOW_VOLUME } from '@/engine/formations/fit';
import type { PhysicsMoment } from '@/engine/playback/ShowPlayer';
import type { Simulator } from '@/engine/sim/Simulator';
import type { CompiledFrame } from '@/engine/timeline/compile';
import type { PhysicsSettings } from '@/engine/types';

// Rapier body types (RigidBodyType enum values).
const DYNAMIC = 0;
const KINEMATIC = 2;
const PARKED_Y = -50;

interface PhysicsMomentsProps {
  sim: Simulator;
  /** The physics moment in progress, or null during formation flight. */
  moment: PhysicsMoment | null;
  /** Where drones are when the moment begins. */
  from: CompiledFrame;
  settings: PhysicsSettings;
}

/**
 * Real rigid bodies for a capped subset of drones (drop / burst / wind).
 * Bodies are kinematic and parked during formation flight; when a moment starts they turn
 * dynamic at their drone's position, and their transforms are streamed back into the
 * simulator's `override` buffer, which the same instanced renderer draws from.
 */
export default function PhysicsMoments({ sim, moment, from, settings }: PhysicsMomentsProps) {
  const bodies = useRef<RapierRigidBody[]>(null);
  const bodyCount = Math.min(settings.maxBodies, sim.count);
  const stride = Math.max(1, Math.floor(sim.count / bodyCount));
  const override = useMemo(() => new Float32Array(sim.count * 4), [sim]);
  const instances = useMemo<InstancedRigidBodyProps[]>(
    () => Array.from({ length: bodyCount }, (_, k) => ({ key: k, position: [k % 40, PARKED_Y, Math.floor(k / 40)] })),
    [bodyCount],
  );
  const wind = useMemo(() => {
    const a = (settings.windDirection * Math.PI) / 180;
    return { x: Math.sin(a) * settings.windStrength * 0.02, y: 0.012, z: Math.cos(a) * settings.windStrength * 0.02 };
  }, [settings.windDirection, settings.windStrength]);

  useEffect(() => {
    const list = bodies.current;
    if (!list) return;
    if (!moment) {
      list.forEach((body, k) => {
        body.setBodyType(KINEMATIC, false);
        body.setTranslation({ x: k % 40, y: PARKED_Y, z: Math.floor(k / 40) }, false);
      });
      override.fill(0);
      sim.setOverride(null);
      return;
    }
    const [cx, cy, cz] = SHOW_VOLUME.center;
    list.forEach((body, k) => {
      const i = k * stride;
      const [x, y, z] = [from.positions[i * 3], from.positions[i * 3 + 1], from.positions[i * 3 + 2]];
      body.setBodyType(DYNAMIC, true);
      body.setTranslation({ x, y, z }, true);
      if (moment.effect === 'burst') {
        const d = [x - cx, y - cy, z - cz];
        const len = Math.hypot(d[0], d[1], d[2]) || 1;
        const speed = 7 + hash01(i) * 9;
        body.setLinvel({ x: (d[0] / len) * speed, y: (d[1] / len) * speed + 4, z: (d[2] / len) * speed }, true);
      } else {
        body.setLinvel({ x: (hash01(i + 11) - 0.5) * 1.2, y: 0, z: (hash01(i + 37) - 0.5) * 1.2 }, true);
      }
    });
  }, [moment, from, sim, stride, override]);

  useFrame(() => {
    const list = bodies.current;
    if (!list || !moment) return;
    list.forEach((body, k) => {
      if (moment.effect === 'wind') body.applyImpulse(wind, true);
      const t = body.translation();
      const o = k * stride * 4;
      override[o] = t.x;
      override[o + 1] = t.y;
      override[o + 2] = t.z;
      override[o + 3] = 1;
    });
    sim.setOverride(override);
  });

  // Mirror the simulator's ballistic gravity per effect so both groups of drones fall alike.
  const gravity = moment?.effect === 'wind' ? settings.gravity * 0.12 : moment?.effect === 'burst' ? settings.gravity * 0.55 : settings.gravity;

  return (
    <Physics gravity={[0, -gravity, 0]} paused={!moment} colliders={false}>
      <InstancedRigidBodies
        key={bodyCount}
        ref={bodies}
        instances={instances}
        type="kinematicPosition"
        colliders="ball"
        restitution={settings.restitution}
        linearDamping={0.25}
      >
        <instancedMesh args={[undefined, undefined, bodyCount]} visible={false} frustumCulled={false}>
          <sphereGeometry args={[0.16, 6, 4]} />
        </instancedMesh>
      </InstancedRigidBodies>
      <CuboidCollider position={[0, -0.35, 0]} args={[400, 0.5, 400]} restitution={settings.restitution} />
    </Physics>
  );
}
