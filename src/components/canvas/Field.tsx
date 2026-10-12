'use client';

import { useEffect, useMemo } from 'react';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ConeGeometry, CylinderGeometry, InstancedBufferAttribute, PlaneGeometry } from 'three/webgpu';
import { padLayout } from '@/engine/formations/fit';
import { seededRng } from '@/engine/formations/sample';
import { createGrassMaterial, createTreeMaterial, createWindUniforms } from '@/engine/materials/field';
import type { SceneLight } from '@/engine/materials/lighting';
import { horizonColor } from '@/engine/materials/sky';
import { createWaterMaterial } from '@/engine/materials/water';
import type { QualityTier, SceneSettings } from '@/engine/types';

const BLADES: Record<QualityTier['name'], number> = { low: 14000, medium: 36000, high: 70000 };
const FIELD_RADIUS = 78;
const TREES = 110;

/** Blades scattered over a disc, thicker near the crowd, none on the launch pad. */
function scatterBlades(count: number, padCount: number): Float32Array {
  const rng = seededRng(101);
  const pad = padLayout(padCount);
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; ) {
    const r = Math.sqrt(rng()) * FIELD_RADIUS;
    const a = rng() * Math.PI * 2;
    const [x, z] = [Math.cos(a) * r, Math.sin(a) * r + 14]; // centred a little towards the viewer
    if (Math.abs(x) < pad.width / 2 + 1.2 && Math.abs(z - pad.center[2]) < pad.depth / 2 + 1.2) continue;
    out.set([x, z, 0.35 + rng() * rng() * 0.9, rng() * Math.PI], i * 4);
    i++;
  }
  return out;
}

/** A tree line behind and beside the show, never between the crowd and the fleet. */
function scatterTrees(): Float32Array {
  const rng = seededRng(55);
  const out = new Float32Array(TREES * 4);
  for (let i = 0; i < TREES; i++) {
    const angle = Math.PI * (0.02 + 0.96 * (i / TREES)) + (rng() - 0.5) * 0.05; // an arc on the far side
    // Far enough, and low enough, that the tree line sits under the fleet instead of in front of it.
    const radius = 110 + rng() * 60;
    out.set([Math.cos(angle) * radius, -Math.sin(angle) * radius + 26, 0.9 + rng() * 1.1, rng() * 40], i * 4);
  }
  return out;
}

/** A simple conifer: trunk plus three stacked cones, about 7 units tall before scaling. */
function treeGeometry() {
  const parts = [
    new CylinderGeometry(0.16, 0.22, 2, 5).translate(0, 1, 0),
    new ConeGeometry(1.5, 2.6, 7).translate(0, 2.9, 0),
    new ConeGeometry(1.15, 2.3, 7).translate(0, 4.4, 0),
    new ConeGeometry(0.75, 2, 7).translate(0, 5.8, 0),
  ].map((g) => g.toNonIndexed());
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

interface FieldProps {
  scene: SceneSettings;
  tier: QualityTier;
  /** Fleet size, for the launch pad footprint the grass must leave clear. */
  count: number;
  /** Light the show throws on its surroundings (fleet LEDs, firework bursts). */
  light: SceneLight;
}

/**
 * A meadow at night: dark ground, tens of thousands of instanced grass blades and a tree
 * line, all moved by the scene's wind (direction and strength) in the vertex shader.
 */
export function Field({ scene, tier, count, light }: FieldProps) {
  const field = useMemo(() => {
    const wind = createWindUniforms();
    const blades = BLADES[tier.name];
    const bladeGeometry = new PlaneGeometry(1, 1, 1, 4).translate(0, 0.5, 0);
    bladeGeometry.setAttribute('blade', new InstancedBufferAttribute(scatterBlades(blades, count), 4));
    const trees = treeGeometry();
    trees.setAttribute('tree', new InstancedBufferAttribute(scatterTrees(), 4));
    const soil = createWaterMaterial(false);
    soil.uniforms.tint.value.set('#030604');
    return { wind, blades, bladeGeometry, trees, soil, grass: createGrassMaterial(wind, light), tree: createTreeMaterial(wind, light) };
  }, [tier.name, count, light]);

  const { windDirection, windStrength } = scene.physics;
  useEffect(() => {
    const a = (windDirection * Math.PI) / 180;
    field.wind.direction.value.set(Math.sin(a), Math.cos(a));
    field.wind.strength.value = windStrength / 20;
    field.grass.uniforms.ambient.value = scene.ambient;
    field.tree.uniforms.ambient.value = scene.ambient;
    horizonColor(scene, field.soil.uniforms.horizon.value);
  }, [field, windDirection, windStrength, scene]);

  useEffect(
    () => () => {
      field.bladeGeometry.dispose();
      field.trees.dispose();
      field.soil.material.dispose();
      field.grass.material.dispose();
      field.tree.material.dispose();
    },
    [field],
  );

  return (
    <>
      <mesh material={field.soil.material} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[900, 900]} />
      </mesh>
      <mesh geometry={field.bladeGeometry} material={field.grass.material} count={field.blades} frustumCulled={false} />
      <mesh geometry={field.trees} material={field.tree.material} count={TREES} frustumCulled={false} />
    </>
  );
}
