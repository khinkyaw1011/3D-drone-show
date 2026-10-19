'use client';

import { useFrame } from '@react-three/fiber';
import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BoxGeometry,
  type BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  type Group,
  LatheGeometry,
  LineCurve3,
  type Material,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three/webgpu';
import {
  type LandmarkUniforms,
  createBeaconMaterial,
  createBoatLightsMaterial,
  createBridgeLightsMaterial,
  createDeckMaterial,
  createGoldMaterial,
  createLampMaterial,
  createLandmarkUniforms,
  createLatticeMaterial,
  createMountainMaterial,
  createStructureMaterial,
  createWheelLightsMaterial,
} from '@/engine/materials/landmarks';
import { horizonColor } from '@/engine/materials/sky';
import { hasWater } from '@/engine/presets/schema';
import type { SceneSettings } from '@/engine/types';

/**
 * Sights around the show site. All stand outside the show volume, placed so the spectator view
 * frames them beside or behind the fleet.
 * Each builds its geometry and materials once, and frees them when switched off.
 */

type Landmark = SceneSettings['landmarks'][number];

/** Dispose everything a landmark made when it unmounts. */
function useOwned<T extends Record<string, BufferGeometry | Material>>(make: () => T): T {
  const [owned] = useState(make);
  useEffect(() => () => Object.values(owned).forEach((item) => item.dispose()), [owned]);
  return owned;
}

/** A lattice broadcast tower with two observation decks and a blinking beacon, back left. */
function Tower({ u }: { u: LandmarkUniforms }) {
  const parts = useOwned(() => ({
    lattice: createLatticeMaterial(u),
    deck: createDeckMaterial(u),
    beacon: createBeaconMaterial(u),
    // Four-sided frustums; each piece is translated so its base sits at y = 0.
    base: new CylinderGeometry(6, 14, 22, 4, 1, true).translate(0, 11, 0),
    mid: new CylinderGeometry(3, 6, 20, 4, 1, true).translate(0, 32, 0),
    upper: new CylinderGeometry(1.4, 2.8, 16, 4, 1, true).translate(0, 53, 0),
    deck1: new CylinderGeometry(4.8, 4.8, 3, 4).translate(0, 43.5, 0),
    deck2: new CylinderGeometry(2.4, 2.4, 1.6, 4).translate(0, 61.6, 0),
    antenna: new CylinderGeometry(0.25, 0.6, 14, 6).translate(0, 69.4, 0),
    lamp: new SphereGeometry(0.8, 12, 8).translate(0, 76.6, 0),
  }));
  return (
    <group position={[-140, 0, -190]} rotation-y={Math.PI / 4 + 0.2}>
      <mesh geometry={parts.base} material={parts.lattice} />
      <mesh geometry={parts.mid} material={parts.lattice} />
      <mesh geometry={parts.upper} material={parts.lattice} />
      <mesh geometry={parts.deck1} material={parts.deck} />
      <mesh geometry={parts.deck2} material={parts.deck} />
      <mesh geometry={parts.antenna} material={parts.lattice} />
      <mesh geometry={parts.lamp} material={parts.beacon} />
    </group>
  );
}

/** Profile of a bell-shaped stupa (radius, height), from the terraced base to the tip of the spire. */
const STUPA: [number, number][] = [
  [14, 0], [14, 2], [12, 2], [12, 4], [10, 4], [10, 6], [9, 6],
  [9.6, 9], [9.2, 13], [7.6, 17], [5.6, 20], [4, 22],
  [4.3, 23], [3.2, 24], [3.5, 25], [2.6, 26], [2.8, 27],
  [2.4, 29], [1.7, 32], [1, 35], [0.45, 38], [0.15, 41], [0, 42],
];

/** A floodlit golden stupa with two smaller ones beside it, back right. */
function Pagoda({ u }: { u: LandmarkUniforms }) {
  const parts = useOwned(() => ({
    gold: createGoldMaterial(u),
    stupa: new LatheGeometry(STUPA.map(([r, y]) => new Vector2(r, y)), 64),
  }));
  return (
    <group position={[135, 0, -165]}>
      <mesh geometry={parts.stupa} material={parts.gold} />
      <mesh geometry={parts.stupa} material={parts.gold} position={[-24, 0, 10]} scale={0.38} />
      <mesh geometry={parts.stupa} material={parts.gold} position={[22, 0, 12]} scale={0.32} />
    </group>
  );
}

const WHEEL = { radius: 13, hub: 16, spokes: 24 };

