import { interpolate, converter } from 'culori';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { random } from 'maath';
import {
  BoxGeometry,
  type BufferGeometry,
  ConeGeometry,
  ExtrudeGeometry,
  OctahedronGeometry,
  RingGeometry,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three/webgpu';
import { z } from 'zod';
import type { FormationSource } from '../../types';
import { toFormation } from '../fit';
import { sampleGeometry, seededRng } from '../sample';

export const SHAPES = [
  'sphere',
  'ring',
  'heart',
  'blossom',
  'galaxy',
  'grid',
  'cube',
  'torus',
  'star',
  'helix',
  'wave',
  'burst',
  'saturn',
  'diamond',
  'pyramid',
  'tornado',
  'butterfly',
] as const;
export type ShapeName = (typeof SHAPES)[number];

const inputSchema = z.object({
  shape: z.enum(SHAPES).default('sphere'),
  fill: z.number().min(0.3).max(1).default(0.85).describe('Size'),
});
export type ShapeInput = z.infer<typeof inputSchema>;

const toRgb = converter('rgb');

function polarShape(radius: (theta: number) => number, steps = 240): Shape {
  const shape = new Shape();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = radius(t);
    const x = Math.sin(t) * r;
    const y = Math.cos(t) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

function heartShape(): Shape {
  const s = new Shape();
  s.moveTo(0, -1);
  s.bezierCurveTo(-0.2, -0.75, -1.25, -0.2, -1.25, 0.45);
  s.bezierCurveTo(-1.25, 1.05, -0.35, 1.25, 0, 0.6);
  s.bezierCurveTo(0.35, 1.25, 1.25, 1.05, 1.25, 0.45);
  s.bezierCurveTo(1.25, -0.2, 0.2, -0.75, 0, -1);
  return s;
}

function starShape(points = 5, inner = 0.42): Shape {
  const s = new Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : 1;
    const a = (i / (points * 2)) * Math.PI * 2;
    if (i === 0) s.moveTo(Math.sin(a) * r, Math.cos(a) * r);
    else s.lineTo(Math.sin(a) * r, Math.cos(a) * r);
  }
  s.closePath();
  return s;
}

/** One side of a butterfly: a large upper wing and a smaller lower wing, as closed curves from the body. */
function butterflyWings(side: 1 | -1): Shape[] {
  const upper = new Shape();
  upper.moveTo(0.04 * side, 0.1);
  upper.bezierCurveTo(0.35 * side, 0.95, 1.25 * side, 1.05, 1.15 * side, 0.35);
  upper.bezierCurveTo(1.1 * side, -0.05, 0.45 * side, -0.05, 0.04 * side, 0.02);
  const lower = new Shape();
  lower.moveTo(0.04 * side, -0.02);
  lower.bezierCurveTo(0.6 * side, -0.02, 0.95 * side, -0.35, 0.72 * side, -0.78);
  lower.bezierCurveTo(0.5 * side, -1.05, 0.12 * side, -0.6, 0.04 * side, -0.12);
  return [upper, lower];
}

/** Five notched petals: the cherry blossom silhouette. */
function blossomShape(): Shape {
  return polarShape((t) => {
    const petal = Math.abs(Math.cos(2.5 * t));
    const notch = 1 - 0.16 * Math.pow(Math.abs(Math.cos(2.5 * t)), 24);
    return (0.22 + 0.78 * Math.pow(petal, 0.55)) * notch;
  });
}

const SOLID = { depth: 0.38, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.2, bevelSegments: 4 };

const GEOMETRY: Partial<Record<ShapeName, () => BufferGeometry>> = {
  sphere: () => new SphereGeometry(1, 48, 32),
  ring: () => new TorusGeometry(1, 0.035, 8, 160),
  torus: () => new TorusGeometry(1, 0.4, 24, 96).rotateX(Math.PI * 0.32),
  cube: () => new BoxGeometry(1.5, 1.5, 1.5).rotateY(Math.PI / 5).rotateX(Math.PI / 9),
  // Extruded with a generous bevel so they are solid from every side when the formation turns.
  heart: () => new ExtrudeGeometry(heartShape(), { ...SOLID, curveSegments: 40 }).center(),
  star: () => new ExtrudeGeometry(starShape(), { ...SOLID, bevelSize: 0.06 }).center(),
  // The blossom stays a single layer of petals, cupped like a real flower.
  blossom: () => {
    const g = new ShapeGeometry(blossomShape(), 64);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.hypot(pos.getX(i), pos.getY(i)) ** 2 * 0.62 - 0.2);
    // Tilt it back like a flower facing the crowd, so the bowl has real depth from every side.
    return g.rotateX(-0.5);
  },
  // Wings raised in a shallow V, so the flap movement has something to beat.
  butterfly: () => {
    const g = new ShapeGeometry([...butterflyWings(1), ...butterflyWings(-1)], 32);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.abs(pos.getX(i)) * 0.35);
    return g.rotateX(-0.9);
  },
  diamond: () => new OctahedronGeometry(1, 0).scale(0.8, 1.15, 0.8),
  pyramid: () => new ConeGeometry(1, 1.35, 4, 6).rotateY(Math.PI / 4),
  // A planet with its ring: two surfaces merged, so the fleet splits between globe and ring by area.
  saturn: () =>
    mergeGeometries([
      new SphereGeometry(0.62, 40, 28).toNonIndexed(),
      new RingGeometry(0.88, 1.35, 96, 6).rotateX(-Math.PI / 2).toNonIndexed(),
    ]).rotateZ(0.42).rotateX(0.3),
  wave: () => {
    const g = new PlaneGeometry(4, 1.6, 96, 24);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setY(i, pos.getY(i) + Math.sin(x * 2.4) * 0.34);
      pos.setZ(i, Math.cos(x * 2.4 + pos.getY(i) * 1.5) * 0.3);
    }
    return g;
  },
};

