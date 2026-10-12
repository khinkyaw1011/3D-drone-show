'use client';

import { useEffect, useMemo } from 'react';
import { BoxGeometry, type InstancedMesh, MeshBasicNodeMaterial, Object3D, PlaneGeometry } from 'three/webgpu';
import { floor, mx_cell_noise_float, normalLocal, positionWorld, smoothstep, step, uniform, uv, vec3 } from 'three/tsl';
import { padLayout } from '@/engine/formations/fit';
import { seededRng } from '@/engine/formations/sample';
import { FIREWORK_COUNT, FIREWORK_SHELLS, createFireworksMaterial } from '@/engine/materials/fireworks';
import { createSkyMaterial, horizonColor } from '@/engine/materials/sky';
import { createWaterMaterial } from '@/engine/materials/water';
import type { QualityTier, SceneSettings } from '@/engine/types';

/** Gradient sky dome with TSL stars and aurora. */
export function Sky({ scene }: { scene: SceneSettings }) {
  const sky = useMemo(() => createSkyMaterial(), []);
  useEffect(() => sky.apply(scene), [sky, scene]);
  useEffect(() => () => sky.material.dispose(), [sky]);
  return (
    <mesh material={sky.material} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[450, 48, 24]} />
    </mesh>
  );
}

function Water({ scene, tier }: { scene: SceneSettings; tier: QualityTier }) {
  const water = useMemo(() => createWaterMaterial(tier.reflections, tier.name === 'high' ? 0.5 : 0.35), [tier]);
  useEffect(() => {
    horizonColor(scene, water.uniforms.horizon.value);
  }, [water, scene]);
  useEffect(() => () => water.material.dispose(), [water]);
  return (
    <>
      {water.target && <primitive object={water.target} />}
      <mesh material={water.material} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[900, 900]} />
      </mesh>
    </>
  );
}

const BUILDINGS = 150;

/** A dark skyline ring behind the show with a few lit windows; one instanced draw call. */
function City({ scene }: { scene: SceneSettings }) {
  const { geometry, material, lights } = useMemo(() => {
    const lights = uniform(0.5);
    const material = new MeshBasicNodeMaterial({ fog: false });
    // Small, sparse, dim windows: a skyline at night should sit well below the drones' brightness.
    const cell = floor(vec3(positionWorld.x.mul(1.7), positionWorld.y.mul(1.5), positionWorld.z.mul(1.7)));
    const lit = step(0.93, mx_cell_noise_float(cell)).mul(step(0.6, positionWorld.y));
    material.colorNode = vec3(0.003, 0.0035, 0.006).add(vec3(1, 0.74, 0.4).mul(lit).mul(lights));
    return { geometry: new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), material, lights };
  }, []);
  useEffect(() => {
    lights.value = scene.ambient * 0.35;
  }, [lights, scene.ambient]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const place = (mesh: InstancedMesh | null) => {
    if (!mesh) return;
    const rng = seededRng(42);
    const dummy = new Object3D();
    for (let i = 0; i < BUILDINGS; i++) {
      // Arc of towers behind and beside the stage, taller towards the back.
      const angle = Math.PI * (0.08 + 0.84 * (i / BUILDINGS)) + (rng() - 0.5) * 0.04;
      const radius = 120 + rng() * 80;
      dummy.position.set(Math.cos(angle) * radius, 0, -Math.sin(angle) * radius + 20);
      dummy.scale.set(5 + rng() * 8, 4 + rng() * rng() * 20, 5 + rng() * 8);
      dummy.rotation.y = rng() * 0.6;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  return <instancedMesh ref={place} args={[geometry, material, BUILDINGS]} frustumCulled={false} />;
}

const GOLD = ['#ffd27a', '#fff4d6', '#ffb84d'];

/** Fireworks behind the show; one stateless instanced draw (see `createFireworksMaterial`). */
export function Fireworks({ scene, colors }: { scene: SceneSettings; colors: string[] }) {
  const fireworks = useMemo(() => createFireworksMaterial(), []);
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const { intensity, size, palette } = scene.fireworks;
  useEffect(() => {
    const u = fireworks.uniforms;
    u.active.value = Math.ceil(intensity * FIREWORK_SHELLS);
    u.scale.value = size;
    u.rainbow.value = palette === 'rainbow' ? 1 : 0;
    const stops = palette === 'gold' ? GOLD : colors;
    u.colorA.value.set(stops[0]);
    u.colorB.value.set(stops[1] ?? stops[0]);
    u.colorC.value.set(stops[2] ?? stops[0]);
  }, [fireworks, intensity, size, palette, colors]);
  useEffect(
    () => () => {
      fireworks.material.dispose();
      geometry.dispose();
    },
    [fireworks, geometry],
  );
  if (intensity <= 0) return null;
  return <mesh geometry={geometry} material={fireworks.material} count={FIREWORK_COUNT} frustumCulled={false} renderOrder={1} />;
}

/** The barge the fleet lifts off from: a dark deck with a thin lit rim, sized to the fleet. */
export function LaunchPad({ count }: { count: number }) {
  const { width, depth, center } = useMemo(() => padLayout(count), [count]);
  const material = useMemo(() => {
    const m = new MeshBasicNodeMaterial({ fog: false });
    // Lit rim from the box's own UVs: bright within a few percent of each edge of the top face.
    const edge = uv().sub(0.5).abs().mul(2);
    const rim = smoothstep(0.955, 0.985, edge.x.max(edge.y)).mul(step(0.5, normalLocal.y));
    m.colorNode = vec3(0.004, 0.005, 0.008).add(vec3(0.5, 0.95, 0.9).mul(rim).mul(0.22));
    return m;
  }, []);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} position={[center[0], center[1] - 0.2, center[2]]}>
      <boxGeometry args={[width + 1.6, 0.22, depth + 1.6]} />
    </mesh>
  );
}

/** Ground: reflective water, a city skyline over dark ground, or nothing. */
export function Ground({ scene, tier }: { scene: SceneSettings; tier: QualityTier }) {
  if (scene.ground === 'none') return null;
  return (
    <>
      <Water scene={scene} tier={tier} />
      {scene.ground === 'city' && <City scene={scene} />}
    </>
  );
}