/** A Ferris wheel turning slowly, its lamps chasing in a rainbow, front right. */
function Wheel({ u }: { u: LandmarkUniforms }) {
  const turning = useRef<Group>(null);
  const parts = useOwned(() => {
    const spokes = Array.from({ length: WHEEL.spokes }, (_, i) =>
      new BoxGeometry(WHEEL.radius, 0.12, 0.12).translate(WHEEL.radius / 2, 0, 0).rotateZ((i / WHEEL.spokes) * Math.PI * 2),
    );
    const rims = [new TorusGeometry(WHEEL.radius, 0.22, 6, 128), new TorusGeometry(WHEEL.radius * 0.93, 0.1, 4, 128)];
    const wheel = mergeGeometries([...rims, ...spokes]);
    [...rims, ...spokes].forEach((g) => g.dispose());
    // Two A-frame legs from the ground to the hub, either side of the wheel.
    const leg = (x: number, z: number) => {
      const length = Math.hypot(x, WHEEL.hub);
      return new BoxGeometry(0.5, length, 0.5).translate(0, -length / 2, 0).rotateZ(Math.atan2(x, WHEEL.hub)).translate(0, WHEEL.hub, z);
    };
    const legs = [leg(-7, 1.6), leg(7, 1.6), leg(-7, -1.6), leg(7, -1.6)];
    const frame = mergeGeometries([...legs, new CylinderGeometry(0.6, 0.6, 3.6, 12).rotateX(Math.PI / 2).translate(0, WHEEL.hub, 0)]);
    legs.forEach((g) => g.dispose());
    return { wheel, frame, lights: createWheelLightsMaterial(u), steel: createStructureMaterial(u) };
  });
  useFrame((_, dt) => {
    if (turning.current) turning.current.rotation.z -= Math.min(dt, 0.1) * 0.05;
  });
  return (
    <group position={[40, 0, -72]} rotation-y={-0.4}>
      <mesh geometry={parts.frame} material={parts.steel} />
      <group ref={turning} position={[0, WHEEL.hub, 0]}>
        <mesh geometry={parts.wheel} material={parts.lights} />
      </group>
    </group>
  );
}

/** Close enough behind the show to read clearly, short enough to stay in the spectator's frame. */
const SPAN = { half: 64, tower: 36, top: 26, deck: 7, sag: 10, width: 3.5 };

/** Main cable of a suspension bridge: anchored at both ends, over both tower tops, sagging between. */
function cable(z: number) {
  const { half, tower, top, deck, sag } = SPAN;
  const points: Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = -half + (i / 60) * half * 2;
    const inside = Math.abs(x) <= tower;
    // Parabola between the towers; straight back-stays from each tower top down to the deck ends.
    const y = inside ? sag + (top - sag) * (x / tower) ** 2 : top - ((Math.abs(x) - tower) / (half - tower)) * (top - deck - 1);
    points.push(new Vector3(x, y, z));
  }
  return new TubeGeometry(new CatmullRomCurve3(points), 240, 0.18, 5);
}

/** A suspension bridge strung with lights, behind the show across the water. */
function Bridge({ u }: { u: LandmarkUniforms }) {
  const parts = useOwned(() => {
    const { half, tower, top, deck, width } = SPAN;
    const pieces = [-tower, tower].flatMap((x) => [
      new BoxGeometry(1.6, top + 2, 1.6).translate(x, top / 2 + 1, -width),
      new BoxGeometry(1.6, top + 2, 1.6).translate(x, top / 2 + 1, width),
      new BoxGeometry(1.2, 1.2, width * 2).translate(x, top - 2, 0),
      new BoxGeometry(1, 1, width * 2).translate(x, deck + 6, 0),
    ]);
    const towers = mergeGeometries(pieces);
    pieces.forEach((g) => g.dispose());
    const cables = [cable(-width), cable(width)];
    const merged = mergeGeometries(cables);
    cables.forEach((g) => g.dispose());
    return {
      towers,
      cables: merged,
      deck: new BoxGeometry(half * 2, 1, width * 2 + 1).translate(0, deck, 0),
      steel: createStructureMaterial(u, new Color('#c9d6ff')),
      cableLights: createBridgeLightsMaterial(u, 'uv'),
      deckLights: createBridgeLightsMaterial(u, 'x'),
    };
  });
  return (
    <group position={[-8, 0, -96]}>
      <mesh geometry={parts.towers} material={parts.steel} />
      <mesh geometry={parts.cables} material={parts.cableLights} />
      <mesh geometry={parts.deck} material={parts.deckLights} />
    </group>
  );
}

/** Where the boats lie at anchor: [x, z, heading, scale]. All on the water behind and beside the show, clear of the pad. */
const BOATS: [number, number, number, number][] = [
  [-46, -26, 0.4, 1.2],
  [36, -34, 2.6, 1],
  [-76, -58, -0.3, 1.4],
  [82, -30, 3.5, 0.9],
  [-20, -72, 1.2, 1.6],
  [12, -112, 0.2, 1.3],
  [-108, -100, 2.2, 1.1],
  [96, -118, -0.8, 1.5],
];