type Points = { positions: Float32Array; colors?: Float32Array };

/** Shapes that are not surfaces of a mesh: lattices, volumes and parametric curves. */
const PARAMETRIC: Partial<Record<ShapeName, (count: number) => Points>> = {
  // A solid block of light: a 3D lattice, wider than it is deep.
  grid: (count) => {
    const nz = Math.max(2, Math.round(Math.cbrt(count / 6)));
    const nx = Math.ceil(Math.sqrt((count / nz) * 1.7));
    const ny = Math.ceil(count / nz / nx);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = i % nx;
      positions[i * 3 + 1] = -(Math.floor(i / nx) % ny);
      positions[i * 3 + 2] = Math.floor(i / (nx * ny));
    }
    return { positions };
  },
  tornado: (count) => {
    const rng = seededRng(13);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const radius = (0.12 + t * t * 0.95) * (0.9 + rng() * 0.2);
      const angle = t * Math.PI * 14 + (i % 3) * ((Math.PI * 2) / 3);
      positions.set([Math.cos(angle) * radius, t * 2.6 - 1.3, Math.sin(angle) * radius], i * 3);
    }
    return { positions };
  },
  burst: (count) => {
    // Firework shell: directions from maath, pushed out to a thick shell.
    const rng = seededRng(3);
    const positions = random.onSphere(new Float32Array(count * 3), { radius: 1 }) as Float32Array;
    for (let i = 0; i < count; i++) {
      const r = 0.55 + 0.45 * Math.sqrt(rng());
      for (let k = 0; k < 3; k++) positions[i * 3 + k] *= r;
    }
    return { positions };
  },
  galaxy: (count) => {
    const rng = seededRng(7);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const ramp = interpolate(['#fff1c9', '#ffb86b', '#7c9cff', '#3b4fd8'], 'oklch');
    const arms = 3;
    for (let i = 0; i < count; i++) {
      const r = Math.pow(rng(), 0.6);
      const arm = (i % arms) * ((Math.PI * 2) / arms);
      const angle = arm + r * 4.2 + (rng() - 0.5) * (0.9 - r * 0.5);
      const spread = (rng() - 0.5) * 0.12 * (1.2 - r);
      positions[i * 3] = Math.cos(angle) * r + spread;
      positions[i * 3 + 1] = Math.sin(angle) * r * 0.55 + spread;
      positions[i * 3 + 2] = (rng() - 0.5) * 0.18 * (1 - r) - Math.sin(angle) * r * 0.35;
      const c = toRgb(ramp(r)) ?? { r: 1, g: 1, b: 1 };
      colors.set([c.r, c.g, c.b], i * 3);
    }
    return { positions, colors };
  },
  helix: (count) => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const turns = 3;
    const strand = Math.floor(count * 0.36);
    const strandColors = [toRgb('#7cf7e4')!, toRgb('#ff8fb1')!, toRgb('#ece8df')!];
    const rungCount = 14 * turns;
    for (let i = 0; i < count; i++) {
      let x: number, y: number, z: number, c: (typeof strandColors)[number];
      if (i < strand * 2) {
        const s = i < strand ? 0 : 1;
        const t = (i % strand) / strand;
        const a = t * Math.PI * 2 * turns + s * Math.PI;
        [x, y, z, c] = [Math.cos(a) * 0.5, t * 4 - 2, Math.sin(a) * 0.5, strandColors[s]];
      } else {
        const k = i - strand * 2;
        const rung = k % rungCount;
        const t = (rung + 0.5) / rungCount;
        const a = t * Math.PI * 2 * turns;
        const u = (Math.floor(k / rungCount) / Math.max(1, Math.floor((count - strand * 2) / rungCount))) * 2 - 1;
        [x, y, z, c] = [Math.cos(a) * 0.5 * u, t * 4 - 2, Math.sin(a) * 0.5 * u, strandColors[2]];
      }
      positions.set([x, y, z], i * 3);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    return { positions, colors };
  },
};

/** Soft petal colouring for the blossom: pale centre to deep pink tips. */
function blossomColors(positions: Float32Array): Float32Array {
  const ramp = interpolate(['#fff6d6', '#ffd9e6', '#ff9ec4', '#ff5fa2'], 'oklch');
  const colors = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const c = toRgb(ramp(Math.min(1, Math.hypot(positions[i], positions[i + 1])))) ?? { r: 1, g: 0.6, b: 0.8 };
    colors.set([c.r, c.g, c.b], i);
  }
  return colors;
}

export const shapeSource: FormationSource<ShapeInput> = {
  id: 'shape',
  label: 'Shape',
  icon: 'Shapes',
  inputSchema,
  runsIn: 'worker',
  describe: (input) => input.shape.charAt(0).toUpperCase() + input.shape.slice(1),
  async generate(input, { count, signal }) {
    const parametric = PARAMETRIC[input.shape];
    let points: Points;
    if (parametric) points = parametric(count);
    else {
      const geometry = GEOMETRY[input.shape]!();
      points = sampleGeometry(geometry, count, { seed: 11, signal });
      geometry.dispose();
      if (input.shape === 'blossom') points.colors = blossomColors(points.positions);
    }
    return toFormation('shape', this.describe(input), points.positions, points.colors, input.fill);
  },
};