/** Top view of a hull, bow towards +x. */
function hullShape() {
  const shape = new Shape();
  shape.moveTo(-3, -0.8);
  shape.lineTo(1.6, -0.8);
  shape.quadraticCurveTo(2.8, -0.6, 3.3, 0);
  shape.quadraticCurveTo(2.8, 0.6, 1.6, 0.8);
  shape.lineTo(-3, 0.8);
  shape.closePath();
  return shape;
}

/** A light string from the masthead down to `end`. */
const lightString = (end: Vector3) => new TubeGeometry(new LineCurve3(new Vector3(0.4, 4.6, 0), end), 8, 0.05, 4);

/** Pleasure boats at anchor, dressed in strings of coloured lights, rocking gently. Only on water. */
function Boats({ u }: { u: LandmarkUniforms }) {
  const boats = useRef<Group>(null);
  const parts = useOwned(() => {
    // Extruded upwards from the top view, then sunk so the waterline sits a third of the way up.
    const hull = new ExtrudeGeometry(hullShape(), { depth: 0.9, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -0.3, 0);
    const strings = [lightString(new Vector3(3.2, 0.6, 0)), lightString(new Vector3(-2.9, 0.6, 0))];
    const lights = mergeGeometries(strings);
    strings.forEach((g) => g.dispose());
    return {
      hull,
      cabin: new BoxGeometry(2.2, 0.7, 1.1).translate(-0.6, 0.95, 0),
      mast: new CylinderGeometry(0.04, 0.07, 4, 6).translate(0.4, 2.6, 0),
      lamp: new SphereGeometry(0.13, 10, 6).translate(0.4, 4.7, 0),
      lights,
      steel: createStructureMaterial(u, new Color('#e6ecff')),
      deck: createDeckMaterial(u),
      bulbs: createBoatLightsMaterial(u),
      white: createLampMaterial(u, new Color('#fff3d8')),
    };
  });
  // Each boat rocks on its own slow swell.
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    boats.current?.children.forEach((boat, i) => {
      boat.position.y = Math.sin(t * 0.6 + i * 1.3) * 0.08;
      boat.rotation.x = Math.sin(t * 0.5 + i * 1.7) * 0.035;
      boat.rotation.z = Math.sin(t * 0.43 + i * 2.1) * 0.02;
    });
  });
  return (
    <group ref={boats}>
      {BOATS.map(([x, z, heading, scale], i) => (
        <group key={i} position={[x, 0, z]} rotation-y={heading} scale={scale}>
          <mesh geometry={parts.hull} material={parts.steel} />
          <mesh geometry={parts.cabin} material={parts.deck} />
          <mesh geometry={parts.mast} material={parts.steel} />
          <mesh geometry={parts.lamp} material={parts.white} />
          <mesh geometry={parts.lights} material={parts.bulbs} />
        </group>
      ))}
    </group>
  );
}

/** A broad snow-capped volcano on the horizon, left of centre. */
function Mountain({ u }: { u: LandmarkUniforms }) {
  const parts = useOwned(() => ({
    // Flat-topped like a volcano, base at y = 0 (the shader reads height from there).
    cone: new CylinderGeometry(14, 170, 110, 96, 1).translate(0, 55, 0),
    rock: createMountainMaterial(u),
  }));
  // Base sunk below the ground so the slopes meet the horizon rather than ending on it.
  return <mesh geometry={parts.cone} material={parts.rock} position={[-70, -18, -400]} scale={[1.5, 1, 0.6]} />;
}

const SIGHTS: Record<Landmark, ComponentType<{ u: LandmarkUniforms }>> = {
  tower: Tower,
  pagoda: Pagoda,
  wheel: Wheel,
  bridge: Bridge,
  mountain: Mountain,
  boats: Boats,
};

/** The landmarks the scene has switched on. They share one set of uniforms: horizon colour, haze and light level. */
export function Landmarks({ scene }: { scene: SceneSettings }) {
  const u = useMemo(() => createLandmarkUniforms(), []);
  useEffect(() => {
    horizonColor(scene, u.horizon.value);
    u.haze.value = scene.fog;
    u.lights.value = scene.ambient;
  }, [u, scene]);
  return (
    <>
      {scene.landmarks.filter((id) => id !== 'boats' || hasWater(scene.ground)).map((id) => {
        const Sight = SIGHTS[id];
        return <Sight key={id} u={u} />;
      })}
    </>
  );
}
